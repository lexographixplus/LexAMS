import type { Config } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { getPool } from './_shared/db';
import { getBillingSnapshot } from './_shared/billing';
import { requireTenant } from './_shared/tenant';

const PRICES = { monthly: 1000, annual: 10200 } as const;

function env(name: string) {
  return Netlify.env.get(name);
}

export default async (request: Request) => {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const tenant = await requireTenant(request);
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { billingCycle } = await request.json().catch(() => ({}));
  if (billingCycle !== 'monthly' && billingCycle !== 'annual') {
    return Response.json({ error: 'Select monthly or annual billing.' }, { status: 400 });
  }

  const apiKey = env('MODEM_PAY_API_KEY');
  if (!apiKey) {
    return Response.json({ error: 'Billing is not configured yet. Please contact LexAMS support.', code: 'BILLING_NOT_CONFIGURED' }, { status: 503 });
  }

  const db = getPool();
  const billing = await getBillingSnapshot(db, tenant.organization_id);
  const internalReference = `LEXAMS-${billingCycle.slice(0, 1).toUpperCase()}-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
  const amount = PRICES[billingCycle];
  const appUrl = env('APP_URL') || new URL(request.url).origin;
  const invoice = await db.query(
    `insert into billing_invoices (
       organization_id, subscription_id, provider, internal_reference, amount, currency, status,
       billing_period_start, billing_period_end, metadata
     ) values ($1,$2,'modempay',$3,$4,'GMD','pending',now(),now() + $5::interval,$6::jsonb)
     returning id`,
    [
      tenant.organization_id,
      billing.subscription.id,
      internalReference,
      amount,
      billingCycle === 'annual' ? '1 year' : '1 month',
      JSON.stringify({ organization_id: tenant.organization_id, billing_cycle: billingCycle }),
    ]
  );
  const invoiceId = invoice.rows[0].id;

  try {
    const response = await fetch('https://api.modempay.com/v1/payments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        data: {
          amount,
          currency: 'GMD',
          from_sdk: false,
          title: `LexAMS Pro — ${billingCycle === 'annual' ? 'Annual' : 'Monthly'} plan`,
          description: `LexAMS Pro subscription for ${tenant.organization_name}`,
          return_url: `${appUrl}/app/settings?billing=success`,
          cancel_url: `${appUrl}/app/settings?billing=cancelled`,
          metadata: {
            invoice_id: invoiceId,
            internal_reference: internalReference,
            organization_id: tenant.organization_id,
            billing_cycle: billingCycle,
          },
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    const intent = payload?.data;
    if (!response.ok || !intent?.payment_link) throw new Error(payload?.message || 'Modem Pay could not create a payment link.');

    await db.query(
      `update billing_invoices
       set provider_invoice_id = $2, payment_url = $3, metadata = metadata || $4::jsonb, updated_at = now()
       where id = $1`,
      [invoiceId, intent.intent_secret || intent.id || internalReference, intent.payment_link, JSON.stringify({ modem_intent: intent.intent_secret || intent.id || null })]
    );
    return Response.json({ checkoutUrl: intent.payment_link, invoiceId, billingCycle, amount, currency: 'GMD' });
  } catch (error) {
    await db.query(`update billing_invoices set status = 'failed', updated_at = now() where id = $1`, [invoiceId]);
    console.error('Modem Pay checkout creation failed', error);
    return Response.json({ error: 'Could not start checkout. Please try again or contact LexAMS support.' }, { status: 502 });
  }
};

export const config: Config = { path: '/api/billing/checkout' };
