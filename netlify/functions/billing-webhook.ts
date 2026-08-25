import type { Config } from '@netlify/functions';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getPool } from './_shared/db';

function env(name: string) {
  return Netlify.env.get(name);
}

function signatureIsValid(payload: string, signature: string, secret: string) {
  const calculated = createHmac('sha512', secret).update(payload).digest('hex');
  return calculated.length === signature.length && timingSafeEqual(Buffer.from(calculated), Buffer.from(signature));
}

export default async (request: Request) => {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const rawPayload = await request.text();
  const signature = request.headers.get('x-modem-signature');
  const secret = env('MODEM_PAY_WEBHOOK_SECRET') || env('MODEM_PAY_SECRET_HASH');
  if (!signature || !secret || !signatureIsValid(rawPayload, signature, secret)) {
    return Response.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  let event: any;
  try { event = JSON.parse(rawPayload); }
  catch { return Response.json({ error: 'Invalid webhook data' }, { status: 400 }); }

  const payload = event?.payload || {};
  const eventType = String(event?.event || 'unknown');
  const providerEventId = String(payload.id || payload.transaction_reference || payload.payment_intent_id || '');
  if (!providerEventId) return Response.json({ error: 'Webhook event has no trusted payment identifier' }, { status: 400 });

  const db = getPool();
  const client = await db.connect();
  try {
    await client.query('begin');
    const received = await client.query(
      `insert into billing_events (provider, provider_event_id, event_type, processing_status, payload)
       values ('modempay',$1,$2,'received',$3::jsonb)
       on conflict (provider, provider_event_id) do update
         set processing_status = 'received', error_message = null
         where billing_events.processing_status = 'failed'
       returning id`,
      [providerEventId, eventType, JSON.stringify(event)]
    );
    if (!received.rowCount) {
      await client.query('commit');
      return Response.json({ received: true, duplicate: true });
    }
    const eventId = received.rows[0].id;
    if (eventType !== 'charge.succeeded' || payload.status !== 'completed') {
      await client.query(`update billing_events set processing_status = 'ignored', processed_at = now() where id = $1`, [eventId]);
      await client.query('commit');
      return Response.json({ received: true, ignored: true });
    }

    const invoiceId = payload?.metadata?.invoice_id;
    if (!invoiceId) throw new Error('Successful charge is missing LexAMS invoice metadata');
    const invoiceResult = await client.query(
      `select * from billing_invoices where id = $1 for update`,
      [invoiceId]
    );
    if (!invoiceResult.rowCount) throw new Error('No LexAMS invoice matches this payment');
    const invoice = invoiceResult.rows[0];
    if (Number(payload.amount) !== Number(invoice.amount) || payload.currency !== invoice.currency) {
      throw new Error('Payment amount or currency does not match the invoice');
    }

    const transaction = await client.query(
      `insert into billing_transactions (
         organization_id, invoice_id, provider, provider_transaction_id, amount, currency,
         status, payment_method, provider_reference, metadata, paid_at
       ) values ($1,$2,'modempay',$3,$4,$5,'paid',$6,$7,$8::jsonb,now())
       on conflict (provider, provider_transaction_id) do nothing returning id`,
      [invoice.organization_id, invoice.id, providerEventId, invoice.amount, invoice.currency, payload.payment_method || null, payload.transaction_reference || null, JSON.stringify({ payment_intent_id: payload.payment_intent_id || null })]
    );
    if (!transaction.rowCount) {
      await client.query(`update billing_events set processing_status = 'processed', processed_at = now() where id = $1`, [eventId]);
      await client.query('commit');
      return Response.json({ received: true, duplicate: true });
    }

    const billingCycle = invoice.metadata?.billing_cycle === 'annual' ? 'annual' : 'monthly';
    const interval = billingCycle === 'annual' ? '1 year' : '1 month';
    await client.query(`update billing_invoices set status = 'paid', paid_at = now(), updated_at = now() where id = $1`, [invoice.id]);
    await client.query(
      `update organization_subscriptions
       set plan = 'pro', status = 'active', billing_cycle = $2, provider = 'modempay', cancel_at_period_end = false,
           current_period_start = greatest(coalesce(current_period_end, now()), now()),
           current_period_end = greatest(coalesce(current_period_end, now()), now()) + $3::interval,
           grace_period_end = null, updated_at = now()
       where organization_id = $1`,
      [invoice.organization_id, billingCycle, interval]
    );
    await client.query(`update billing_events set processing_status = 'processed', processed_at = now() where id = $1`, [eventId]);
    await client.query('commit');
    return Response.json({ received: true, processed: true });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('Modem Pay webhook processing failed', error);
    await db.query(
      `insert into billing_events (provider, provider_event_id, event_type, processing_status, payload, error_message)
       values ('modempay',$1,$2,'failed',$3::jsonb,$4)
       on conflict (provider, provider_event_id) do update
         set processing_status = 'failed', error_message = excluded.error_message
         where billing_events.processing_status <> 'processed'`,
      [providerEventId, eventType, JSON.stringify(event), error instanceof Error ? error.message.slice(0, 1000) : 'Unknown webhook processing error']
    ).catch(() => undefined);
    return Response.json({ error: 'Webhook could not be processed' }, { status: 500 });
  } finally {
    client.release();
  }
};

export const config: Config = { path: '/api/billing/webhook' };
