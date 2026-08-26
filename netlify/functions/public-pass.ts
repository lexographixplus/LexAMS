import type { Config, Context } from '@netlify/functions';
import { getPool } from './_shared/db';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

export default async (request: Request, context: Context) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const token = context.params.token;
  if (!token) return json({ error: 'Invalid participant pass.' }, 400);
  const db = getPool();
  const participant = await db.query(
    `select p.id, p.name, p.pass_token, p.organization_id,
            o.name as organization_name, o.logo_url as organization_logo
     from participants p
     join organizations o on o.id=p.organization_id
     where p.pass_token=$1
     limit 1`,
    [token]
  );
  if (!participant.rowCount) return json({ error: 'Participant pass not found.' }, 404);
  const p = participant.rows[0];
  const registrations = await db.query(
    `select r.reference_code, r.status, r.registered_at,
            a.id as activity_id, a.title, a.type, a.venue, a.start_date, a.end_date
     from registrations r
     join activities a on a.id=r.activity_id and a.organization_id=r.organization_id
     where r.organization_id=$1 and r.participant_id=$2 and r.status<>'cancelled'
     order by a.start_date desc, r.registered_at desc
     limit 30`,
    [p.organization_id, p.id]
  );
  return json({
    participant: {
      name: p.name,
      pass_token: p.pass_token,
      organization_name: p.organization_name,
      organization_logo: p.organization_logo,
    },
    registrations: registrations.rows,
  });
};

export const config: Config = {
  path: '/api/public-pass/:token',
  method: ['GET'],
};
