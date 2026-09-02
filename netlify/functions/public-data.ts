import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';
import { consumePublicRateLimit } from './_shared/rate-limit';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function filtersMap(filters: any[] = []) {
  return Object.fromEntries(filters.filter(f => f?.operator === 'eq').map(f => [String(f.column), f.value]));
}

function normalizeAnswers(value: unknown) {
  if (value == null) value = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { answers: null, error: 'Answers must be an object.' };
  const entries = Object.entries(value);
  if (entries.length > 200) return { answers: null, error: 'Too many answers.' };
  const answers: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim().slice(0, 120);
    if (!key) continue;
    if (Array.isArray(rawValue)) answers[key] = rawValue.slice(0, 25).map(item => String(item ?? '').slice(0, 500));
    else if (typeof rawValue === 'number' || typeof rawValue === 'boolean') answers[key] = rawValue;
    else answers[key] = String(rawValue ?? '').slice(0, 4000);
  }
  if (JSON.stringify(answers).length > 100_000) return { answers: null, error: 'Answers are too large.' };
  return { answers, error: null };
}

const ACTIVITY_PUBLIC = 'id,title,type,status,venue,organizer,facilitator,start_date,end_date,sessions,reg_open,description';
const PARTICIPANT_PUBLIC = 'id,name,email,phone,org,category';
const REGISTRATION_PUBLIC = 'id,activity_id,participant_id,registered_at';
const ATTENDANCE_PUBLIC = 'id,activity_id,participant_id,session_label,status,recorded_at';
const SURVEY_PUBLIC = 'id,activity_id,title,description,status,allow_anonymous';
const SURVEY_QUESTION_PUBLIC = 'id,survey_id,question_text,question_type,options,required,sort_order';
const ASSESSMENT_PUBLIC = 'id,activity_id,title,description,assessment_type,time_limit_minutes,passing_score,status';
const ASSESSMENT_QUESTION_PUBLIC = 'id,assessment_id,question_text,question_type,options,points,sort_order';

async function resolveScope(db: ReturnType<typeof getPool>, raw: string | null) {
  if (!raw) return null;
  const [kind, ...rest] = raw.split(':');
  const token = rest.join(':');
  if (!token) return null;

  if (kind === 'reg' || kind === 'att') {
    const column = kind === 'reg' ? 'reg_token' : 'att_token';
    const result = await db.query(`select id, organization_id, reg_open, start_date, end_date from activities where ${column} = $1`, [token]);
    if (!result.rowCount) return null;
    return { kind, token, activity: result.rows[0], organizationId: result.rows[0].organization_id };
  }
  if (kind === 'survey') {
    const result = await db.query('select id, organization_id, status, allow_anonymous from surveys where share_token = $1', [token]);
    if (!result.rowCount) return null;
    return { kind, token, survey: result.rows[0], organizationId: result.rows[0].organization_id };
  }
  if (kind === 'assessment') {
    const result = await db.query('select id, organization_id, status, passing_score from assessments where share_token = $1', [token]);
    if (!result.rowCount) return null;
    return { kind, token, assessment: result.rows[0], organizationId: result.rows[0].organization_id };
  }
  return null;
}

async function bootstrapScope(db: ReturnType<typeof getPool>, table: string, filters: Record<string, any>) {
  if (table === 'activities' && filters.reg_token) {
    const result = await db.query(`select ${ACTIVITY_PUBLIC} from activities where reg_token = $1 limit 1`, [filters.reg_token]);
    if (!result.rowCount) return null;
    return { data: result.rows[0], scopeToken: `reg:${filters.reg_token}` };
  }
  if (table === 'activities' && filters.att_token) {
    const result = await db.query(`select ${ACTIVITY_PUBLIC} from activities where att_token = $1 limit 1`, [filters.att_token]);
    if (!result.rowCount) return null;
    return { data: result.rows[0], scopeToken: `att:${filters.att_token}` };
  }
  if (table === 'surveys' && filters.share_token) {
    const result = await db.query(`select ${SURVEY_PUBLIC} from surveys where share_token = $1 limit 1`, [filters.share_token]);
    if (!result.rowCount) return null;
    return { data: result.rows[0], scopeToken: `survey:${filters.share_token}` };
  }
  if (table === 'assessments' && filters.share_token) {
    const result = await db.query(`select ${ASSESSMENT_PUBLIC} from assessments where share_token = $1 limit 1`, [filters.share_token]);
    if (!result.rowCount) return null;
    return { data: result.rows[0], scopeToken: `assessment:${filters.share_token}` };
  }
  return null;
}

