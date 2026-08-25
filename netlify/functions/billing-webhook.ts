import type { Config, Context } from '@netlify/functions';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Resend } from 'resend';
import { getPool } from './_shared/db';

function env(name: string) {
  return Netlify.env.get(name);
}

function signatureIsValid(payload: string, signature: string, secret: string) {
  const calculated = createHmac('sha512', secret).update(payload).digest('hex');
  return calculated.length === signature.length && timingSafeEqual(Buffer.from(calculated), Buffer.from(signature));
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: unknown) {
  return String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GM', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount) + ` ${currency}`;
}

async function sendReceipt({
  receiptEventId,
  receiptTo,
  organizationName,
  billingCycle,
  amount,
  currency,
  reference,
  paymentMethod,
  paidAt,
}: {
  receiptEventId: string;
  receiptTo: string;
  organizationName: string;
  billingCycle: 'monthly' | 'annual';
  amount: number;
  currency: string;
  reference: string;
  paymentMethod: string | null;
  paidAt: string;
}) {
  const db = getPool();
  const apiKey = env('RESEND_API_KEY');
  if (!apiKey) {
    await db.query(`update billing_events set processing_status = 'failed', processed_at = now(), error_message = 'Receipt email is not configured' where id = $1`, [receiptEventId]);
    return;
  }

  const paidDate = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Banjul' }).format(new Date(paidAt));
  const planName = `LexAMS Pro — ${billingCycle === 'annual' ? 'Annual' : 'Monthly'} plan`;
  const result = await new Resend(apiKey).emails.send({
    from: env('AUTH_EMAIL_FROM') || 'LexAMS <onboarding@resend.dev>',
    to: receiptTo,
    subject: `Payment receipt — ${reference}`,
    html: `<div style="margin:0;padding:32px 16px;background:#f5f7fa;font-family:Arial,sans-serif;color:#122033"><div style="max-width:620px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e3e8ee"><div style="padding:28px 32px;background:#002B54;color:#fff"><div style="font-size:24px;font-weight:700;letter-spacing:.2px">LexAMS</div><div style="margin-top:6px;color:#FAB72D;font-size:14px;font-weight:700">PAYMENT RECEIPT</div></div><div style="padding:32px"><p style="margin:0 0 20px">Hello,</p><p style="margin:0 0 24px;line-height:1.6">Thank you. Your payment has been confirmed and your LexAMS Pro access is active.</p><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:10px 0;border-top:1px solid #e7ebf0;color:#64748b">Organisation</td><td style="padding:10px 0;border-top:1px solid #e7ebf0;text-align:right;font-weight:600">${escapeHtml(organizationName)}</td></tr><tr><td style="padding:10px 0;border-top:1px solid #e7ebf0;color:#64748b">Plan</td><td style="padding:10px 0;border-top:1px solid #e7ebf0;text-align:right;font-weight:600">${escapeHtml(planName)}</td></tr><tr><td style="padding:10px 0;border-top:1px solid #e7ebf0;color:#64748b">Amount paid</td><td style="padding:10px 0;border-top:1px solid #e7ebf0;text-align:right;font-size:18px;font-weight:700;color:#002B54">${escapeHtml(formatAmount(amount, currency))}</td></tr><tr><td style="padding:10px 0;border-top:1px solid #e7ebf0;color:#64748b">Payment date</td><td style="padding:10px 0;border-top:1px solid #e7ebf0;text-align:right;font-weight:600">${escapeHtml(paidDate)}</td></tr><tr><td style="padding:10px 0;border-top:1px solid #e7ebf0;color:#64748b">Reference</td><td style="padding:10px 0;border-top:1px solid #e7ebf0;text-align:right;font-weight:600">${escapeHtml(reference)}</td></tr>${paymentMethod ? `<tr><td style="padding:10px 0;border-top:1px solid #e7ebf0;color:#64748b">Payment method</td><td style="padding:10px 0;border-top:1px solid #e7ebf0;text-align:right;font-weight:600">${escapeHtml(paymentMethod)}</td></tr>` : ''}</table><p style="margin:28px 0 0;line-height:1.6">Keep this email as your receipt. For billing support, reply to this message.</p></div><div style="padding:16px 32px;background:#f8fafc;color:#64748b;font-size:12px">LexAMS by LexoGraphix Plus</div></div></div>`,
  });

  if (result.error) throw new Error(result.error.message || 'Receipt email delivery failed');
  await db.query(`update billing_events set processing_status = 'processed', processed_at = now() where id = $1`, [receiptEventId]);
}

export default async (request: Request, context: Context) => {
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
      `select i.*, o.name as organization_name
       from billing_invoices i
       join organizations o on o.id = i.organization_id
       where i.id = $1 for update of i`,
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
    const receiptRecipient = validEmail(payload.customer_email)
      ? payload.customer_email
      : validEmail(invoice.metadata?.receipt_recipient)
        ? invoice.metadata.receipt_recipient
        : null;
    let receiptEventId: string | null = null;
    if (receiptRecipient) {
      const receiptEvent = await client.query(
        `insert into billing_events (provider, provider_event_id, event_type, processing_status, payload)
         values ('manual',$1,'receipt.send','received',$2::jsonb)
         on conflict (provider, provider_event_id) do nothing
         returning id`,
        [`receipt-${transaction.rows[0].id}`, JSON.stringify({ invoice_id: invoice.id, transaction_id: transaction.rows[0].id, recipient: receiptRecipient })]
      );
      receiptEventId = receiptEvent.rows[0]?.id || null;
    }
    await client.query(`update billing_events set processing_status = 'processed', processed_at = now() where id = $1`, [eventId]);
    await client.query('commit');
    if (receiptEventId && receiptRecipient) {
      context.waitUntil(
        sendReceipt({
          receiptEventId,
          receiptTo: receiptRecipient,
          organizationName: invoice.organization_name,
          billingCycle,
          amount: Number(invoice.amount),
          currency: invoice.currency,
          reference: payload.transaction_reference || invoice.internal_reference,
          paymentMethod: payload.payment_method || null,
          paidAt: new Date().toISOString(),
        }).catch(async error => {
          console.error('Receipt email delivery failed', error);
          await getPool().query(
            `update billing_events set processing_status = 'failed', processed_at = now(), error_message = $2 where id = $1`,
            [receiptEventId, error instanceof Error ? error.message.slice(0, 1000) : 'Receipt email delivery failed']
          ).catch(() => undefined);
        })
      );
    }
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
