import type { Config, Context } from '@netlify/functions';
import { getPool } from './_shared/db';
import { assertCreationEntitlement } from './_shared/billing';

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

function cleanEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function activityByToken(db: ReturnType<typeof getPool>, token: string, column: 'reg_token' | 'att_token') {
  const result = await db.query(
    `select a.id, a.organization_id, a.title, a.type, a.venue, a.organizer, a.facilitator,
            a.start_date, a.end_date, a.sessions, a.reg_open, a.description,
            o.name as organization_name, o.logo_url as organization_logo
     from activities a
     join organizations o on o.id = a.organization_id
     where a.${column} = $1
     limit 1`,
    [token]
  );
  return result.rows[0] || null;
}

async function registration(request: Request, token: string) {
  const db = getPool();
  const activity = await activityByToken(db, token, 'reg_token');
  if (!activity) return json({ error: 'Activity not found' }, 404);
  if (!activity.reg_open) return json({ error: 'Registration is closed for this activity.' }, 409);
  if (request.method === 'GET') return json({ activity });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({})) as any;
  const email = cleanEmail(body.email);
  if (!validEmail(email)) return json({ error: 'Enter a valid email address.' }, 400);

  const existing = await db.query(
    `select id, name, email, phone, org, category
     from participants where organization_id = $1 and lower(email) = $2 limit 1`,
    [activity.organization_id, email]
  );
  const participant = existing.rows[0] || null;
  if (participant) {
    const registered = await db.query(
      'select 1 from registrations where organization_id = $1 and activity_id = $2 and participant_id = $3 limit 1',
      [activity.organization_id, activity.id, participant.id]
    );
    if (registered.rowCount) return json({ state: 'already', participant: { name: participant.name } });
  }
  if (body.action === 'lookup') return json({ state: participant ? 'found' : 'new', participant });

  const name = String(body.name || participant?.name || '').trim();
  if (!name) return json({ error: 'Name is required.' }, 400);
  const client = await db.connect();
  try {
    await client.query('begin');
    let participantId = participant?.id;
    if (participantId) {
      await client.query(
        `update participants set name=$1, phone=$2, org=$3, category=$4, updated_at=now()
         where id=$5 and organization_id=$6`,
        [name, String(body.phone || participant.phone || '').trim(), String(body.org || participant.org || '').trim(), String(body.category || participant.category || 'Community member'), participantId, activity.organization_id]
      );
    } else {
      await assertCreationEntitlement(client as any, activity.organization_id, 'participants', { organization_id: activity.organization_id });
      const inserted = await client.query(
        `insert into participants (organization_id,name,email,phone,org,category)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [activity.organization_id, name, email, String(body.phone || '').trim(), String(body.org || '').trim(), String(body.category || 'Community member')]
      );
      participantId = inserted.rows[0].id;
    }
    await client.query(
      `insert into registrations (organization_id,activity_id,participant_id)
       values ($1,$2,$3) on conflict do nothing`,
      [activity.organization_id, activity.id, participantId]
    );
    await client.query('commit');
    return json({ state: 'registered', name });
  } catch (error: any) {
    await client.query('rollback').catch(() => undefined);
    return json({ error: error?.message || 'Could not complete registration.' }, 400);
  } finally {
    client.release();
  }
}

function dateOnly(value: unknown) {
  const d = new Date(String(value) + 'T00:00:00');
  d.setHours(0, 0, 0, 0);
  return d;
}

async function attendance(request: Request, token: string) {
  const db = getPool();
  const activity = await activityByToken(db, token, 'att_token');
  if (!activity) return json({ error: 'Activity not found' }, 404);
  if (request.method === 'GET') return json({ activity });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (today < dateOnly(activity.start_date)) return json({ error: 'Check-in is not open yet.' }, 409);
  if (today > dateOnly(activity.end_date)) return json({ error: 'This activity has ended. Check-in is no longer available.' }, 409);

  const body = await request.json().catch(() => ({})) as any;
  const email = cleanEmail(body.email);
  if (!validEmail(email)) return json({ error: 'Enter a valid email address.' }, 400);
  const sessionLabel = String(body.sessionLabel || '').trim();
  if (!sessionLabel) return json({ error: 'Session is required.' }, 400);

  const participant = await db.query(
    `select p.id,p.name from participants p
     join registrations r on r.participant_id=p.id and r.activity_id=$2 and r.organization_id=$1
     where p.organization_id=$1 and lower(p.email)=$3 limit 1`,
    [activity.organization_id, activity.id, email]
  );
  if (!participant.rowCount) return json({ error: 'No registered participant found with this email.' }, 404);
  const p = participant.rows[0];
  const existing = await db.query(
    `select 1 from attendance where organization_id=$1 and activity_id=$2 and participant_id=$3 and session_label=$4 limit 1`,
    [activity.organization_id, activity.id, p.id, sessionLabel]
  );
  if (existing.rowCount) return json({ error: 'You have already checked in for this session.' }, 409);
  await db.query(
    `insert into attendance (organization_id,activity_id,participant_id,session_label,status)
     values ($1,$2,$3,$4,'present')`,
    [activity.organization_id, activity.id, p.id, sessionLabel]
  );
  return json({ ok: true, name: p.name });
}

async function survey(request: Request, token: string) {
  const db = getPool();
  const result = await db.query(
    `select s.id,s.organization_id,s.title,s.description,s.status,s.allow_anonymous,o.name as organization_name,o.logo_url as organization_logo
     from surveys s join organizations o on o.id=s.organization_id where s.share_token=$1 limit 1`, [token]
  );
  if (!result.rowCount) return json({ error: 'Survey not found' }, 404);
  const survey = result.rows[0];
  if (survey.status !== 'active') return json({ error: 'This survey is no longer accepting responses.' }, 409);
  const questions = await db.query(
    `select id,question_text,question_type,options,required,sort_order from survey_questions where survey_id=$1 order by sort_order`, [survey.id]
  );
  if (request.method === 'GET') return json({ survey, questions: questions.rows });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await request.json().catch(() => ({})) as any;
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};
  for (const q of questions.rows) if (q.required && !String(answers[q.id] ?? '').trim()) return json({ error: `Please answer: "${q.question_text}"` }, 400);
  await db.query(
    `insert into survey_responses (survey_id,respondent_name,respondent_email,answers)
     values ($1,$2,$3,$4::jsonb)`,
    [survey.id, survey.allow_anonymous ? '' : String(body.name || '').trim(), survey.allow_anonymous ? '' : cleanEmail(body.email), JSON.stringify(answers)]
  );
  return json({ ok: true });
}

function sameAnswer(a: unknown, b: unknown) {
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}

async function assessment(request: Request, token: string) {
  const db = getPool();
  const result = await db.query(
    `select a.id,a.organization_id,a.title,a.description,a.assessment_type,a.time_limit_minutes,a.passing_score,a.status,
            o.name as organization_name,o.logo_url as organization_logo
     from assessments a join organizations o on o.id=a.organization_id where a.share_token=$1 limit 1`, [token]
  );
  if (!result.rowCount) return json({ error: 'Assessment not found' }, 404);
  const assessment = result.rows[0];
  if (assessment.status !== 'active') return json({ error: 'This assessment is no longer accepting submissions.' }, 409);
  const questions = await db.query(
    `select id,question_text,question_type,options,correct_answer,points,sort_order from assessment_questions where assessment_id=$1 order by sort_order`, [assessment.id]
  );
  if (request.method === 'GET') return json({
    assessment,
    questions: questions.rows.map(({ correct_answer, ...q }) => q),
  });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await request.json().catch(() => ({})) as any;
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};
  let score = 0;
  let totalPoints = 0;
  for (const q of questions.rows) {
    const points = Number(q.points || 0);
    totalPoints += points;
    if (q.correct_answer != null && sameAnswer(answers[q.id], q.correct_answer)) score += points;
  }
  const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 10000) / 100 : 0;
  const passed = percentage >= Number(assessment.passing_score || 0);
  const inserted = await db.query(
    `insert into assessment_submissions (assessment_id,respondent_name,respondent_email,answers,score,total_points,percentage,passed,submitted_at)
     values ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,now()) returning id`,
    [assessment.id, String(body.name || '').trim(), cleanEmail(body.email), JSON.stringify(answers), score, totalPoints, percentage, passed]
  );
  return json({ submissionId: inserted.rows[0].id, score, totalPoints, percentage, passed });
}

export default async (request: Request, context: Context) => {
  const token = context.params.token;
  const kind = context.params.kind;
  if (!token || !kind) return json({ error: 'Invalid public link' }, 400);
  if (kind === 'registration') return registration(request, token);
  if (kind === 'attendance') return attendance(request, token);
  if (kind === 'survey') return survey(request, token);
  if (kind === 'assessment') return assessment(request, token);
  return json({ error: 'Unsupported public flow' }, 404);
};

export const config: Config = {
  path: '/api/public/:kind/:token',
  method: ['GET', 'POST'],
};