async function validateParticipant(db: ReturnType<typeof getPool>, participantId: unknown, organizationId: string) {
  if (!participantId) return true;
  const result = await db.query('select 1 from participants where id = $1 and organization_id = $2', [participantId, organizationId]);
  return Boolean(result.rowCount);
}

export default async (request: Request) => {
  if (request.method === 'POST' && isPreviewDeployment(request)) return previewReadOnlyResponse();
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 200_000) return json({ error: 'Request body is too large.' }, 413);
  const body = await request.json().catch(() => null) as any;
  if (!body?.table || !body?.operation) return json({ error: 'Invalid request' }, 400);

  const throttle = await consumePublicRateLimit(request, {
    scope: `public-data-${String(body.scopeToken || 'unscoped')}`,
    limit: 20,
    windowSeconds: 60,
  });
  if (!throttle.allowed) return json({ error: 'Too many public requests. Please try again shortly.' }, 429);

  const table = String(body.table);
  const operation = String(body.operation);
  const filters = filtersMap(body.filters);
  const db = getPool();

  try {
    if (!body.scopeToken) {
      if (operation !== 'select') return json({ error: 'Public scope required' }, 403);
      const boot = await bootstrapScope(db, table, filters);
      if (!boot) return json({ error: 'Not found' }, 404);
      return json({ data: body.single ? boot.data : [boot.data], scopeToken: boot.scopeToken });
    }

    const scope = await resolveScope(db, String(body.scopeToken));
    if (!scope) return json({ error: 'Invalid or expired public link' }, 403);

    if (scope.kind === 'reg') {
      if (scope.activity.reg_open !== true) return json({ error: 'Registration is closed' }, 403);

      if (table === 'activities' && operation === 'select') {
        const result = await db.query(`select ${ACTIVITY_PUBLIC} from activities where id = $1 and organization_id = $2`, [scope.activity.id, scope.organizationId]);
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }

      if (table === 'participants' && operation === 'select') {
        if (!filters.email) return json({ error: 'Email filter required' }, 400);
        const result = await db.query(
          `select ${PARTICIPANT_PUBLIC} from participants where organization_id = $1 and lower(email) = $2`,
          [scope.organizationId, String(filters.email).toLowerCase()]
        );
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }

      if (table === 'participants' && operation === 'insert') {
        const p = body.payload || {};
        const email = String(p.email || '').trim().toLowerCase();
        if (!p.name || !email || !email.includes('@')) return json({ error: 'Name and valid email are required' }, 400);
        const result = await db.query(
          `insert into participants (organization_id,name,email,phone,org,category)
           values ($1,$2,$3,$4,$5,$6) returning ${PARTICIPANT_PUBLIC}`,
          [scope.organizationId, String(p.name).trim().slice(0, 180), email.slice(0, 254), String(p.phone || '').trim().slice(0, 80), String(p.org || '').trim().slice(0, 180), String(p.category || 'Community member').trim().slice(0, 80)]
        );
        return json({ data: result.rows[0], scopeToken: body.scopeToken });
      }

      if (table === 'participants' && operation === 'update' && filters.id) {
        if (!filters.email) return json({ error: 'Email verification required' }, 400);
        const p = body.payload || {};
        const result = await db.query(
          `update participants
           set name = coalesce($1,name), phone = coalesce($2,phone), org = coalesce($3,org), category = coalesce($4,category), updated_at = now()
           where id = $5 and organization_id = $6 and lower(email) = $7
           returning ${PARTICIPANT_PUBLIC}`,
          [p.name ?? null, p.phone ?? null, p.org ?? null, p.category ?? null, filters.id, scope.organizationId, String(filters.email).toLowerCase()]
        );
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }

      if (table === 'registrations' && operation === 'select') {
        if (!filters.participant_id) return json({ error: 'Participant filter required' }, 400);
        const result = await db.query(
          `select ${REGISTRATION_PUBLIC} from registrations where organization_id = $1 and activity_id = $2 and participant_id = $3`,
          [scope.organizationId, scope.activity.id, filters.participant_id]
        );
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }

      if (table === 'registrations' && operation === 'insert') {
        const participantId = body.payload?.participant_id;
        const owned = await validateParticipant(db, participantId, scope.organizationId);
        if (!owned) return json({ error: 'Participant not found' }, 404);
        const result = await db.query(
          `insert into registrations (organization_id,activity_id,participant_id) values ($1,$2,$3)
           on conflict (activity_id,participant_id) do nothing returning ${REGISTRATION_PUBLIC}`,
          [scope.organizationId, scope.activity.id, participantId]
        );
        return json({ data: result.rows[0] || null, scopeToken: body.scopeToken });
      }
    }

    if (scope.kind === 'att') {
      if (table === 'activities' && operation === 'select') {
        const result = await db.query(`select ${ACTIVITY_PUBLIC} from activities where id = $1 and organization_id = $2`, [scope.activity.id, scope.organizationId]);
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }

      if (table === 'participants' && operation === 'select') {
        if (!filters.email) return json({ error: 'Email filter required' }, 400);
        const result = await db.query(
          `select ${PARTICIPANT_PUBLIC} from participants where organization_id = $1 and lower(email) = $2`,
          [scope.organizationId, String(filters.email).toLowerCase()]
        );
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }

      if (table === 'registrations' && operation === 'select') {
        if (!filters.participant_id) return json({ error: 'Participant filter required' }, 400);
        const result = await db.query(
          `select ${REGISTRATION_PUBLIC} from registrations where organization_id = $1 and activity_id = $2 and participant_id = $3`,
          [scope.organizationId, scope.activity.id, filters.participant_id]
        );
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }

      if (table === 'attendance' && operation === 'select') {
        if (!filters.participant_id) return json({ error: 'Participant filter required' }, 400);
        const values: any[] = [scope.organizationId, scope.activity.id, filters.participant_id];
        let sql = `select ${ATTENDANCE_PUBLIC} from attendance where organization_id = $1 and activity_id = $2 and participant_id = $3`;
        if (filters.session_label !== undefined) { values.push(filters.session_label); sql += ` and session_label = $${values.length}`; }
        const result = await db.query(sql, values);
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }

      if (table === 'attendance' && operation === 'insert') {
        const p = body.payload || {};
        const registered = await db.query(
          'select 1 from registrations where organization_id = $1 and activity_id = $2 and participant_id = $3',
          [scope.organizationId, scope.activity.id, p.participant_id]
        );
        if (!registered.rowCount) return json({ error: 'Participant is not registered' }, 403);
        const result = await db.query(
          `insert into attendance (organization_id,activity_id,participant_id,session_label,status)
           values ($1,$2,$3,$4,'present')
           on conflict (activity_id,participant_id,session_label) do nothing returning ${ATTENDANCE_PUBLIC}`,
          [scope.organizationId, scope.activity.id, p.participant_id, String(p.session_label || 'Day 1').trim().slice(0, 160)]
        );
        return json({ data: result.rows[0] || null, scopeToken: body.scopeToken });
      }
    }

    if (scope.kind === 'survey') {
      if (scope.survey.status !== 'active') return json({ error: 'Survey is closed' }, 403);

      if (table === 'surveys' && operation === 'select') {
        const result = await db.query(`select ${SURVEY_PUBLIC} from surveys where id = $1 and organization_id = $2`, [scope.survey.id, scope.organizationId]);
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }

      if (table === 'survey_questions' && operation === 'select') {
        const result = await db.query(`select ${SURVEY_QUESTION_PUBLIC} from survey_questions where survey_id = $1 order by sort_order asc`, [scope.survey.id]);
        return json({ data: result.rows, scopeToken: body.scopeToken });
      }

      if (table === 'survey_responses' && operation === 'insert') {
        const p = body.payload || {};
        if (!scope.survey.allow_anonymous && !String(p.respondent_email || '').trim()) {
          return json({ error: 'Email is required for this survey' }, 400);
        }
        const parsedAnswers = normalizeAnswers(p.answers);
        if (parsedAnswers.error) return json({ error: parsedAnswers.error }, 400);
        if (!(await validateParticipant(db, p.participant_id, scope.organizationId))) return json({ error: 'Participant not found' }, 404);
        const result = await db.query(
          `insert into survey_responses (survey_id,participant_id,respondent_name,respondent_email,answers)
           values ($1,$2,$3,$4,$5::jsonb) returning id,survey_id,participant_id,submitted_at`,
          [scope.survey.id, p.participant_id || null, String(p.respondent_name || '').trim().slice(0, 180), String(p.respondent_email || '').trim().toLowerCase().slice(0, 254), JSON.stringify(parsedAnswers.answers)]
        );
        return json({ data: result.rows[0], scopeToken: body.scopeToken });
      }
    }

    if (scope.kind === 'assessment') {
      if (scope.assessment.status !== 'active') return json({ error: 'Assessment is closed' }, 403);

      if (table === 'assessments' && operation === 'select') {
        const result = await db.query(`select ${ASSESSMENT_PUBLIC} from assessments where id = $1 and organization_id = $2`, [scope.assessment.id, scope.organizationId]);
        return json({ data: body.single ? (result.rows[0] || null) : result.rows, scopeToken: body.scopeToken });
      }

      if (table === 'assessment_questions' && operation === 'select') {
        const result = await db.query(`select ${ASSESSMENT_QUESTION_PUBLIC} from assessment_questions where assessment_id = $1 order by sort_order asc`, [scope.assessment.id]);
        return json({ data: result.rows, scopeToken: body.scopeToken });
      }

      if (table === 'assessment_submissions' && operation === 'insert') {
        const p = body.payload || {};
        if (!(await validateParticipant(db, p.participant_id, scope.organizationId))) return json({ error: 'Participant not found' }, 404);

        const questionResult = await db.query(
          'select id, question_type, correct_answer, points from assessment_questions where assessment_id = $1',
          [scope.assessment.id]
        );
        const parsedAnswers = normalizeAnswers(p.answers);
        if (parsedAnswers.error) return json({ error: parsedAnswers.error }, 400);
        const answers = parsedAnswers.answers as Record<string, unknown>;
        let score = 0;
        let totalPoints = 0;
        for (const q of questionResult.rows) {
          if (q.question_type !== 'multiple_choice' && q.question_type !== 'true_false') continue;
          const points = Math.max(0, Number(q.points || 0));
          totalPoints += points;
          const answer = answers[q.id] ?? answers[String(q.id)];
          if (q.correct_answer != null && String(answer ?? '').trim() === String(q.correct_answer).trim()) score += points;
        }
        const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 10000) / 100 : 0;
        const configuredPassingScore = Number(scope.assessment.passing_score);
        const passingScore = Number.isFinite(configuredPassingScore)
          ? Math.min(100, Math.max(0, configuredPassingScore))
          : 70;
        const passed = totalPoints > 0 && percentage >= passingScore;

        const result = await db.query(
          `insert into assessment_submissions
           (assessment_id,participant_id,respondent_name,respondent_email,answers,score,total_points,percentage,passed,started_at,submitted_at)
           values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,coalesce($10,now()),now())
           returning id,assessment_id,score,total_points,percentage,passed,submitted_at`,
          [scope.assessment.id, p.participant_id || null, String(p.respondent_name || '').trim().slice(0, 180), String(p.respondent_email || '').trim().toLowerCase().slice(0, 254), JSON.stringify(answers), score, totalPoints, percentage, passed, p.started_at || null]
        );
        return json({ data: result.rows[0], scopeToken: body.scopeToken });
      }
    }

    return json({ error: 'Operation is not allowed for this public link' }, 403);
  } catch (error: any) {
    console.error('public data error', error);
    return json({ error: error.message || 'Public request failed' }, 500);
  }
};

export const config: Config = { path: '/api/public-data' };
