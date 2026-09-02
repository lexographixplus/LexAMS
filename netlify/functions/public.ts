import type { Config, Context } from '@netlify/functions';
import { getPool } from './_shared/db';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';
import { consumePublicRateLimit } from './_shared/rate-limit';

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

function normalizeAnswers(value: unknown) {
  if (value == null) value = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { answers: null, error: 'Answers must be an object.' };
  }

  const entries = Object.entries(value);
  if (entries.length > 200) return { answers: null, error: 'Too many answers.' };

  const answers: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim().slice(0, 120);
    if (!key) continue;
    if (Array.isArray(rawValue)) {
      answers[key] = rawValue.slice(0, 25).map(item => String(item ?? '').slice(0, 500));
    } else if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      answers[key] = rawValue;
    } else {
      answers[key] = String(rawValue ?? '').slice(0, 4000);
    }
  }

  if (JSON.stringify(answers).length > 100_000) return { answers: null, error: 'Answers are too large.' };
  return { answers, error: null };
}

async function survey(request: Request, token: string) {
  const db = getPool();
  const result = await db.query(
    `select s.id,s.organization_id,s.title,s.description,s.status,s.allow_anonymous,o.name as organization_name,o.logo_url as organization_logo
     from surveys s join organizations o on o.id=s.organization_id where s.share_token=$1 limit 1`, [token]
  );
  if (!result.rowCount) return json({ error: 'Survey not found' }, 404);
  const surveyRow = result.rows[0];
  if (surveyRow.status !== 'active') return json({ error: 'This survey is no longer accepting responses.' }, 409);
  const questions = await db.query(
    `select id,question_text,question_type,options,required,sort_order from survey_questions where survey_id=$1 order by sort_order`, [surveyRow.id]
  );
  if (request.method === 'GET') return json({ survey: surveyRow, questions: questions.rows });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await request.json().catch(() => ({})) as any;
  const parsedAnswers = normalizeAnswers(body.answers);
  if (parsedAnswers.error) return json({ error: parsedAnswers.error }, 400);
  const answers = parsedAnswers.answers as Record<string, unknown>;
  const respondentName = String(body.name || '').trim().slice(0, 180);
  const respondentEmail = cleanEmail(body.email).slice(0, 254);
  if (!surveyRow.allow_anonymous && (!respondentName || !validEmail(respondentEmail))) {
    return json({ error: 'Your name and a valid email address are required for this survey.' }, 400);
  }
  for (const q of questions.rows) {
    if (q.required && !String(answers[q.id] ?? '').trim()) return json({ error: `Please answer: "${q.question_text}"` }, 400);
  }
  await db.query(
    `insert into survey_responses (survey_id,respondent_name,respondent_email,answers)
     values ($1,$2,$3,$4::jsonb)`,
    [surveyRow.id, surveyRow.allow_anonymous ? '' : respondentName, surveyRow.allow_anonymous ? '' : respondentEmail, JSON.stringify(answers)]
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
  const assessmentRow = result.rows[0];
  if (assessmentRow.status !== 'active') return json({ error: 'This assessment is no longer accepting submissions.' }, 409);
  const questions = await db.query(
    `select id,question_text,question_type,options,correct_answer,points,sort_order from assessment_questions where assessment_id=$1 order by sort_order`, [assessmentRow.id]
  );
  if (request.method === 'GET') return json({
    assessment: assessmentRow,
    questions: questions.rows.map(question => Object.fromEntries(
      Object.entries(question).filter(([key]) => key !== 'correct_answer')
    )),
  });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await request.json().catch(() => ({})) as any;
  const parsedAnswers = normalizeAnswers(body.answers);
  if (parsedAnswers.error) return json({ error: parsedAnswers.error }, 400);
  const answers = parsedAnswers.answers as Record<string, unknown>;
  let score = 0;
  let totalPoints = 0;
  for (const q of questions.rows) {
    const points = Math.max(0, Number(q.points || 0));
    totalPoints += points;
    if (q.correct_answer != null && sameAnswer(answers[q.id], q.correct_answer)) score += points;
  }
  const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 10000) / 100 : 0;
  const configuredPassingScore = Number(assessmentRow.passing_score);
  const passingScore = Number.isFinite(configuredPassingScore)
    ? Math.min(100, Math.max(0, configuredPassingScore))
    : 70;
  const passed = totalPoints > 0 && percentage >= passingScore;
  const inserted = await db.query(
    `insert into assessment_submissions (assessment_id,respondent_name,respondent_email,answers,score,total_points,percentage,passed,submitted_at)
     values ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,now()) returning id`,
    [assessmentRow.id, String(body.name || '').trim(), cleanEmail(body.email), JSON.stringify(answers), score, totalPoints, percentage, passed]
  );
  return json({ submissionId: inserted.rows[0].id, score, totalPoints, percentage, passed });
}

export default async (request: Request, context: Context) => {
  if (request.method === 'POST' && isPreviewDeployment(request)) return previewReadOnlyResponse();
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (request.method === 'POST' && contentLength > 200_000) return json({ error: 'Request body is too large.' }, 413);
  const token = context.params.token;
  const kind = context.params.kind;
  if (!token || !kind) return json({ error: 'Invalid public link' }, 400);

  // Registration and attendance moved to V2 endpoints. Keeping the old handlers
  // active would reintroduce email-only identity lookup/check-in as a bypass.
  if (kind === 'registration' || kind === 'attendance') {
    return json({ error: 'This legacy flow has been retired. Use the current LexAMS registration or session check-in link.' }, 410);
  }
  if (request.method === 'POST' && ['survey', 'assessment'].includes(kind)) {
    const throttle = await consumePublicRateLimit(request, {
      scope: `public-${kind}-${token}`,
      limit: 20,
      windowSeconds: 60,
    });
    if (!throttle.allowed) return json({ error: 'Too many submissions. Please try again shortly.' }, 429);
  }
  if (kind === 'survey') return survey(request, token);
  if (kind === 'assessment') return assessment(request, token);
  return json({ error: 'Unsupported public flow' }, 404);
};

export const config: Config = {
  path: '/api/public/:kind/:token',
  method: ['GET', 'POST'],
};
