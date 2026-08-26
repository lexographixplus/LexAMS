import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';
import { getBillingSnapshot } from './_shared/billing';
import { requireTenant } from './_shared/tenant';
import { appBaseUrl, brandedEmail, sendEmailBatch } from './_shared/communications';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function validEmail(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function proRequired(snapshot: Awaited<ReturnType<typeof getBillingSnapshot>>) {
  return snapshot.subscription.plan !== 'pro';
}

async function bindProviderIds(
  db: ReturnType<typeof getPool>,
  deliveryIds: number[],
  providerIds: string[],
) {
  if (deliveryIds.length !== providerIds.length) throw new Error('Email provider delivery mapping is incomplete');
  for (let index = 0; index < deliveryIds.length; index += 1) {
    await db.query(
      `update communication_deliveries
       set provider_message_id=$2,status='sent',error_message=null,updated_at=now()
       where id=$1`,
      [deliveryIds[index], providerIds[index]]
    );
  }
}

export default async (request: Request) => {
  if (request.method === 'POST' && isPreviewDeployment(request)) return previewReadOnlyResponse();
  const tenant = await requireTenant(request);
  if (!tenant) return json({ error: 'Unauthorized' }, 401);

  const db = getPool();
  const orgId = tenant.organization_id;
  const snapshot = await getBillingSnapshot(db, orgId);

  if (request.method === 'GET') {
    const [settingsResult, historyResult] = await Promise.all([
      db.query(
        `select auto_send_certificates, reply_to_email, updated_at
         from organization_communication_settings where organization_id = $1`,
        [orgId]
      ),
      db.query(
        `select m.id,m.kind,m.subject,m.activity_id,m.audience,m.created_at,
                count(d.id)::int as recipients,
                count(*) filter (where d.status in ('sent','delivered'))::int as sent,
                count(*) filter (where d.status = 'delivered')::int as delivered,
                count(*) filter (where d.status in ('failed','bounced','complained','suppressed'))::int as failed,
                count(*) filter (where d.status = 'queued')::int as queued
         from communication_messages m
         left join communication_deliveries d on d.message_id = m.id
         where m.organization_id = $1
         group by m.id
         order by m.created_at desc
         limit 40`,
        [orgId]
      ),
    ]);
    return json({
      pro: snapshot.subscription.plan === 'pro',
      settings: settingsResult.rows[0] || { auto_send_certificates: false, reply_to_email: '' },
      history: historyResult.rows,
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (proRequired(snapshot)) return json({ error: 'Participant email and certificate delivery are available on LexAMS Pro.', code: 'PRO_REQUIRED' }, 403);
  if (!['owner', 'admin', 'programme_manager', 'facilitator', 'me_officer'].includes(tenant.role)) {
    return json({ error: 'Your role cannot send participant communications.' }, 403);
  }

  const body = await request.json().catch(() => ({})) as any;
  const action = String(body.action || '');

  if (action === 'save_settings') {
    if (!['owner', 'admin'].includes(tenant.role)) return json({ error: 'Admin permission required.' }, 403);
    const replyTo = String(body.replyToEmail || '').trim().toLowerCase();
    if (replyTo && !validEmail(replyTo)) return json({ error: 'Enter a valid reply-to email.' }, 400);
    const result = await db.query(
      `insert into organization_communication_settings
       (organization_id, auto_send_certificates, reply_to_email, updated_by, updated_at)
       values ($1,$2,$3,$4,now())
       on conflict (organization_id) do update
       set auto_send_certificates=excluded.auto_send_certificates,
           reply_to_email=excluded.reply_to_email,
           updated_by=excluded.updated_by,
           updated_at=now()
       returning auto_send_certificates, reply_to_email, updated_at`,
      [orgId, Boolean(body.autoSendCertificates), replyTo || null, tenant.user.id]
    );
    return json({ settings: result.rows[0] });
  }

  const settingsResult = await db.query(
    `select reply_to_email from organization_communication_settings where organization_id=$1`,
    [orgId]
  );
  const replyTo = settingsResult.rows[0]?.reply_to_email || null;
  const monthlyResult = await db.query(
    `select count(*)::int as count from communication_deliveries
     where organization_id=$1 and created_at >= date_trunc('month', now())`,
    [orgId]
  );
  const monthlyUsed = Number(monthlyResult.rows[0]?.count || 0);
  const monthlyLimit = 5000;

  if (action === 'send_announcement') {
    const subject = String(body.subject || '').trim();
    const messageBody = String(body.message || '').trim();
    if (!subject || !messageBody) return json({ error: 'Subject and message are required.' }, 400);
    if (subject.length > 180 || messageBody.length > 10000) return json({ error: 'Message is too long.' }, 400);

    const audience = body.audience && typeof body.audience === 'object' ? body.audience : {};
    const values: any[] = [orgId];
    const clauses = [
      'p.organization_id = $1',
      "p.email <> ''",
      `not exists (
        select 1 from participant_email_suppressions s
        where s.organization_id=$1 and lower(s.email)=lower(p.email)
      )`,
    ];
    if (audience.activityId && audience.activityId !== 'all') {
      values.push(Number(audience.activityId));
      clauses.push(`exists (select 1 from registrations r where r.organization_id=$1 and r.participant_id=p.id and r.activity_id=$${values.length})`);
    }
    if (audience.category && audience.category !== 'all') {
      values.push(String(audience.category));
      clauses.push(`p.category=$${values.length}`);
    }
    if (audience.organization && audience.organization !== 'all') {
      values.push(String(audience.organization));
      clauses.push(`coalesce(p.org,'')=$${values.length}`);
    }
    if (Array.isArray(audience.participantIds) && audience.participantIds.length) {
      const ids = [...new Set(audience.participantIds.map((id: unknown) => Number(id)).filter(Number.isSafeInteger))];
      values.push(ids);
      clauses.push(`p.id = any($${values.length}::bigint[])`);
    }

    const recipientsResult = await db.query(
      `select p.id,p.name,lower(p.email) as email from participants p
       where ${clauses.join(' and ')} order by p.name limit 1000`,
      values
    );
    const recipients = recipientsResult.rows.filter(row => validEmail(row.email));
    if (!recipients.length) return json({ error: 'No unsuppressed participants with valid email addresses match this audience.' }, 400);
    if (monthlyUsed + recipients.length > monthlyLimit) return json({ error: `This send would exceed the ${monthlyLimit.toLocaleString()} participant-email monthly fair-use limit.` }, 409);

    const client = await db.connect();
    let messageId: number;
    const deliveryIds: number[] = [];
    try {
      await client.query('begin');
      const inserted = await client.query(
        `insert into communication_messages (organization_id,activity_id,kind,subject,body,audience,created_by)
         values ($1,$2,'announcement',$3,$4,$5::jsonb,$6) returning id`,
        [orgId, audience.activityId && audience.activityId !== 'all' ? Number(audience.activityId) : null, subject, messageBody, JSON.stringify(audience), tenant.user.id]
      );
      messageId = inserted.rows[0].id;
      for (const recipient of recipients) {
        const delivery = await client.query(
          `insert into communication_deliveries
           (organization_id,message_id,participant_id,recipient_name,recipient_email,status)
           values ($1,$2,$3,$4,$5,'queued') returning id`,
          [orgId, messageId, recipient.id, recipient.name || '', recipient.email]
        );
        deliveryIds.push(Number(delivery.rows[0].id));
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    try {
      const emails = recipients.map(recipient => ({
        to: recipient.email,
        subject,
        replyTo,
        html: brandedEmail({
          organizationName: tenant.organization_name,
          logoUrl: tenant.organization_logo_url,
          preview: subject,
          heading: subject,
          body: `Hello ${recipient.name || 'Participant'},\n\n${messageBody}`,
        }),
      }));
      const sentResult = await sendEmailBatch(emails, `lexams-message-${messageId}`);
      await bindProviderIds(db, deliveryIds, sentResult.ids);
      return json({ ok: true, messageId, recipients: recipients.length });
    } catch (error: any) {
      await db.query(
        `update communication_deliveries
         set status='failed',error_message=$2,updated_at=now()
         where message_id=$1 and status='queued'`,
        [messageId, String(error?.message || 'Email delivery failed').slice(0, 500)]
      );
      return json({ error: error?.message || 'Email delivery failed', messageId }, 502);
    }
  }

  if (action === 'send_certificates') {
    const ids = Array.isArray(body.certificateIds)
      ? [...new Set(body.certificateIds.map((id: unknown) => Number(id)).filter(Number.isSafeInteger))].slice(0, 500)
      : [];
    if (!ids.length) return json({ error: 'Select at least one certificate.' }, 400);

    const certResult = await db.query(
      `select c.id,c.cert_no,c.certificate_type,c.issued_date,c.access_token,
              p.id as participant_id,p.name as participant_name,lower(p.email) as participant_email,
              a.id as activity_id,a.title as activity_title
       from certificates c
       join participants p on p.id=c.participant_id and p.organization_id=c.organization_id
       join activities a on a.id=c.activity_id and a.organization_id=c.organization_id
       where c.organization_id=$1
         and c.id = any($2::bigint[])
         and not exists (
           select 1 from participant_email_suppressions s
           where s.organization_id=c.organization_id and lower(s.email)=lower(p.email)
         )
       order by p.name`,
      [orgId, ids]
    );
    const certs = certResult.rows.filter(row => validEmail(row.participant_email));
    if (!certs.length) return json({ error: 'The selected certificate recipients do not have an unsuppressed valid email address.' }, 400);
    if (monthlyUsed + certs.length > monthlyLimit) return json({ error: `This send would exceed the ${monthlyLimit.toLocaleString()} participant-email monthly fair-use limit.` }, 409);

    const subject = certs.length === 1 ? `Your certificate — ${certs[0].activity_title}` : `Your certificate from ${tenant.organization_name}`;
    const messageResult = await db.query(
      `insert into communication_messages (organization_id,kind,subject,body,audience,created_by)
       values ($1,'certificate',$2,'Certificate delivery',$3::jsonb,$4) returning id`,
      [orgId, subject, JSON.stringify({ certificateIds: ids }), tenant.user.id]
    );
    const messageId = Number(messageResult.rows[0].id);
    const deliveryIds: number[] = [];
    for (const cert of certs) {
      const delivery = await db.query(
        `insert into communication_deliveries
         (organization_id,message_id,participant_id,certificate_id,recipient_name,recipient_email,status)
         values ($1,$2,$3,$4,$5,$6,'queued') returning id`,
        [orgId, messageId, cert.participant_id, cert.id, cert.participant_name || '', cert.participant_email]
      );
      deliveryIds.push(Number(delivery.rows[0].id));
    }

    const base = appBaseUrl(request);
    try {
      const sentResult = await sendEmailBatch(certs.map(cert => ({
        to: cert.participant_email,
        subject: `Your certificate — ${cert.activity_title}`,
        replyTo,
        html: brandedEmail({
          organizationName: tenant.organization_name,
          logoUrl: tenant.organization_logo_url,
          preview: `Your certificate for ${cert.activity_title}`,
          heading: 'Your certificate is ready',
          body: `Hello ${cert.participant_name || 'Participant'},\n\n${tenant.organization_name} has awarded you a ${String(cert.certificate_type || 'completion').replaceAll('_', ' ')} certificate for ${cert.activity_title}.\n\nCertificate number: ${cert.cert_no}`,
          ctaLabel: 'View & download certificate',
          ctaUrl: `${base}/certificate/${cert.access_token}`,
          footer: `This certificate was issued by ${tenant.organization_name} and delivered through LexAMS.`,
        }),
      })), `lexams-message-${messageId}`);
      await bindProviderIds(db, deliveryIds, sentResult.ids);
      return json({ ok: true, messageId, recipients: certs.length, skipped: ids.length - certs.length });
    } catch (error: any) {
      await db.query(
        `update communication_deliveries
         set status='failed',error_message=$2,updated_at=now()
         where message_id=$1 and status='queued'`,
        [messageId, String(error?.message || 'Email delivery failed').slice(0, 500)]
      );
      return json({ error: error?.message || 'Certificate delivery failed', messageId }, 502);
    }
  }

  return json({ error: 'Unsupported communications action.' }, 400);
};

export const config: Config = { path: '/api/communications' };
