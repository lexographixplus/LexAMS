import type { Config } from '@netlify/functions';
import { requireTenant } from './_shared/tenant';

export default async (request: Request) => {
  if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const tenant = await requireTenant(request);
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  return Response.json({
    user: tenant.user,
    profile: {
      id: tenant.user.id,
      full_name: tenant.profile_full_name || tenant.user.name || tenant.user.email,
      org_name: tenant.organization_name,
      logo_url: tenant.organization_logo_url,
      role: tenant.role,
      team_role: ['owner', 'admin'].includes(tenant.role) ? 'admin' : 'member',
      team_id: tenant.organization_id,
    },
    organization: {
      id: tenant.organization_id,
      name: tenant.organization_name,
      slug: tenant.slug,
      logo_url: tenant.organization_logo_url,
      role: tenant.role,
    },
  });
};

export const config: Config = { path: '/api/me' };
