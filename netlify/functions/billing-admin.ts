import type { Config } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { getPool } from './_shared/db';
import { ensureFreeSubscription, requirePlatformAdmin } from './_shared/billing';
import { requireUser } from './_shared/session';

const PRICE_BY_CYCLE = { monthly: 1000, annual: 10200 } as const;
type BillingCycle = keyof typeof PRICE_BY_CYCLE;

function validCycle(value: unknown): value is BillingCycle {
  return value === 'monthly' || value === 'annual';
}

function validPlan(value: unknown) {
  return value === 'free' || value === 'pro';
}

function validStatus(value: unknown) {
  return ['active', 'grace', 'past_due', 'cancelled', 'expired'].includes(String(value));
}

function asDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function requireBillingAdmin(request: Request) {
  const user = await requireUser(request);
  if (!user) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  const role = await requirePlatformAdmin(getPool(), user.id);
  if (!role) return { error: Response.json({ error: 'Platform administrator access is required' }, { status: 403 }) };
  return { user, role };
}

async function audit(client: any, organizationId: string, actorUserId: string, action: string, reason: string, before: any, after: any) {
  await client.query(
    `insert into billing_admin_audit_log (organization_id, actor_user_id, action, reason, before_state, after_state)
     values ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
    [organizationId, actorUserId, action, reason, JSON.stringify(before || {}), JSON.stringify(after || {})]
  );
}

async function subscriptionForUpdate(client: any, organizationId: string) {
  await ensureFreeSubscription(client, organizationId);
  const result = await client.query('select * from organization_subscriptions where organization_id = $1 for update', [organizationId]);
  return result.rows[0];
}

export default async (request: Request) => {
  const access = await requireBillingAdmin(request);
  if ('error' in access) return access.error;
  const db = getPool();

  if (request.method === 'GET') {
    const [summary, subscriptions, invoices, auditLog] = await Promise.all([
      db.query(`select count(*) filter (where plan = 'pro' and status in ('active', 'grace'))::int as pro_organizations,
                       count(*) filter (where plan = 'free')::int as free_organizations,
                       count(*) filter (where status = 'grace')::int as in_grace,
                       count(*) filter (where status in ('expired', 'past_due'))::int as expired_or_past_due
                from organization_subscriptions`),
      db.query(`select s.organization_id, o.name as organization_name, s.plan, s.status, s.billing_cycle,
                       s.current_period_end, s.grace_period_end, s.provider, s.cancel_at_period_end, s.updated_at
                from organization_subscriptions s join organizations o on o.id = s.organization_id
                order by s.updated_at desc limit 100`),
      db.query(`select i.id, i.organization_id, o.name as organization_name, i.internal_reference, i.amount, i.currency,
                       i.status, i.paid_at, i.created_at
                from billing_invoices i join organizations o on o.id = i.organization_id
                order by i.created_at desc limit 50`),
      db.query(`select l.id, l.organization_id, o.name as organization_name, l.action, l.reason, l.created_at,
                       coalesce(p.full_name, u.name, u.email) as actor_name
                from billing_admin_audit_log l
                join organizations o on o.id = l.organization_id
                join users u on u.id = l.actor_user_id
                left join profiles p on p.user_id = u.id
                order by l.created_at desc limit 30`),
    ]);
    return Response.json({ role: access.role.role, summary: summary.rows[0], subscriptions: subscriptions.rows, invoices: invoices.rows, audit_log: auditLog.rows });
  }

  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  let body: any;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'A valid JSON request is required' }, { status: 400 }); }
  const action = String(body?.action || '');
  const organizationId = String(body?.organizationId || '');
  const reason = String(body?.reason || '').trim();
  if (!organizationId || !reason) return Response.json({ error: 'Organization and an audit reason are required' }, { status: 400 });

  const client = await db.connect();
  try {
    await client.query('begin');
    const organization = await client.query('select id from organizations where id = $1', [organizationId]);
    if (!organization.rowCount) throw new Error('Organization not found');
    const before = await subscriptionForUpdate(client, organizationId);
    let after: any;

    if (action === 'set_subscription') {
      if (!validPlan(body.plan) || !validStatus(body.status)) throw new Error('A valid plan and status are required');
      const billingCycle = validCycle(body.billingCycle) ? body.billingCycle : null;
      const currentPeriodEnd = asDate(body.currentPeriodEnd);
      const gracePeriodEnd = asDate(body.gracePeriodEnd);
      if (body.currentPeriodEnd && !currentPeriodEnd) throw new Error('Current period end is invalid');
      if (body.gracePeriodEnd && !gracePeriodEnd) throw new Error('Grace period end is invalid');
      const result = await client.query(
        `update organization_subscriptions
         set plan = $2, status = $3, billing_cycle = $4, current_period_end = $5,
             grace_period_end = $6, provider = coalesce($7, provider),
             cancel_at_period_end = coalesce($8, cancel_at_period_end), updated_at = now()
         where organization_id = $1 returning *`,
        [organizationId, body.plan, body.status, billingCycle, currentPeriodEnd, gracePeriodEnd,
          ['manual', 'complimentary', 'modempay'].includes(body.provider) ? body.provider : null,
          typeof body.cancelAtPeriodEnd === 'boolean' ? body.cancelAtPeriodEnd : null]
      );
      after = result.rows[0];
    } else if (action === 'grant_complimentary_pro') {
      const durationDays = Number(body.durationDays);
      if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 366) throw new Error('Complimentary duration must be between 1 and 366 days');
      const result = await client.query(
        `update organization_subscriptions
         set plan = 'pro', status = 'active', provider = 'complimentary', billing_cycle = null,
             current_period_start = greatest(coalesce(current_period_end, now()), now()),
             current_period_end = greatest(coalesce(current_period_end, now()), now()) + ($2 || ' days')::interval,
             grace_period_end = null, cancel_at_period_end = false, updated_at = now()
         where organization_id = $1 returning *`,
        [organizationId, durationDays]
      );
      after = result.rows[0];
    } else if (action === 'record_manual_payment') {
      if (!validCycle(body.billingCycle)) throw new Error('A monthly or annual billing cycle is required');
      const amount = PRICE_BY_CYCLE[body.billingCycle];
      const invoiceReference = `MAN-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
      const paymentReference = `manual-${randomUUID()}`;
      const interval = body.billingCycle === 'annual' ? '1 year' : '1 month';
      const invoice = await client.query(
        `insert into billing_invoices (organization_id, subscription_id, provider, internal_reference, amount, currency, status, paid_at, metadata)
         values ($1,$2,'manual',$3,$4,'GMD','paid',now(),$5::jsonb) returning *`,
        [organizationId, before.id, invoiceReference, amount, JSON.stringify({ billing_cycle: body.billingCycle, recorded_by: access.user.id })]
      );
      await client.query(
        `insert into billing_transactions (organization_id, invoice_id, provider, provider_transaction_id, amount, currency, status, payment_method, provider_reference, paid_at)
         values ($1,$2,'manual',$3,$4,'GMD','paid',$5,$6,now())`,
        [organizationId, invoice.rows[0].id, paymentReference, amount, String(body.paymentMethod || 'manual'), String(body.paymentReference || '') || null]
      );
      const result = await client.query(
        `update organization_subscriptions
         set plan = 'pro', status = 'active', billing_cycle = $2, provider = 'manual', cancel_at_period_end = false,
             current_period_start = greatest(coalesce(current_period_end, now()), now()),
             current_period_end = greatest(coalesce(current_period_end, now()), now()) + $3::interval,
             grace_period_end = null, updated_at = now()
         where organization_id = $1 returning *`,
        [organizationId, body.billingCycle, interval]
      );
      after = result.rows[0];
    } else {
      throw new Error('Unsupported billing action');
    }

    await audit(client, organizationId, access.user.id, action, reason, before, after);
    await client.query(
      `insert into billing_events (provider, event_type, processing_status, payload, processed_at)
       values ($1,$2,'processed',$3::jsonb,now())`,
      [after.provider === 'complimentary' ? 'complimentary' : 'manual', `admin.${action}`, JSON.stringify({ organization_id: organizationId, actor_user_id: access.user.id, reason })]
    );
    await client.query('commit');
    return Response.json({ subscription: after });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    const message = error instanceof Error ? error.message : 'Billing action could not be completed';
    return Response.json({ error: message }, { status: message === 'Organization not found' ? 404 : 400 });
  } finally {
    client.release();
  }
};

export const config: Config = { path: '/api/billing/admin' };
