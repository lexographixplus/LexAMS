import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';
import { requireTenant } from './_shared/tenant';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
}

export default async (request: Request) => {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  if (isPreviewDeployment(request)) return previewReadOnlyResponse();

  const tenant = await requireTenant(request);
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const fullName = String(body.fullName || '').trim();
  const orgName = String(body.orgName || '').trim();
  const db = getPool();

  if (fullName) {
    await db.query(
      `insert into profiles (user_id, full_name, active_organization_id)
       values ($1, $2, $3)
       on conflict (user_id) do update set full_name = excluded.full_name, active_organization_id = excluded.active_organization_id`,
      [tenant.user.id, fullName, tenant.organization_id]
    );
    await db.query('update users set name = $2 where id = $1', [tenant.user.id, fullName]);
  }

  if (orgName) {
    if (!['owner', 'admin'].includes(tenant.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const slug = `${slugify(orgName)}-${String(tenant.organization_id).slice(0, 8)}`;
    await db.query(
      'update organizations set name = $2, slug = $3, updated_at = now() where id = $1',
      [tenant.organization_id, orgName, slug]
    );
  }

  return Response.json({ ok: true });
};

export const config: Config = { path: '/api/onboarding' };
