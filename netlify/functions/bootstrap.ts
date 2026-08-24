import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';
import { requireTenant } from './_shared/tenant';

export default async (request: Request) => {
  if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const tenant = await requireTenant(request);
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getPool();
  const orgId = tenant.organization_id;

  const [activities, participants, registrations, attendance, certificates, surveys, assessments] = await Promise.all([
    db.query('select * from activities where organization_id = $1 order by start_date desc', [orgId]),
    db.query('select * from participants where organization_id = $1 order by name asc', [orgId]),
    db.query('select * from registrations where organization_id = $1', [orgId]),
    db.query('select * from attendance where organization_id = $1', [orgId]),
    db.query('select * from certificates where organization_id = $1 order by issued_date desc', [orgId]),
    db.query('select * from surveys where organization_id = $1 order by created_at desc', [orgId]),
    db.query('select * from assessments where organization_id = $1 order by created_at desc', [orgId]),
  ]);

  return Response.json({
    user: tenant.user,
    organization: {
      id: tenant.organization_id,
      name: tenant.organization_name,
      slug: tenant.slug,
      role: tenant.role,
    },
    activities: activities.rows,
    participants: participants.rows,
    registrations: registrations.rows,
    attendance: attendance.rows,
    certificates: certificates.rows,
    surveys: surveys.rows,
    assessments: assessments.rows,
  });
};

export const config: Config = { path: '/api/bootstrap' };
