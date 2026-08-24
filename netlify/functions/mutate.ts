import type { Config } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { getPool } from './_shared/db';
import { requireTenant } from './_shared/tenant';

export default async (request: Request) => {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const tenant = await requireTenant(request);
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, payload = {} } = await request.json().catch(() => ({}));
  const db = getPool();
  const orgId = tenant.organization_id;
  const userId = tenant.user.id;
  const isAdmin = ['owner', 'admin'].includes(tenant.role);
  const canMutate = ['owner', 'admin', 'programme_manager', 'facilitator', 'me_officer'].includes(tenant.role);

  if (!canMutate) {
    return Response.json({ error: 'Read-only role' }, { status: 403 });
  }

  try {
    switch (action) {
      case 'add_activity': {
        const a = payload.activity || {};
        const result = await db.query(
          `insert into activities (organization_id, title, type, status, venue, organizer, facilitator, start_date, end_date, sessions, reg_open, description, created_by)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           returning *`,
          [orgId, a.title, a.type || 'Training', a.status || 'Upcoming', a.venue || 'TBD', a.organizer || '', a.facilitator || '', a.start_date, a.end_date, a.sessions || 1, a.reg_open ?? true, a.description || '', userId]
        );
        return Response.json(result.rows[0]);
      }
      case 'update_activity': {
        const { id, updates = {} } = payload;
        const allowed = ['title','type','status','venue','organizer','facilitator','start_date','end_date','sessions','reg_open','description'];
        const entries = Object.entries(updates).filter(([key]) => allowed.includes(key));
        if (!entries.length) return Response.json({ error: 'No valid updates' }, { status: 400 });
        const sets = entries.map(([key], i) => `${key} = $${i + 3}`).join(', ');
        const result = await db.query(
          `update activities set ${sets}, updated_at = now() where id = $1 and organization_id = $2 returning *`,
          [id, orgId, ...entries.map(([, value]) => value)]
        );
        return result.rowCount ? Response.json(result.rows[0]) : Response.json({ error: 'Not found' }, { status: 404 });
      }
      case 'delete_activity': {
        if (!isAdmin) return Response.json({ error: 'Admin approval required' }, { status: 403 });
        await db.query('delete from activities where id = $1 and organization_id = $2', [payload.id, orgId]);
        return Response.json({ ok: true });
      }
      case 'add_participant': {
        const p = payload.participant || {};
        if (!isAdmin) {
          await db.query(
            `insert into pending_approvals (organization_id, requested_by, action_type, payload)
             values ($1,$2,'add_participant',$3::jsonb)`,
            [orgId, userId, JSON.stringify(p)]
          );
          return Response.json({ pending: true });
        }
        const result = await db.query(
          `insert into participants (organization_id, name, email, phone, org, category)
           values ($1,$2,$3,$4,$5,$6) returning *`,
          [orgId, p.name, p.email, p.phone || '', p.org || '', p.category || 'Community member']
        );
        return Response.json(result.rows[0]);
      }
      case 'update_participant': {
        const { id, updates = {} } = payload;
        const allowed = ['name','email','phone','org','category'];
        const entries = Object.entries(updates).filter(([key]) => allowed.includes(key));
        if (!entries.length) return Response.json({ error: 'No valid updates' }, { status: 400 });
        const sets = entries.map(([key], i) => `${key} = $${i + 3}`).join(', ');
        const result = await db.query(
          `update participants set ${sets}, updated_at = now() where id = $1 and organization_id = $2 returning *`,
          [id, orgId, ...entries.map(([, value]) => value)]
        );
        return result.rowCount ? Response.json(result.rows[0]) : Response.json({ error: 'Not found' }, { status: 404 });
      }
      case 'delete_participant': {
        if (!isAdmin) return Response.json({ error: 'Admin approval required' }, { status: 403 });
        await db.query('delete from participants where id = $1 and organization_id = $2', [payload.id, orgId]);
        return Response.json({ ok: true });
      }
      case 'add_registration': {
        const result = await db.query(
          `insert into registrations (organization_id, activity_id, participant_id)
           select $1, a.id, p.id from activities a join participants p on p.id = $3
           where a.id = $2 and a.organization_id = $1 and p.organization_id = $1
           on conflict (activity_id, participant_id) do update set registered_at = registrations.registered_at
           returning *`,
          [orgId, payload.activityId, payload.participantId]
        );
        return result.rowCount ? Response.json(result.rows[0]) : Response.json({ error: 'Invalid activity or participant' }, { status: 400 });
      }
      case 'upsert_attendance': {
        const result = await db.query(
          `insert into attendance (organization_id, activity_id, participant_id, session_label, status)
           select $1, a.id, p.id, $4, $5 from activities a join participants p on p.id = $3
           where a.id = $2 and a.organization_id = $1 and p.organization_id = $1
           on conflict (activity_id, participant_id, session_label)
           do update set status = excluded.status, recorded_at = now()
           returning *`,
          [orgId, payload.activityId, payload.participantId, payload.sessionLabel, payload.status]
        );
        return result.rowCount ? Response.json(result.rows[0]) : Response.json({ error: 'Invalid activity or participant' }, { status: 400 });
      }
      case 'issue_certificate': {
        if (!isAdmin) {
          await db.query(
            `insert into pending_approvals (organization_id, requested_by, action_type, payload)
             values ($1,$2,'issue_certificate',$3::jsonb)`,
            [orgId, userId, JSON.stringify(payload)]
          );
          return Response.json({ pending: true });
        }
        const placeholder = `PENDING-${randomUUID()}`;
        const inserted = await db.query(
          `insert into certificates (organization_id, cert_no, activity_id, participant_id, certificate_type, issued_by)
           select $1, $4, a.id, p.id, $5, $6 from activities a join participants p on p.id = $3
           where a.id = $2 and a.organization_id = $1 and p.organization_id = $1
           returning *`,
          [orgId, payload.activityId, payload.participantId, placeholder, payload.certificateType || 'completion', userId]
        );
        if (!inserted.rowCount) return Response.json({ error: 'Invalid activity or participant' }, { status: 400 });
        const cert = inserted.rows[0];
        const certNo = `LEX-${new Date().getFullYear()}-${String(cert.id).padStart(4, '0')}`;
        const updated = await db.query('update certificates set cert_no = $2 where id = $1 returning *', [cert.id, certNo]);
        return Response.json(updated.rows[0]);
      }
      default:
        return Response.json({ error: 'Unsupported action' }, { status: 400 });
    }
  } catch (error) {
    console.error('LexAMS mutation failed', { action, error });
    return Response.json({ error: error instanceof Error ? error.message : 'Mutation failed' }, { status: 500 });
  }
};

export const config: Config = { path: '/api/mutate' };
