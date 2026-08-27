import type { Config } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { getPool } from './_shared/db';
import { getBillingSnapshot } from './_shared/billing';
import { maybeSendAwardedCertificate } from './_shared/certificate-delivery';
import { requireTenant } from './_shared/tenant';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';

function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'cache-control': 'no-store' } }); }
function clean(value: unknown, max = 500) { return String(value ?? '').trim().slice(0, max); }
function validEmail(value: unknown) { const email = clean(value, 320).toLowerCase(); return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''; }
function ids(value: unknown) { return Array.isArray(value) ? [...new Set(value.map(Number).filter(Number.isSafeInteger))].slice(0, 500) : []; }
function certificateNumber(kind: string, id: number, issuedDate?: string) {
  const year = /^\d{4}-/.test(String(issuedDate || '')) ? String(issuedDate).slice(0, 4) : String(new Date().getFullYear());
  return `LEX-${kind === 'standalone' ? 'REC' : 'AWD'}-${year}-${String(id).padStart(5, '0')}`;
}

export default async (request: Request) => {
  if (request.method === 'POST' && isPreviewDeployment(request)) return previewReadOnlyResponse();
  const tenant = await requireTenant(request);
  if (!tenant) return json({ error: 'Unauthorized' }, 401);

  const db = getPool();
  const orgId = tenant.organization_id;
  const snapshot = await getBillingSnapshot(db, orgId);
  const pro = snapshot.subscription.plan === 'pro';
  const canManage = ['owner', 'admin', 'programme_manager', 'facilitator', 'me_officer'].includes(tenant.role);
  const isAdmin = ['owner', 'admin'].includes(tenant.role);

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const requestedActivityId = Number(url.searchParams.get('activityId'));
    const values: unknown[] = [orgId];
    const activityFilter = Number.isSafeInteger(requestedActivityId) ? `and c.activity_id=$${values.push(requestedActivityId)}` : '';
    const [templates, awards] = await Promise.all([
      db.query(`select id,name,certificate_title,category,citation_template,active,created_at,updated_at from award_templates where organization_id=$1 order by active desc,lower(name)`, [orgId]),
      db.query(
        `select c.id,c.cert_no,c.certificate_kind,c.certificate_type,c.issued_date,c.access_token,
                c.activity_id,c.participant_id,c.award_title,c.award_category,c.award_period,c.citation,
                c.recipient_name,c.recipient_email,c.template_id,c.status,c.revoked_at,c.revoke_reason,
                c.reissued_from_id,c.created_at,
                coalesce(c.recipient_name,p.name) as display_recipient_name,
                coalesce(c.recipient_email,lower(p.email)) as display_recipient_email,
                coalesce(a.title,c.metadata->>'activity_title') as activity_title,
                coalesce(a.venue,c.metadata->>'activity_venue') as activity_venue
         from certificates c
         left join participants p on p.id=c.participant_id and p.organization_id=c.organization_id
         left join activities a on a.id=c.activity_id and a.organization_id=c.organization_id
         where c.organization_id=$1 and c.certificate_kind in ('award','standalone') ${activityFilter}
         order by c.issued_date desc,c.id desc limit 1000`, values),
    ]);
    return json({ pro, templates: templates.rows, awards: awards.rows });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!canManage) return json({ error: 'Your role cannot manage awards.' }, 403);
  if (!pro) return json({ error: 'Awards & Recognition is available on LexAMS Pro.', code: 'PRO_REQUIRED' }, 403);

  const body = await request.json().catch(() => ({})) as any;
  const action = clean(body.action, 60);

  if (action === 'create_template' || action === 'update_template') {
    const name = clean(body.name, 120);
    const certificateTitle = clean(body.certificateTitle || name, 180);
    const category = clean(body.category, 120) || null;
    const citationTemplate = clean(body.citationTemplate, 2000) || null;
    if (!name || !certificateTitle) return json({ error: 'Template name and certificate title are required.' }, 400);
    if (action === 'create_template') {
      const result = await db.query(
        `insert into award_templates (organization_id,name,certificate_title,category,citation_template,created_by) values ($1,$2,$3,$4,$5,$6) returning *`,
        [orgId, name, certificateTitle, category, citationTemplate, tenant.user.id]
      ).catch((error: any) => { if (String(error?.code) === '23505') return null; throw error; });
      return result ? json({ template: result.rows[0] }, 201) : json({ error: 'An award template with this name already exists.' }, 409);
    }
    const templateId = Number(body.templateId);
    if (!Number.isSafeInteger(templateId)) return json({ error: 'Invalid template.' }, 400);
    const result = await db.query(`update award_templates set name=$3,certificate_title=$4,category=$5,citation_template=$6,updated_at=now() where id=$1 and organization_id=$2 returning *`, [templateId, orgId, name, certificateTitle, category, citationTemplate]);
    return result.rowCount ? json({ template: result.rows[0] }) : json({ error: 'Template not found.' }, 404);
  }

  if (action === 'set_template_active') {
    const templateId = Number(body.templateId);
    if (!Number.isSafeInteger(templateId)) return json({ error: 'Invalid template.' }, 400);
    const result = await db.query(`update award_templates set active=$3,updated_at=now() where id=$1 and organization_id=$2 returning *`, [templateId, orgId, Boolean(body.active)]);
    return result.rowCount ? json({ template: result.rows[0] }) : json({ error: 'Template not found.' }, 404);
  }

  if (action === 'issue_award') {
    const participantIds = ids(body.participantIds);
    const manualRecipients = Array.isArray(body.manualRecipients)
      ? body.manualRecipients.slice(0, 500).map((row: any) => ({ name: clean(row?.name, 180), email: validEmail(row?.email) })).filter((row: any) => row.name)
      : [];
    if (!participantIds.length && !manualRecipients.length) return json({ error: 'Select at least one recipient.' }, 400);

    const activityId = body.activityId ? Number(body.activityId) : null;
    const templateId = body.templateId ? Number(body.templateId) : null;
    if (body.templateId && !Number.isSafeInteger(templateId)) return json({ error: 'Invalid template.' }, 400);
    const awardTitle = clean(body.awardTitle, 180);
    const awardCategory = clean(body.awardCategory, 120) || null;
    const awardPeriod = clean(body.awardPeriod, 160) || null;
    const citation = clean(body.citation, 2000) || null;
    const certificateType = clean(body.certificateType || 'recognition', 60) || 'recognition';
    const issuedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.issuedDate || '')) ? String(body.issuedDate) : new Date().toISOString().slice(0, 10);
    const kind = activityId ? 'award' : 'standalone';
    if (!awardTitle) return json({ error: 'Award title is required.' }, 400);

    let activityContext: any = null;
    if (activityId) {
      if (!Number.isSafeInteger(activityId)) return json({ error: 'Invalid activity.' }, 400);
      const activity = await db.query(`select id,title,venue,facilitator,start_date,end_date from activities where id=$1 and organization_id=$2`, [activityId, orgId]);
      if (!activity.rowCount) return json({ error: 'Activity not found.' }, 404);
      activityContext = activity.rows[0];
    }
    if (templateId) {
      const template = await db.query(`select id from award_templates where id=$1 and organization_id=$2 and active=true`, [templateId, orgId]);
      if (!template.rowCount) return json({ error: 'Award template not found or inactive.' }, 404);
    }

    const participantRows = participantIds.length
      ? await db.query(`select id,name,lower(nullif(btrim(email),'')) as email from participants where organization_id=$1 and id=any($2::bigint[]) order by name`, [orgId, participantIds])
      : { rows: [] as any[] };
    if (participantRows.rows.length !== participantIds.length) return json({ error: 'One or more selected participants are invalid.' }, 400);
    const recipients = [
      ...participantRows.rows.map((row: any) => ({ participantId: Number(row.id), name: row.name, email: row.email || null })),
      ...manualRecipients.map((row: any) => ({ participantId: null, name: row.name, email: row.email || null })),
    ];
    const activitySnapshot = activityContext ? {
      activity_title: activityContext.title,
      activity_venue: activityContext.venue,
      activity_facilitator: activityContext.facilitator,
      activity_start_date: activityContext.start_date,
      activity_end_date: activityContext.end_date,
    } : {};

    const client = await db.connect();
    const created: any[] = [];
    try {
      await client.query('begin');
      for (const recipient of recipients) {
        const inserted = await client.query(
          `insert into certificates
           (organization_id,cert_no,activity_id,participant_id,certificate_type,issued_date,issued_by,certificate_kind,
            award_title,award_category,award_period,citation,recipient_name,recipient_email,template_id,metadata)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb) returning *`,
          [orgId, `PENDING-${randomUUID()}`, activityId, recipient.participantId, certificateType, issuedDate, tenant.user.id,
           kind, awardTitle, awardCategory, awardPeriod, citation, recipient.name, recipient.email, templateId,
           JSON.stringify({ source: 'awards_recognition', ...activitySnapshot })]
        );
        const cert = inserted.rows[0];
        const updated = await client.query(`update certificates set cert_no=$2 where id=$1 returning *`, [cert.id, certificateNumber(kind, Number(cert.id), issuedDate)]);
        created.push(updated.rows[0]);
      }
      await client.query(`insert into audit_log (organization_id,user_id,action,entity_type,entity_id,metadata) values ($1,$2,'award.issue','certificate',null,$3::jsonb)`, [orgId, tenant.user.id, JSON.stringify({ count: created.length, awardTitle, activityId, templateId })]);
      await client.query('commit');
    } catch (error) { await client.query('rollback').catch(() => undefined); throw error; }
    finally { client.release(); }

    const delivery = [] as any[];
    for (const cert of created) {
      try { delivery.push(await maybeSendAwardedCertificate({ db, request, tenant, certificateId: Number(cert.id), createdBy: tenant.user.id })); }
      catch (error) { console.error('Automatic award certificate delivery failed', { certificateId: cert.id, error }); delivery.push({ attempted: true, sent: false }); }
    }
    return json({ certificates: created, delivery }, 201);
  }

  if (action === 'revoke') {
    const certificateId = Number(body.certificateId);
    const reason = clean(body.reason, 500);
    if (!Number.isSafeInteger(certificateId) || !reason) return json({ error: 'Certificate and revocation reason are required.' }, 400);
    const result = await db.query(`update certificates set status='revoked',revoked_at=now(),revoked_by=$3,revoke_reason=$4 where id=$1 and organization_id=$2 and certificate_kind in ('award','standalone') and status='active' returning *`, [certificateId, orgId, tenant.user.id, reason]);
    if (!result.rowCount) return json({ error: 'Active award certificate not found.' }, 404);
    await db.query(`insert into audit_log (organization_id,user_id,action,entity_type,entity_id,metadata) values ($1,$2,'award.revoke','certificate',$3,$4::jsonb)`, [orgId, tenant.user.id, String(certificateId), JSON.stringify({ reason })]);
    return json({ certificate: result.rows[0] });
  }

  if (action === 'reissue') {
    if (!isAdmin) return json({ error: 'Admin permission required to reissue an award.' }, 403);
    const certificateId = Number(body.certificateId);
    if (!Number.isSafeInteger(certificateId)) return json({ error: 'Invalid certificate.' }, 400);
    const oldResult = await db.query(`select * from certificates where id=$1 and organization_id=$2 and certificate_kind in ('award','standalone') limit 1`, [certificateId, orgId]);
    if (!oldResult.rowCount) return json({ error: 'Award certificate not found.' }, 404);
    const old = oldResult.rows[0];
    const client = await db.connect();
    let replacement: any;
    try {
      await client.query('begin');
      await client.query(`update certificates set status='superseded',revoked_at=coalesce(revoked_at,now()),revoked_by=$2,revoke_reason=coalesce(revoke_reason,'Reissued') where id=$1`, [certificateId, tenant.user.id]);
      const inserted = await client.query(
        `insert into certificates
         (organization_id,cert_no,activity_id,participant_id,certificate_type,issued_date,issued_by,certificate_kind,
          award_title,award_category,award_period,citation,recipient_name,recipient_email,template_id,reissued_from_id,metadata)
         values ($1,$2,$3,$4,$5,current_date,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb) returning *`,
        [orgId, `PENDING-${randomUUID()}`, old.activity_id, old.participant_id, old.certificate_type, tenant.user.id, old.certificate_kind,
         old.award_title, old.award_category, old.award_period, old.citation, old.recipient_name, old.recipient_email,
         old.template_id, old.id, JSON.stringify({ ...(old.metadata || {}), reissued: true })]
      );
      const cert = inserted.rows[0];
      replacement = (await client.query(`update certificates set cert_no=$2 where id=$1 returning *`, [cert.id, certificateNumber(old.certificate_kind, Number(cert.id))])).rows[0];
      await client.query('commit');
    } catch (error) { await client.query('rollback').catch(() => undefined); throw error; }
    finally { client.release(); }
    return json({ certificate: replacement });
  }

  return json({ error: 'Unsupported awards action.' }, 400);
};

export const config: Config = { path: '/api/awards' };
