import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';
import { assertCreationEntitlement } from './_shared/billing';
import { requireTenant } from './_shared/tenant';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (isPreviewDeployment(request)) return previewReadOnlyResponse();
  const tenant = await requireTenant(request);
  if (!tenant) return json({ error: 'Unauthorized.' }, 401);
  if (!['owner', 'admin'].includes(tenant.role)) return json({ error: 'Admin permission required.' }, 403);

  const body = await request.json().catch(() => ({})) as any;
  const p = body.participant || {};
  const name = String(p.name || '').trim().slice(0, 180);
  const email = String(p.email || '').trim().toLowerCase();
  if (!name || !validEmail(email)) return json({ error: 'Name and a valid email address are required.' }, 400);
  const activityIds = Array.isArray(body.activityIds)
    ? [...new Set(body.activityIds.map((id: unknown) => Number(id)).filter(Number.isSafeInteger))]
    : [];

  const db = getPool();
  const client = await db.connect();
  try {
    await client.query('begin');
    if (activityIds.length) {
      const validActivities = await client.query(
        `select id from activities where organization_id=$1 and id=any($2::bigint[])`,
        [tenant.organization_id, activityIds]
      );
      if (validActivities.rowCount !== activityIds.length) {
        await client.query('rollback');
        return json({ error: 'One or more selected activities are invalid.' }, 400);
      }
    }

    const duplicate = await client.query(
      `select id from participants where organization_id=$1 and lower(btrim(email))=$2 limit 1`,
      [tenant.organization_id, email]
    );
    if (duplicate.rowCount) {
      await client.query('rollback');
      return json({ error: 'A participant with this email already exists.' }, 409);
    }

    await assertCreationEntitlement(client as ReturnType<typeof getPool>, tenant.organization_id, 'participants', { organization_id: tenant.organization_id });
    const inserted = await client.query(
      `insert into participants (organization_id,name,email,phone,org,category)
       values ($1,$2,$3,$4,$5,$6)
       returning *`,
      [tenant.organization_id, name, email, String(p.phone || '').trim().slice(0, 80), String(p.org || '').trim().slice(0, 180), String(p.category || 'Community member').trim().slice(0, 80)]
    );
    const participant = inserted.rows[0];
    const registrations = [];
    for (const activityId of activityIds) {
      const reg = await client.query(
        `insert into registrations (organization_id,activity_id,participant_id,status,confirmed_at,reference_code)
         values ($1,$2,$3,'confirmed',now(),'REG-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)))
         on conflict (activity_id,participant_id) do update set registered_at=registrations.registered_at
         returning *`,
        [tenant.organization_id, activityId, participant.id]
      );
      registrations.push(reg.rows[0]);
    }
    await client.query('commit');
    return json({ ...participant, registrations }, 201);
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('Transactional participant creation failed', error);
    return json({ error: error instanceof Error ? error.message : 'Could not create participant.' }, 400);
  } finally {
    client.release();
  }
};

export const config: Config = {
  path: '/api/participant-create-v2',
  method: ['POST'],
};
