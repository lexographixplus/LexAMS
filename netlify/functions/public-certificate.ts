import type { Config, Context } from '@netlify/functions';
import { getPool } from './_shared/db';

export default async (request: Request, context: Context) => {
  if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const token = context.params.token;
  if (!token) return Response.json({ error: 'Invalid certificate link' }, { status: 400 });

  const db = getPool();
  const result = await db.query(
    `select c.cert_no,c.certificate_type,c.certificate_kind,c.issued_date,c.award_title,c.award_category,
            c.award_period,c.citation,c.status,c.revoked_at,c.revoke_reason,
            coalesce(c.recipient_name,p.name) as participant_name,
            coalesce(a.title,c.metadata->>'activity_title') as activity_title,
            coalesce(a.venue,c.metadata->>'activity_venue') as venue,
            coalesce(a.facilitator,c.metadata->>'activity_facilitator') as facilitator,
            coalesce(a.start_date::text,c.metadata->>'activity_start_date') as start_date,
            coalesce(a.end_date::text,c.metadata->>'activity_end_date') as end_date,
            o.name as organization_name,o.logo_url as organization_logo
     from certificates c
     left join participants p on p.id=c.participant_id and p.organization_id=c.organization_id
     left join activities a on a.id=c.activity_id and a.organization_id=c.organization_id
     join organizations o on o.id=c.organization_id
     where c.access_token=$1
     limit 1`,
    [token]
  );
  if (!result.rowCount) return Response.json({ error: 'Certificate not found' }, { status: 404 });
  return Response.json({ certificate: result.rows[0] }, { headers: { 'cache-control': 'private, max-age=300' } });
};

export const config: Config = { path: '/api/public-certificate/:token' };
