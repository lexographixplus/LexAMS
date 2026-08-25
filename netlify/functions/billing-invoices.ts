import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';
import { requireTenant } from './_shared/tenant';

export default async (request: Request) => {
  if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const tenant = await requireTenant(request);
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await getPool().query(
    `select id, internal_reference, amount, currency, status, due_at, payment_url,
            billing_period_start, billing_period_end, paid_at, created_at
     from billing_invoices where organization_id = $1 order by created_at desc limit 100`,
    [tenant.organization_id]
  );
  return Response.json({ invoices: result.rows });
};

export const config: Config = { path: '/api/billing/invoices' };
