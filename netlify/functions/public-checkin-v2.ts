import type { Config, Context } from '@netlify/functions';
import { getPool } from './_shared/db';
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

function normalizedReference(value: unknown) {
  return String(value || '').trim();
}

function sessionWindowState(session: any) {
  const now = new Date();
  if (session.status !== 'open') return { open: false, reason: session.status === 'closed' ? 'This check-in session is closed.' : 'Check-in has not been opened yet.' };
  if (session.checkin_open_at && now < new Date(session.checkin_open_at)) return { open: false, reason: 'Check-in is not open yet.' };
  if (session.checkin_close_at && now > new Date(session.checkin_close_at)) return { open: false, reason: 'The check-in window has closed.' };
  return { open: true, reason: '' };
}

function attendanceStatus(session: any) {
  if (!session.starts_at) return 'present';
  const date = String(session.session_date).slice(0, 10);
  const time = String(session.starts_at).slice(0, 8);
  const starts = new Date(`${date}T${time}`);
  if (Number.isNaN(starts.getTime())) return 'present';
  const grace = Math.max(0, Number(session.grace_minutes || 0));
  const lateAt = new Date(starts.getTime() + grace * 60000);
  return new Date() > lateAt ? 'late' : 'present';
}

async function sessionByToken(db: ReturnType<typeof getPool>, token: string) {
  const result = await db.query(
    `select s.id, s.organization_id, s.activity_id, s.title, s.session_date, s.starts_at, s.ends_at,
            s.checkin_open_at, s.checkin_close_at, s.status, s.checkin_pin, s.grace_minutes,
            a.title as activity_title, a.type as activity_type, a.venue,
            o.name as organization_name, o.logo_url as organization_logo
     from activity_sessions s
     join activities a on a.id=s.activity_id and a.organization_id=s.organization_id
     join organizations o on o.id=s.organization_id
     where s.checkin_token=$1
     limit 1`,
    [token]
  );
  return result.rows[0] || null;
}

async function logEvent(db: ReturnType<typeof getPool>, session: any, participantId: number | null, result: string, source: string) {
  await db.query(
    `insert into checkin_events (organization_id, activity_id, session_id, participant_id, result, source)
     values ($1,$2,$3,$4,$5,$6)`,
    [session.organization_id, session.activity_id, session.id, participantId, result, source]
  ).catch(error => console.error('Check-in event log failed', error));
}

export default async (request: Request, context: Context) => {
  if (request.method === 'POST' && isPreviewDeployment(request)) return previewReadOnlyResponse();
  const token = context.params.token;
  if (!token) return json({ error: 'Invalid check-in link.' }, 400);
  const db = getPool();
  const session = await sessionByToken(db, token);
  if (!session) return json({ error: 'Check-in session not found.' }, 404);
  const windowState = sessionWindowState(session);

  if (request.method === 'GET') {
    return json({
      session: {
        id: session.id,
        title: session.title,
        session_date: session.session_date,
        starts_at: session.starts_at,
        ends_at: session.ends_at,
        status: session.status,
        grace_minutes: session.grace_minutes,
        checkin_open: windowState.open,
        checkin_message: windowState.reason,
      },
      activity: {
        id: session.activity_id,
        title: session.activity_title,
        type: session.activity_type,
        venue: session.venue,
        organization_name: session.organization_name,
        organization_logo: session.organization_logo,
      },
      pin_required: Boolean(session.checkin_pin),
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const body = await request.json().catch(() => ({})) as any;
  const source = body.source === 'kiosk' ? 'kiosk' : 'self';

  if (!windowState.open) {
    await logEvent(db, session, null, 'session_closed', source);
    return json({ error: windowState.reason }, 409);
  }

  if (session.checkin_pin && String(body.pin || '').trim() !== String(session.checkin_pin)) {
    await logEvent(db, session, null, 'invalid_identity', source);
    return json({ error: 'The check-in PIN is incorrect.' }, 403);
  }

  const reference = normalizedReference(body.reference);
  if (!reference) return json({ error: 'Enter your registration reference or participant pass code.' }, 400);
  const passToken = reference.toLowerCase().startsWith('pass:') ? reference.slice(5).trim() : reference;

  const registration = await db.query(
    `select r.id as registration_id, r.status as registration_status, r.reference_code,
            p.id as participant_id, p.name, p.email, p.pass_token
     from registrations r
     join participants p on p.id=r.participant_id and p.organization_id=r.organization_id
     where r.organization_id=$1 and r.activity_id=$2
       and r.status='confirmed'
       and (upper(r.reference_code)=upper($3) or p.pass_token::text=$4)
     limit 1`,
    [session.organization_id, session.activity_id, reference, passToken]
  );

  if (!registration.rowCount) {
    await logEvent(db, session, null, 'not_registered', source);
    return json({ error: 'No confirmed registration matches this reference.' }, 404);
  }
  const person = registration.rows[0];
  const status = attendanceStatus(session);

  const inserted = await db.query(
    `insert into attendance (organization_id, activity_id, participant_id, session_id, session_label, status, source)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (activity_id, participant_id, session_label) do nothing
     returning id, status, recorded_at`,
    [session.organization_id, session.activity_id, person.participant_id, session.id, session.title, status, source]
  );

  if (!inserted.rowCount) {
    const existing = await db.query(
      `select status, recorded_at from attendance
       where organization_id=$1 and activity_id=$2 and participant_id=$3 and session_label=$4 limit 1`,
      [session.organization_id, session.activity_id, person.participant_id, session.title]
    );
    await logEvent(db, session, person.participant_id, 'already_checked_in', source);
    return json({
      state: 'already',
      name: person.name,
      status: existing.rows[0]?.status || 'present',
      recorded_at: existing.rows[0]?.recorded_at || null,
      session: session.title,
    }, 200);
  }

  await logEvent(db, session, person.participant_id, 'checked_in', source);
  return json({
    state: 'checked_in',
    name: person.name,
    status,
    recorded_at: inserted.rows[0].recorded_at,
    session: session.title,
  }, 201);
};

export const config: Config = {
  path: '/api/public-checkin/:token',
  method: ['GET', 'POST'],
};
