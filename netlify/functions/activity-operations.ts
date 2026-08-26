import type { Config, Context } from '@netlify/functions';
import { getPool } from './_shared/db';
import { requireTenant } from './_shared/tenant';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';

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

function num(value: unknown) {
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

function cleanPin(value: unknown) {
  const pin = String(value || '').trim();
  if (!pin) return null;
  if (!/^\d{4,8}$/.test(pin)) throw new Error('Check-in PIN must contain 4 to 8 digits.');
  return pin;
}

function cleanCustomFields(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((field: any, index) => ({
    id: String(field?.id || `field_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80),
    label: String(field?.label || `Question ${index + 1}`).trim().slice(0, 180),
    type: ['text', 'textarea', 'select', 'checkbox'].includes(String(field?.type)) ? String(field.type) : 'text',
    required: Boolean(field?.required),
    options: Array.isArray(field?.options) ? field.options.map((option: unknown) => String(option).trim().slice(0, 120)).filter(Boolean).slice(0, 30) : [],
  })).filter(field => field.label);
}

async function getActivity(db: ReturnType<typeof getPool>, organizationId: string, activityId: number) {
  const result = await db.query(
    `select id, organization_id, title, type, venue, start_date, end_date, reg_open, reg_token,
            registration_capacity, waitlist_enabled, registration_opens_at, registration_closes_at,
            registration_approval_required, registration_confirmation_email,
            registration_confirmation_message, registration_custom_fields
     from activities where id=$1 and organization_id=$2 limit 1`,
    [activityId, organizationId]
  );
  return result.rows[0] || null;
}

async function snapshot(db: ReturnType<typeof getPool>, organizationId: string, activityId: number) {
  const activity = await getActivity(db, organizationId, activityId);
  if (!activity) return null;
  const [sessions, registrations, attendance] = await Promise.all([
    db.query(
      `select id, title, session_date, starts_at, ends_at, checkin_open_at, checkin_close_at,
              status, checkin_token, checkin_pin, grace_minutes, sort_order, updated_at
       from activity_sessions
       where organization_id=$1 and activity_id=$2
       order by session_date, sort_order, id`,
      [organizationId, activityId]
    ),
    db.query(
      `select r.id, r.participant_id, r.status, r.reference_code, r.registered_at, r.confirmed_at, r.custom_answers,
              p.name, p.email, p.phone, p.org, p.category, p.pass_token
       from registrations r
       join participants p on p.id=r.participant_id and p.organization_id=r.organization_id
       where r.organization_id=$1 and r.activity_id=$2
       order by p.name, p.id`,
      [organizationId, activityId]
    ),
    db.query(
      `select a.id, a.participant_id, a.session_id, a.session_label, a.status, a.source, a.recorded_at,
              a.recorded_by
       from attendance a
       where a.organization_id=$1 and a.activity_id=$2
       order by a.recorded_at desc`,
      [organizationId, activityId]
    ),
  ]);
  return { activity, sessions: sessions.rows, registrations: registrations.rows, attendance: attendance.rows };
}

async function promoteWaitlist(db: ReturnType<typeof getPool>, organizationId: string, activity: any) {
  if (!activity.waitlist_enabled || activity.registration_approval_required) return null;
  const capacity = Number(activity.registration_capacity || 0);
  if (capacity <= 0) return null;
  const confirmed = await db.query(
    `select count(*)::int as count from registrations
     where organization_id=$1 and activity_id=$2 and status in ('confirmed','pending')`,
    [organizationId, activity.id]
  );
  if (Number(confirmed.rows[0]?.count || 0) >= capacity) return null;
  const promoted = await db.query(
    `update registrations set status='confirmed', confirmed_at=now()
     where id=(
       select id from registrations
       where organization_id=$1 and activity_id=$2 and status='waitlisted'
       order by registered_at, id
       limit 1
       for update skip locked
     )
     returning *`,
    [organizationId, activity.id]
  );
  return promoted.rows[0] || null;
}

export default async (request: Request, context: Context) => {
  if (request.method === 'POST' && isPreviewDeployment(request)) return previewReadOnlyResponse();
  const tenant = await requireTenant(request);
  if (!tenant) return json({ error: 'Unauthorized.' }, 401);
  const activityId = num(context.params.activityId);
  if (!activityId) return json({ error: 'Invalid activity.' }, 400);
  const db = getPool();
  const orgId = tenant.organization_id;
  const canMutate = ['owner', 'admin', 'programme_manager', 'facilitator', 'me_officer'].includes(tenant.role);

  if (request.method === 'GET') {
    const data = await snapshot(db, orgId, activityId);
    return data ? json(data) : json({ error: 'Activity not found.' }, 404);
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!canMutate) return json({ error: 'Read-only role.' }, 403);

  const body = await request.json().catch(() => ({})) as any;
  const action = String(body.action || '');
  const activity = await getActivity(db, orgId, activityId);
  if (!activity) return json({ error: 'Activity not found.' }, 404);

  try {
    if (action === 'update_registration_settings') {
      const capacity = body.settings?.registration_capacity === '' || body.settings?.registration_capacity == null
        ? null
        : Math.max(1, Number(body.settings.registration_capacity));
      if (capacity != null && (!Number.isFinite(capacity) || capacity > 100000)) return json({ error: 'Enter a valid registration capacity.' }, 400);
      const custom = cleanCustomFields(body.settings?.registration_custom_fields);
      const result = await db.query(
        `update activities set
           reg_open=$3,
           registration_capacity=$4,
           waitlist_enabled=$5,
           registration_opens_at=$6,
           registration_closes_at=$7,
           registration_approval_required=$8,
           registration_confirmation_email=$9,
           registration_confirmation_message=$10,
           registration_custom_fields=$11::jsonb,
           updated_at=now()
         where id=$1 and organization_id=$2
         returning *`,
        [
          activityId,
          orgId,
          body.settings?.reg_open !== false,
          capacity,
          Boolean(body.settings?.waitlist_enabled),
          body.settings?.registration_opens_at || null,
          body.settings?.registration_closes_at || null,
          Boolean(body.settings?.registration_approval_required),
          body.settings?.registration_confirmation_email !== false,
          String(body.settings?.registration_confirmation_message || '').trim().slice(0, 1200),
          JSON.stringify(custom),
        ]
      );
      return json({ activity: result.rows[0] });
    }

    if (action === 'create_session') {
      const title = String(body.session?.title || '').trim().slice(0, 160);
      const sessionDate = String(body.session?.session_date || '').slice(0, 10);
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return json({ error: 'Session title and date are required.' }, 400);
      const pin = cleanPin(body.session?.checkin_pin);
      const grace = Math.max(0, Math.min(240, Number(body.session?.grace_minutes ?? 15)));
      const result = await db.query(
        `insert into activity_sessions (organization_id, activity_id, title, session_date, starts_at, ends_at,
                                        checkin_open_at, checkin_close_at, checkin_pin, grace_minutes, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                 coalesce((select max(sort_order)+1 from activity_sessions where organization_id=$1 and activity_id=$2),0))
         returning *`,
        [orgId, activityId, title, sessionDate, body.session?.starts_at || null, body.session?.ends_at || null,
          body.session?.checkin_open_at || null, body.session?.checkin_close_at || null, pin, grace]
      );
      return json({ session: result.rows[0] }, 201);
    }

    if (action === 'update_session') {
      const sessionId = num(body.session?.id);
      if (!sessionId) return json({ error: 'Invalid session.' }, 400);
      const title = String(body.session?.title || '').trim().slice(0, 160);
      const date = String(body.session?.session_date || '').slice(0, 10);
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Session title and date are required.' }, 400);
      const pin = cleanPin(body.session?.checkin_pin);
      const grace = Math.max(0, Math.min(240, Number(body.session?.grace_minutes ?? 15)));
      const result = await db.query(
        `update activity_sessions set title=$4, session_date=$5, starts_at=$6, ends_at=$7,
            checkin_open_at=$8, checkin_close_at=$9, checkin_pin=$10, grace_minutes=$11, updated_at=now()
         where id=$1 and activity_id=$2 and organization_id=$3
         returning *`,
        [sessionId, activityId, orgId, title, date, body.session?.starts_at || null, body.session?.ends_at || null,
          body.session?.checkin_open_at || null, body.session?.checkin_close_at || null, pin, grace]
      );
      return result.rowCount ? json({ session: result.rows[0] }) : json({ error: 'Session not found.' }, 404);
    }

    if (action === 'set_session_state') {
      const sessionId = num(body.sessionId);
      const state = String(body.state || '');
      if (!sessionId || !['scheduled', 'open', 'closed'].includes(state)) return json({ error: 'Invalid session state.' }, 400);
      const result = await db.query(
        `update activity_sessions set status=$4,
            checkin_open_at=case when $4='open' and checkin_open_at is null then now() else checkin_open_at end,
            checkin_close_at=case when $4='closed' and checkin_close_at is null then now() else checkin_close_at end,
            updated_at=now()
         where id=$1 and activity_id=$2 and organization_id=$3
         returning *`,
        [sessionId, activityId, orgId, state]
      );
      return result.rowCount ? json({ session: result.rows[0] }) : json({ error: 'Session not found.' }, 404);
    }

    if (action === 'regenerate_session_token') {
      const sessionId = num(body.sessionId);
      if (!sessionId) return json({ error: 'Invalid session.' }, 400);
      const result = await db.query(
        `update activity_sessions set checkin_token=gen_random_uuid(), updated_at=now()
         where id=$1 and activity_id=$2 and organization_id=$3 returning *`,
        [sessionId, activityId, orgId]
      );
      return result.rowCount ? json({ session: result.rows[0] }) : json({ error: 'Session not found.' }, 404);
    }

    if (action === 'staff_attendance') {
      const sessionId = num(body.sessionId);
      const participantId = num(body.participantId);
      const status = String(body.status || '');
      if (!sessionId || !participantId || !['present', 'late', 'absent'].includes(status)) return json({ error: 'Invalid attendance update.' }, 400);
      const valid = await db.query(
        `select s.id as session_id, s.title, r.id as registration_id
         from activity_sessions s
         join registrations r on r.organization_id=s.organization_id and r.activity_id=s.activity_id and r.participant_id=$4
         where s.id=$1 and s.activity_id=$2 and s.organization_id=$3 and r.status='confirmed'
         limit 1`,
        [sessionId, activityId, orgId, participantId]
      );
      if (!valid.rowCount) return json({ error: 'Participant is not confirmed for this session activity.' }, 400);
      const record = valid.rows[0];
      const result = await db.query(
        `insert into attendance (organization_id, activity_id, participant_id, session_id, session_label, status, source, recorded_by)
         values ($1,$2,$3,$4,$5,$6,'staff',$7)
         on conflict (activity_id, participant_id, session_label)
         do update set session_id=excluded.session_id, status=excluded.status, source='staff', recorded_by=excluded.recorded_by, recorded_at=now()
         returning *`,
        [orgId, activityId, participantId, sessionId, record.title, status, tenant.user.id]
      );
      return json({ attendance: result.rows[0] });
    }

    if (action === 'undo_attendance') {
      const sessionId = num(body.sessionId);
      const participantId = num(body.participantId);
      if (!sessionId || !participantId) return json({ error: 'Invalid attendance record.' }, 400);
      const result = await db.query(
        `delete from attendance
         where organization_id=$1 and activity_id=$2 and participant_id=$3
           and (session_id=$4 or session_label=(select title from activity_sessions where id=$4 and organization_id=$1 and activity_id=$2))
         returning id`,
        [orgId, activityId, participantId, sessionId]
      );
      return json({ removed: result.rowCount });
    }

    if (action === 'mark_remaining_absent') {
      const sessionId = num(body.sessionId);
      if (!sessionId) return json({ error: 'Invalid session.' }, 400);
      const session = await db.query(
        `select id,title from activity_sessions where id=$1 and activity_id=$2 and organization_id=$3 limit 1`,
        [sessionId, activityId, orgId]
      );
      if (!session.rowCount) return json({ error: 'Session not found.' }, 404);
      const title = session.rows[0].title;
      const result = await db.query(
        `insert into attendance (organization_id, activity_id, participant_id, session_id, session_label, status, source, recorded_by)
         select $1,$2,r.participant_id,$3,$4,'absent','staff',$5
         from registrations r
         where r.organization_id=$1 and r.activity_id=$2 and r.status='confirmed'
           and not exists (
             select 1 from attendance a
             where a.organization_id=$1 and a.activity_id=$2 and a.participant_id=r.participant_id and a.session_label=$4
           )
         on conflict (activity_id, participant_id, session_label) do nothing
         returning id`,
        [orgId, activityId, sessionId, title, tenant.user.id]
      );
      return json({ marked: result.rowCount });
    }

    if (action === 'set_registration_status') {
      const registrationId = num(body.registrationId);
      const status = String(body.status || '');
      if (!registrationId || !['confirmed', 'pending', 'waitlisted', 'cancelled'].includes(status)) return json({ error: 'Invalid registration status.' }, 400);
      const client = await db.connect();
      try {
        await client.query('begin');
        const lockedActivityResult = await client.query(
          `select * from activities where id=$1 and organization_id=$2 for update`,
          [activityId, orgId]
        );
        if (!lockedActivityResult.rowCount) { await client.query('rollback'); return json({ error: 'Activity not found.' }, 404); }
        const lockedActivity = lockedActivityResult.rows[0];
        if (status === 'confirmed' && Number(lockedActivity.registration_capacity || 0) > 0) {
          const count = await client.query(
            `select count(*)::int as count from registrations
             where organization_id=$1 and activity_id=$2 and status='confirmed' and id<>$3`,
            [orgId, activityId, registrationId]
          );
          if (Number(count.rows[0]?.count || 0) >= Number(lockedActivity.registration_capacity)) {
            await client.query('rollback');
            return json({ error: 'Registration capacity has been reached.' }, 409);
          }
        }
        const updated = await client.query(
          `update registrations set status=$4,
             confirmed_at=case when $4='confirmed' then coalesce(confirmed_at,now()) else confirmed_at end
           where id=$1 and activity_id=$2 and organization_id=$3 returning *`,
          [registrationId, activityId, orgId, status]
        );
        if (!updated.rowCount) { await client.query('rollback'); return json({ error: 'Registration not found.' }, 404); }
        let promoted = null;
        if (status === 'cancelled') promoted = await promoteWaitlist(client as ReturnType<typeof getPool>, orgId, lockedActivity);
        await client.query('commit');
        return json({ registration: updated.rows[0], promoted });
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally { client.release(); }
    }

    return json({ error: 'Unsupported activity operation.' }, 400);
  } catch (error) {
    console.error('Activity operations failed', { action, error });
    return json({ error: error instanceof Error ? error.message : 'Could not complete the activity operation.' }, 400);
  }
};

export const config: Config = {
  path: '/api/activity-operations/:activityId',
  method: ['GET', 'POST'],
};
