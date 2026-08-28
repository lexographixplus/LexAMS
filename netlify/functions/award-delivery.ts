import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';
import { maybeSendAwardedCertificate } from './_shared/certificate-delivery';
import { requireTenant } from './_shared/tenant';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';
import { recognitionSql } from './_shared/recognition';

export default async (request: Request) => {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  if (isPreviewDeployment(request)) return previewReadOnlyResponse();
  const tenant = await requireTenant(request);
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin', 'programme_manager', 'facilitator', 'me_officer'].includes(tenant.role)) {
    return Response.json({ error: 'Your role cannot send award certificates.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as any;
  const ids = Array.isArray(body.certificateIds)
    ? [...new Set(body.certificateIds.map(Number).filter(Number.isSafeInteger))].slice(0, 500)
    : [];
  if (!ids.length) return Response.json({ error: 'Select at least one award certificate.' }, { status: 400 });

  const db = getPool();
  const owned = await db.query(
    `select c.id from certificates c
     where c.organization_id=$1 and c.id=any($2::bigint[])
       and ${recognitionSql('c')}`,
    [tenant.organization_id, ids]
  );
  if (owned.rowCount !== ids.length) return Response.json({ error: 'One or more award certificates are invalid.' }, { status: 400 });

  let sent = 0;
  const skipped: Array<{ id: number; reason: string }> = [];
  for (const id of ids) {
    const result = await maybeSendAwardedCertificate({
      db,
      request,
      tenant,
      certificateId: id,
      createdBy: tenant.user.id,
      force: true,
    });
    if (result.sent) sent += 1;
    else skipped.push({ id, reason: String(result.reason || result.error || 'not_sent') });
  }

  return Response.json({ ok: true, requested: ids.length, sent, skipped });
};

export const config: Config = { path: '/api/award-delivery' };
