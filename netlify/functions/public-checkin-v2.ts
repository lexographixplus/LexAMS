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

function cleanIdentity(value: unknown) {
  return String(value || '').trim().slice(0, 254);
}

function dateKey(value: unknown) {
  if (!value) return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  const isoDate = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function timeKey(value: unknown) {
  const raw = String(value || '').slice(0, 8);
  if (!raw) return '';
  return raw.length === 5 ? `${raw}:00` : raw;
}

function activityDayNumber(activity: any, localDate: string) {
  const start = new Date(`${dateKey(activity.start_date)}T00:00:00Z`);
  const today = new Date(`${localDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(today.getTime())) return 1;
  return Math.max(1, Math.floor((today.getTime() - start.getTime()) / 86400000) + 1);
}

function activityWindowState(activity: any) {
  const localDate = dateKey(activity.local_date);
  const localTime = timeKey(activity.local_time);
  const startDate = dateKey(activity.start_date);
  const endDate = dateKey(activity.end_date);
  const opens = timeKey(activity.daily_checkin_window_start);
  const closes = timeKey(activity.daily_checkin_window_end);

  if (!activity.daily_checkin_enabled) {
    return { open: false, reason: 'Daily check-in is disabled for this activity.', localDate };
  }
  if (localDate < startDate) {
    return { open: false, reason: `Check-in is not available before ${startDate}.`, localDate };
  }
  if (localDate > endDate) {
    return { open: false, reason: 'This activity has ended. Check-in is no longer available.', localDate };
  }
  if (opens && localTime < opens) {
    return { open: false, reason: `Today's check-in opens at ${opens.slice(0, 5)}.`, localDate };
  }
  if (closes && localTime > closes) {
    return { open: false, reason: `Today's check-in closed at ${closes.slice(0, 5)}.`, localDate };
  }
  return { open: true, reason: '', localDate };
}

function sessionWindowState(session: any) {
  const now = new Date();
  if (session.status !== 'open') {
    return { open: false, reason: session.status === 'closed' ? 'This check-in session is closed.' : 'Check-in has not been opened yet.' };
  }
  if (session.checkin_open_at && now < new Date(session.checkin_open_at)) return { open: false, reason: 'Check-in is not open yet.' };
  if (session.checkin_close_at && now > new Date(session.checkin_close_at)) return { open: false, reason: 'The check-in window has closed.' };
  return { open: true, reason: '' };
}

function attendanceStatus(session: any) {
  if (!session.session_starts_at) return 'present';
  const starts = new Date(session.session_starts_at);
  if (Number.isNaN(starts.getTime())) return 'present';
  const grace = Math.max(0, Number(session.grace_minutes || 0));
  return new Date() > new Date(starts.getTime() + grace * 60000) ? 'late' : 'present';
}

const SESSION_SELECT = `select s.id, s.organization_id, s.activity_id, s.title, s.session_date, s.starts_at, s.ends_at,
            s.checkin_open_at, s.checkin_close_at, s.status, s.checkin_pin, s.grace_minutes,
            ((s.session_date + s.starts_at) at time zone coalesce(a.daily_checkin_timezone, 'UTC')) as session_starts_at,
            a.title as activity_title, a.type as activity_type, a.venue, a.daily_checkin_timezone as activity_timezone,
            o.name as organization_name, o.logo_url as organization_logo
     from activity_sessions s
     join activities a on a.id=s.activity_id and a.organization_id=s.organization_id
     join organizations o on o.id=s.organization_id`;

async function directSessionByToken(db: ReturnType<typeof getPool>, token: string) {
  const result = await db.query(`${SESSION_SELECT} where s.checkin_token=$1 limit 1`, [token]);
  return result.rows[0] || null;
}

async function activityByToken(db: ReturnType<typeof getPool>, token: string) {
  const result = await db.query(
    `select a.id, a.organization_id, a.title, a.type, a.venue, a.start_date, a.end_date,
            a.att_token, a.daily_checkin_enabled, a.daily_checkin_window_start,
            a.daily_checkin_window_end, a.daily_checkin_timezone,
            timezone(a.daily_checkin_timezone, now())::date as local_date,
            timezone(a.daily_checkin_timezone, now())::time as local_time,
            o.name as organization_name, o.logo_url as organization_logo
     from activities a
     join organizations o on o.id=a.organization_id
     where a.att_token=$1
     limit 1`,
    [token]
  );
  return result.rows[0] || null;
}

async function sessionForActivityDay(db: ReturnType<typeof getPool>, activity: any, localDate: string) {
  const result = await db.query(
    `select id, organization_id, activity_id, title, session_date, starts_at, ends_at,
            checkin_open_at, checkin_close_at, status, checkin_pin, grace_minutes, sort_order
     from activity_sessions
     where organization_id=$1 and activity_id=$2 and session_date=$3::date
     order by sort_order, id
     limit 1`,
    [activity.organization_id, activity.id, localDate]
  );
  return result.rows[0] || null;
}

async function logEvent(
  db: ReturnType<typeof getPool>,
  args: { organizationId: string; activityId: number; sessionId?: number | null; participantId?: number | null; result: string; source: string; checkinDate?: string | null }
) {
  await db.query(
    `insert into checkin_events (organization_id, activity_id, session_id, participant_id, result, source, checkin_date)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [args.organizationId, args.activityId, args.sessionId || null, args.participantId || null, args.result, args.source, args.checkinDate || null]
  ).catch(error => console.error('Check-in event log failed', error));
}

async function findActivityRegistration(db: ReturnType<typeof getPool>, activity: any, identity: string) {
  const base = `select r.id as registration_id, r.status as registration_status, r.reference_code,
                       p.id as participant_id, p.name, p.email, p.pass_token
                from registrations r
                join participants p on p.id=r.participant_id and p.organization_id=r.organization_id
                where r.organization_id=$1 and r.activity_id=$2 and r.status='confirmed'`;

  if (identity.includes('@')) {
    const result = await db.query(`${base} and lower(btrim(p.email))=lower(btrim($3)) limit 1`, [activity.organization_id, activity.id, identity]);
    return { person: result.rows[0] || null, ambiguous: false };
  }

  if (/^REG-/i.test(identity)) {
    const result = await db.query(`${base} and upper(r.reference_code)=upper($3) limit 1`, [activity.organization_id, activity.id, identity]);
    return { person: result.rows[0] || null, ambiguous: false };
  }

  const pass = identity.replace(/^PASS:/i, '').trim();
  if (/^[0-9a-f-]{30,}$/i.test(pass)) {
    const result = await db.query(`${base} and p.pass_token::text=$3 limit 1`, [activity.organization_id, activity.id, pass]);
    return { person: result.rows[0] || null, ambiguous: false };
  }

  const result = await db.query(
    `${base}
     and lower(regexp_replace(btrim(p.name), '\\s+', ' ', 'g')) = lower(regexp_replace(btrim($3), '\\s+', ' ', 'g'))
     order by p.id
     limit 2`,
    [activity.organization_id, activity.id, identity]
  );
  return { person: result.rows[0] || null, ambiguous: result.rowCount > 1 };
}

async function handleActivityCheckin(request: Request, db: ReturnType<typeof getPool>, activity: any) {
  const windowState = activityWindowState(activity);
  const todaySession = await sessionForActivityDay(db, activity, windowState.localDate);
  const fallbackLabel = `Daily check-in · ${windowState.localDate}`;
  const dayNumber = activityDayNumber(activity, windowState.localDate);
  const label = todaySession?.title || fallbackLabel;

  if (request.method === 'GET') {
    return json({
      mode: 'activity',
      activity: {
        id: activity.id,
        title: activity.title,
        type: activity.type,
        venue: activity.venue,
        start_date: activity.start_date,
        end_date: activity.end_date,
        organization_name: activity.organization_name,
        organization_logo: activity.organization_logo,
      },
      day: {
        date: windowState.localDate,
        day_number: dayNumber,
        label,
        checkin_open: windowState.open,
        checkin_message: windowState.reason,
        window_start: activity.daily_checkin_window_start,
        window_end: activity.daily_checkin_window_end,
        timezone: activity.daily_checkin_timezone,
      },
      pin_required: false,
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const body = await request.json().catch(() => ({})) as any;
  const source = body.source === 'kiosk' ? 'kiosk' : 'self';

  if (!windowState.open) {
    await logEvent(db, {
      organizationId: activity.organization_id,
      activityId: activity.id,
      sessionId: todaySession?.id || null,
      result: 'session_closed',
      source,
      checkinDate: windowState.localDate,
    });
    return json({ error: windowState.reason }, 409);
  }

  const identity = cleanIdentity(body.identity || body.reference);
  if (!identity) return json({ error: 'Enter your full name or registered email address.' }, 400);

  const match = await findActivityRegistration(db, activity, identity);
  if (match.ambiguous) {
    return json({ error: 'More than one registered participant has this name. Use your registered email address.' }, 409);
  }
  if (!match.person) {
    await logEvent(db, {
      organizationId: activity.organization_id,
      activityId: activity.id,
      sessionId: todaySession?.id || null,
      result: 'not_registered',
      source,
      checkinDate: windowState.localDate,
    });
    return json({ error: 'No confirmed registration matches that name or email.' }, 404);
  }

  const person = match.person;
  const existing = await db.query(
    `select a.id, a.status, a.recorded_at, a.session_label
     from attendance a
     left join activity_sessions s on s.id=a.session_id and s.organization_id=a.organization_id
     where a.organization_id=$1 and a.activity_id=$2 and a.participant_id=$3
       and a.status in ('present','late')
       and (s.session_date=$4::date or (a.session_id is null and a.session_label=$5))
     order by a.recorded_at
     limit 1`,
    [activity.organization_id, activity.id, person.participant_id, windowState.localDate, fallbackLabel]
  );

  if (existing.rowCount) {
    await logEvent(db, {
      organizationId: activity.organization_id,
      activityId: activity.id,
      sessionId: todaySession?.id || null,
      participantId: person.participant_id,
      result: 'already_checked_in',
      source,
      checkinDate: windowState.localDate,
    });
    return json({
      mode: 'activity',
      state: 'already',
      name: person.name,
      status: existing.rows[0].status,
      recorded_at: existing.rows[0].recorded_at,
      day: windowState.localDate,
      day_number: dayNumber,
      label: existing.rows[0].session_label || label,
    });
  }

  const inserted = await db.query(
    `insert into attendance (organization_id, activity_id, participant_id, session_id, session_label, status, source)
     values ($1,$2,$3,$4,$5,'present',$6)
     on conflict (activity_id, participant_id, session_label)
     do update set status='present', source=excluded.source, recorded_at=now()
       where attendance.status='absent'
     returning id, status, recorded_at`,
    [activity.organization_id, activity.id, person.participant_id, todaySession?.id || null, label, source]
  );

  if (!inserted.rowCount) {
    const raced = await db.query(
      `select status, recorded_at from attendance
       where organization_id=$1 and activity_id=$2 and participant_id=$3 and session_label=$4
       limit 1`,
      [activity.organization_id, activity.id, person.participant_id, label]
    );
    return json({
      mode: 'activity',
      state: 'already',
      name: person.name,
      status: raced.rows[0]?.status || 'present',
      recorded_at: raced.rows[0]?.recorded_at || null,
      day: windowState.localDate,
      day_number: dayNumber,
      label,
    });
  }

  await logEvent(db, {
    organizationId: activity.organization_id,
    activityId: activity.id,
    sessionId: todaySession?.id || null,
    participantId: person.participant_id,
    result: 'checked_in',
    source,
    checkinDate: windowState.localDate,
  });

  return json({
    mode: 'activity',
    state: 'checked_in',
    name: person.name,
    status: 'present',
    recorded_at: inserted.rows[0].recorded_at,
    day: windowState.localDate,
    day_number: dayNumber,
    label,
  }, 201);
}

async function handleSessionCheckin(request: Request, db: ReturnType<typeof getPool>, session: any) {
  const windowState = sessionWindowState(session);

  if (request.method === 'GET') {
    return json({
      mode: 'session',
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
    await logEvent(db, {
      organizationId: session.organization_id,
      activityId: session.activity_id,
      sessionId: session.id,
      result: 'session_closed',
      source,
      checkinDate: dateKey(session.session_date),
    });
    return json({ error: windowState.reason }, 409);
  }

  if (session.checkin_pin && String(body.pin || '').trim() !== String(session.checkin_pin)) {
    await logEvent(db, {
      organizationId: session.organization_id,
      activityId: session.activity_id,
      sessionId: session.id,
      result: 'invalid_identity',
      source,
      checkinDate: dateKey(session.session_date),
    });
    return json({ error: 'The check-in PIN is incorrect.' }, 403);
  }

  const reference = cleanIdentity(body.reference || body.identity);
  if (!reference) return json({ error: 'Enter your registration reference or participant pass code.' }, 400);
  const passToken = reference.replace(/^PASS:/i, '').trim();

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
    await logEvent(db, {
      organizationId: session.organization_id,
      activityId: session.activity_id,
      sessionId: session.id,
      result: 'not_registered',
      source,
      checkinDate: dateKey(session.session_date),
    });
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
    await logEvent(db, {
      organizationId: session.organization_id,
      activityId: session.activity_id,
      sessionId: session.id,
      participantId: person.participant_id,
      result: 'already_checked_in',
      source,
      checkinDate: dateKey(session.session_date),
    });
    return json({
      mode: 'session',
      state: 'already',
      name: person.name,
      status: existing.rows[0]?.status || 'present',
      recorded_at: existing.rows[0]?.recorded_at || null,
      session: session.title,
    });
  }

  await logEvent(db, {
    organizationId: session.organization_id,
    activityId: session.activity_id,
    sessionId: session.id,
    participantId: person.participant_id,
    result: 'checked_in',
    source,
    checkinDate: dateKey(session.session_date),
  });

  return json({
    mode: 'session',
    state: 'checked_in',
    name: person.name,
    status,
    recorded_at: inserted.rows[0].recorded_at,
    session: session.title,
  }, 201);
}

export default async (request: Request, context: Context) => {
  try {
    if (request.method === 'POST' && isPreviewDeployment(request)) return previewReadOnlyResponse();
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (request.method === 'POST' && contentLength > 20_000) return json({ error: 'Request body is too large.' }, 413);
    const token = context.params.token;
    if (!token) return json({ error: 'Invalid check-in link.' }, 400);

    const db = getPool();
    const directSession = await directSessionByToken(db, token);
    if (directSession) return handleSessionCheckin(request, db, directSession);

    const activity = await activityByToken(db, token);
    if (activity) return handleActivityCheckin(request, db, activity);

    return json({ error: 'Check-in link not found.' }, 404);
  } catch (error) {
    console.error('Public check-in request failed', error);
    return json({ error: 'Check-in is temporarily unavailable. Please try again.' }, 500);
  }
};

export const config: Config = {
  path: '/api/public-checkin/:token',
  method: ['GET', 'POST'],
};
