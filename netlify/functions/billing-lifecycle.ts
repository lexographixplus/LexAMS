import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';

// This job only advances subscriptions whose recorded dates have already passed.
// It never deletes workspace or customer records.
export default async (request: Request) => {
  if (!['GET', 'POST'].includes(request.method)) return Response.json({ error: 'Method not allowed' }, { status: 405 });
  if (isPreviewDeployment(request)) return previewReadOnlyResponse();

  const db = getPool();
  const client = await db.connect();
  try {
    await client.query('begin');
    const trialsExpired = await client.query(
      `update organization_subscriptions
       set plan = 'free', status = 'active', billing_cycle = null,
           current_period_start = null, current_period_end = null, grace_period_end = null,
           cancel_at_period_end = false, updated_at = now()
       where plan = 'pro'
         and status = 'trialing'
         and trial_ends_at is not null
         and trial_ends_at <= now()
       returning id, organization_id, trial_ends_at`
    );
    const graceStarted = await client.query(
      `update organization_subscriptions
       set status = 'grace',
           grace_period_end = coalesce(current_period_end, now()) + interval '7 days',
           updated_at = now()
       where plan = 'pro'
         and status = 'active'
         and current_period_end is not null
         and current_period_end < now()
       returning id, organization_id, current_period_end, grace_period_end`
    );
    const expired = await client.query(
      `update organization_subscriptions
       set status = 'expired', updated_at = now()
       where plan = 'pro'
         and status = 'grace'
         and grace_period_end is not null
         and grace_period_end < now()
       returning id, organization_id, current_period_end, grace_period_end`
    );

    for (const subscription of trialsExpired.rows) {
      await client.query(
        `insert into billing_events (provider, event_type, processing_status, payload, processed_at)
         values ('manual', 'subscription.trial_expired', 'processed', $1::jsonb, now())`,
        [JSON.stringify({ organization_id: subscription.organization_id, subscription_id: subscription.id, trial_ends_at: subscription.trial_ends_at })]
      );
    }
    for (const subscription of graceStarted.rows) {
      await client.query(
        `insert into billing_events (provider, event_type, processing_status, payload, processed_at)
         values ('manual', 'subscription.grace_started', 'processed', $1::jsonb, now())`,
        [JSON.stringify({ organization_id: subscription.organization_id, subscription_id: subscription.id, grace_period_end: subscription.grace_period_end })]
      );
    }
    for (const subscription of expired.rows) {
      await client.query(
        `insert into billing_events (provider, event_type, processing_status, payload, processed_at)
         values ('manual', 'subscription.expired', 'processed', $1::jsonb, now())`,
        [JSON.stringify({ organization_id: subscription.organization_id, subscription_id: subscription.id, current_period_end: subscription.current_period_end })]
      );
    }
    await client.query('commit');
    return Response.json({ trial_expired: trialsExpired.rowCount || 0, grace_started: graceStarted.rowCount || 0, expired: expired.rowCount || 0 });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('Billing lifecycle job failed', error);
    return Response.json({ error: 'Billing lifecycle job failed' }, { status: 500 });
  } finally {
    client.release();
  }
};

export const config: Config = { schedule: '0 * * * *' };
