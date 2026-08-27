import { getBillingSnapshot } from './billing';
import { appBaseUrl, brandedEmail, sendEmailBatch } from './communications';

type Queryable = { query: (...args: any[]) => Promise<any> };

type TenantLike = {
  organization_id: string;
  organization_name: string;
  organization_logo_url?: string | null;
  user: { id: string };
};

function validEmail(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export async function maybeSendAwardedCertificate(args: {
  db: Queryable;
  request: Request;
  tenant: TenantLike;
  certificateId: number;
  createdBy?: string | null;
  force?: boolean;
}) {
  const { db, request, tenant, certificateId } = args;
  const snapshot = await getBillingSnapshot(db, tenant.organization_id);
  if (snapshot.subscription.plan !== 'pro') return { attempted: false, reason: 'pro_required' };

  const settings = await db.query(
    `select auto_send_certificates, reply_to_email
     from organization_communication_settings where organization_id=$1`,
    [tenant.organization_id]
  );
  if (!args.force && !settings.rows[0]?.auto_send_certificates) return { attempted: false, reason: 'disabled' };

  const monthly = await db.query(
    `select count(*)::int as count from communication_deliveries
     where organization_id=$1 and created_at >= date_trunc('month', now())`,
    [tenant.organization_id]
  );
  if (Number(monthly.rows[0]?.count || 0) >= 5000) return { attempted: false, reason: 'monthly_limit' };

  const result = await db.query(
    `select c.id,c.cert_no,c.certificate_type,c.certificate_kind,c.access_token,c.award_title,c.award_period,
            c.status,c.participant_id,c.activity_id,
            coalesce(c.recipient_name,p.name) as participant_name,
            lower(coalesce(nullif(c.recipient_email,''),nullif(p.email,''))) as participant_email,
            a.title as activity_title
     from certificates c
     left join participants p on p.id=c.participant_id and p.organization_id=c.organization_id
     left join activities a on a.id=c.activity_id and a.organization_id=c.organization_id
     where c.organization_id=$1 and c.id=$2
     limit 1`,
    [tenant.organization_id, certificateId]
  );
  const cert = result.rows[0];
  if (!cert) return { attempted: false, reason: 'certificate_not_found' };
  if (cert.status && cert.status !== 'active') return { attempted: false, reason: 'certificate_inactive' };
  if (!validEmail(cert.participant_email)) return { attempted: false, reason: 'missing_email' };

  const suppressed = await db.query(
    `select reason from participant_email_suppressions
     where organization_id=$1 and lower(email)=lower($2)
     limit 1`,
    [tenant.organization_id, cert.participant_email]
  );
  if (suppressed.rowCount) return { attempted: false, reason: 'suppressed', suppressionReason: suppressed.rows[0].reason };

  const descriptor = cert.award_title || cert.activity_title || 'your certificate';
  const subject = cert.certificate_kind === 'award' || cert.certificate_kind === 'standalone'
    ? `Your award — ${descriptor}`
    : `Your certificate — ${descriptor}`;
  const message = await db.query(
    `insert into communication_messages (organization_id,activity_id,kind,subject,body,audience,created_by)
     values ($1,$2,'certificate',$3,$4,$5::jsonb,$6) returning id`,
    [tenant.organization_id, cert.activity_id || null, subject, args.force ? 'Manual certificate delivery' : 'Automatic certificate delivery', JSON.stringify({ certificateIds: [certificateId], automatic: !args.force }), args.createdBy || tenant.user.id]
  );
  const messageId = Number(message.rows[0].id);

  const delivery = await db.query(
    `insert into communication_deliveries
     (organization_id,message_id,participant_id,certificate_id,recipient_name,recipient_email,status)
     values ($1,$2,$3,$4,$5,$6,'queued') returning id`,
    [tenant.organization_id, messageId, cert.participant_id || null, cert.id, cert.participant_name || '', cert.participant_email]
  );
  const deliveryId = Number(delivery.rows[0].id);

  try {
    const base = appBaseUrl(request);
    const isAward = cert.certificate_kind === 'award' || cert.certificate_kind === 'standalone';
    const contextLine = cert.activity_title ? ` during ${cert.activity_title}` : '';
    const periodLine = cert.award_period ? ` (${cert.award_period})` : '';
    const sentResult = await sendEmailBatch([{
      to: cert.participant_email,
      subject,
      replyTo: settings.rows[0]?.reply_to_email || null,
      html: brandedEmail({
        organizationName: tenant.organization_name,
        logoUrl: tenant.organization_logo_url,
        preview: isAward ? `You have received ${descriptor}` : `Your certificate for ${descriptor}`,
        heading: isAward ? 'You have received an award' : 'Your certificate is ready',
        body: `Hello ${cert.participant_name || 'Recipient'},\n\n${tenant.organization_name} has awarded you ${isAward ? descriptor : `a ${String(cert.certificate_type || 'completion').replaceAll('_', ' ')} certificate`}${contextLine}${periodLine}.\n\nCertificate number: ${cert.cert_no}`,
        ctaLabel: 'View & download certificate',
        ctaUrl: `${base}/certificate/${cert.access_token}`,
        footer: `This certificate was issued by ${tenant.organization_name} and delivered through LexAMS.`,
      }),
    }], `lexams-message-${messageId}`);
    const providerMessageId = sentResult.ids[0];
    if (!providerMessageId) throw new Error('Email provider did not return a delivery id');
    await db.query(
      `update communication_deliveries
       set status='sent',provider_message_id=$2,error_message=null,updated_at=now()
       where id=$1`,
      [deliveryId, providerMessageId]
    );
    return { attempted: true, sent: true, messageId, providerMessageId };
  } catch (error: any) {
    const messageText = String(error?.message || 'Certificate delivery failed').slice(0, 500);
    await db.query(
      `update communication_deliveries set status='failed',error_message=$2,updated_at=now() where id=$1`,
      [deliveryId, messageText]
    );
    return { attempted: true, sent: false, messageId, error: messageText };
  }
}
