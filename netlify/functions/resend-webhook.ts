import type { Config } from '@netlify/functions';
import { Resend } from 'resend';
import { getPool } from './_shared/db';
import { resendApiKey, resendWebhookSecret } from './_shared/communications';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';

// Deployment refresh after configuring the Resend webhook signing secret for production and deploy previews.
const STATUS_BY_EVENT: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'email.suppressed': 'suppressed',
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function errorMessage(event: any) {
  const data = event?.data || {};
  if (data?.bounce?.message) return String(data.bounce.message).slice(0, 500);
  if (typeof data?.error === 'string') return data.error.slice(0, 500);
  if (data?.error?.message) return String(data.error.message).slice(0, 500);
  if (data?.reason) return String(data.reason).slice(0, 500);
  if (['email.bounced', 'email.complained', 'email.failed', 'email.suppressed'].includes(event?.type)) {
    return String(event.type).replace('email.', 'Email ').replace('_', ' ');
  }
  return null;
}

function eventTimestamp(event: any) {
  const candidate = event?.created_at || event?.data?.created_at;
  const parsed = candidate ? new Date(candidate) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (isPreviewDeployment(request)) return previewReadOnlyResponse();

  const webhookSecret = resendWebhookSecret();
  if (!webhookSecret) {
    console.error('RESEND_WEBHOOK_SECRET is not configured');
    return json({ error: 'Webhook verification is not configured' }, 503);
  }

  const id = request.headers.get('svix-id') || '';
  const timestamp = request.headers.get('svix-timestamp') || '';
  const signature = request.headers.get('svix-signature') || '';
  if (!id || !timestamp || !signature) return json({ error: 'Missing webhook signature headers' }, 400);

  const payload = await request.text();
  let event: any;
  try {
    const resend = new Resend(resendApiKey());
    event = await resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    });
  } catch (error) {
    console.error('Invalid Resend webhook signature', error);
    return json({ error: 'Invalid webhook signature' }, 400);
  }

  const db = getPool();
  const emailId = String(event?.data?.email_id || '').trim() || null;

  const stored = await db.query(
    `insert into resend_webhook_events (event_id,event_type,email_id,payload)
     values ($1,$2,$3,$4::jsonb)
     on conflict (event_id) do nothing
     returning event_id`,
    [id, String(event?.type || 'unknown'), emailId, JSON.stringify(event)]
  );
  if (!stored.rowCount) return json({ ok: true, duplicate: true });

  const nextStatus = STATUS_BY_EVENT[String(event?.type || '')];
  if (!emailId || !nextStatus) return json({ ok: true, tracked: false });

  const delivery = await db.query(
    `select id,organization_id,recipient_email,status,provider_event_at
     from communication_deliveries
     where provider_message_id=$1
     limit 1`,
    [emailId]
  );
  if (!delivery.rowCount) return json({ ok: true, tracked: false });

  const row = delivery.rows[0];
  const message = errorMessage(event);
  const eventAt = eventTimestamp(event);
  const updated = await db.query(
    `update communication_deliveries
     set status=$2,
         error_message=case
           when $2 in ('sent','delivered') then null
           when $3::text is null then error_message
           else $3
         end,
         provider_event_at=$4::timestamptz,
         updated_at=now()
     where id=$1
       and (provider_event_at is null or provider_event_at <= $4::timestamptz)
     returning id`,
    [row.id, nextStatus, message, eventAt]
  );

  if (!updated.rowCount) return json({ ok: true, tracked: false, stale: true });

  if (['bounced', 'complained', 'suppressed'].includes(nextStatus)) {
    await db.query(
      `insert into participant_email_suppressions
       (organization_id,email,reason,source_event_id,created_at,updated_at)
       values ($1,lower($2),$3,$4,now(),now())
       on conflict (organization_id,email) do update
       set reason=excluded.reason,source_event_id=excluded.source_event_id,updated_at=now()`,
      [row.organization_id, row.recipient_email, nextStatus, id]
    );
  }

  return json({ ok: true, tracked: true, status: nextStatus });
};

export const config: Config = { path: '/api/webhooks/resend' };
