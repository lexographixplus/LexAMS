import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';
import { getBillingSnapshot } from './_shared/billing';
import { requireTenant } from './_shared/tenant';

export default async (request: Request) => {
  if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const tenant = await requireTenant(request);
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const snapshot = await getBillingSnapshot(getPool(), tenant.organization_id);
  return Response.json(snapshot);
};

export const config: Config = { path: '/api/billing/plan' };
