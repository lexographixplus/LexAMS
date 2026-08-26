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
}) {
  const { db, request, tenant, certificateId } = args;
  const snapshot = await getBillingSnapshot(db, tenant.organization_id);
  if (snapshot.subscription.plan !== 'pro') return { attempted: false, reason: 'pro_required' };

  const settings = await db.query(
    `select auto_send_certificates, reply_to_email
     from organization_communication_settings where organization_id=$1`,
    [tenant.organization_id]
  );
  if (!settings.rows[0]?.auto_send_certificates) return { attempted: false, reason: 'disabled' };

  const monthly = await db.query(
    `select count(*)::int as count from communication_deliveries
     where organization_id=$1 and created_at >= date_trunc('month', now())`,
    [tenant.organization_id]
  );
  if (Number(monthly.rows[0]?.count || 0) >= 5000) return { attempted: false, reason: 'monthly_limit' };

  const result = await db.query(
    `select c.id,c.cert_no,c.certificate_type,c.access_token,
            p.id as participant_id,p.name as participant_name,lower(p.email) as participant_email,
            a.id as activity_id,a.title as activity_title
     from certificates c
     join participants p on p.id=c.participant_id and p.organization_id=c.organization_id
     join activities a on a.id=c.activity_id and a.organization_id=c.organization_id
     where c.organization_id=$1 and c.id=$2
     limit 1`,
    [tenant.organization_id, certificateId]
  );
  const cert = result.rows[0];
  if (!cert) return { attempted: false, reason: 'certificate_not_found' };
  if (!validEmail(cert.participant_email)) return { attempted: false, reason: 'missing_email' };

  const suppressed = await db.query(
    `select reason from participant_email_suppressions
     where organization_id=$1 and lower(email)=lower($2)
     limit 1`,
    [tenant.organization_id, cert.participant_email]
  );
  if (suppressed.rowCount) return { attempted: false, reason: 'suppressed', suppressionReason: suppressed.rows[0].reason };

  const subject = `Your certificate — ${cert.activity_title}`;
  const message = await db.query(
    `insert into communication_messages (organization_id,activity_id,kind,subject,body,audience,created_by)
     values ($1,$2,'certificate',$3,'Automatic certificate delivery',$4::jsonb,$5) returning id`,
    [tenant.organization_id, cert.activity_id, subject, JSON.stringify({ certificateIds: [certificateId], automatic: true }), args.createdBy || tenant.user.id]
  );
  const messageId = Number(message.rows[0].id);

  const delivery = await db.query(
    `insert into communication_deliveries
     (organization_id,message_id,participant_id,certificate_id,recipient_name,recipient_email,status)
     values ($1,$2,$3,$4,$5,$6,'queued') returning id`,
    [tenant.organization_id, messageId, cert.participant_id, cert.id, cert.participant_name || '', cert.participant_email]
  );
  const deliveryId = Number(delivery.rows[0].id);

  try {
    const base = appBaseUrl(request);
    const sentResult = await sendEmailBatch([{
      to: cert.participant_email,
      subject,
      replyTo: settings.rows[0]?.reply_to_email || null,
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
