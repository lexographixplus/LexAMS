import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';
import { requireTenant } from './_shared/tenant';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const tenant = await requireTenant(request);
  if (!tenant) return json({ error: 'Unauthorized' }, 401);
  const body = await request.json().catch(() => null) as any;
  if (body?.name !== 'next_cert_no') return json({ error: 'Unsupported RPC' }, 400);

  const db = getPool();
  const year = new Date().getFullYear();
  const result = await db.query(
    `select cert_no from certificates
     where organization_id = $1 and cert_no like $2
     order by id desc limit 1`,
    [tenant.organization_id, `LEX-${year}-%`]
  );
  const previous = result.rows[0]?.cert_no || '';
  const match = previous.match(/-(\d+)$/);
  const next = match ? Number(match[1]) + 1 : 1;
  return json({ data: `LEX-${year}-${String(next).padStart(4, '0')}` });
};

export const config: Config = { path: '/api/rpc' };
