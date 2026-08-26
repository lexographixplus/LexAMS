import type { Config } from '@netlify/functions';
import { getPool } from './_shared/db';
import { getBillingSnapshot } from './_shared/billing';
import { requireTenant } from './_shared/tenant';

type ReportFilters = {
  activityId: string | null;
  activityType: string | null;
  category: string | null;
  organization: string | null;
  from: string | null;
  to: string | null;
  surveyId: string | null;
  assessmentId: string | null;
};

function clean(value: string | null) {
  const text = String(value || '').trim();
  return !text || text === 'all' ? null : text;
}

function parseFilters(url: URL): ReportFilters {
  return {
    activityId: clean(url.searchParams.get('activity')),
    activityType: clean(url.searchParams.get('activityType')),
    category: clean(url.searchParams.get('category')),
    organization: clean(url.searchParams.get('organization')),
    from: clean(url.searchParams.get('from')),
    to: clean(url.searchParams.get('to')),
    surveyId: clean(url.searchParams.get('survey')),
    assessmentId: clean(url.searchParams.get('assessment')),
  };
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values: Array<number | null>) {
  const nums = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!nums.length) return null;
  return Math.round((nums.reduce((sum, value) => sum + value, 0) / nums.length) * 100) / 100;
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 10000) / 100 : null;
}

function answerFor(answers: any, questionId: unknown) {
  if (!answers || typeof answers !== 'object') return '';
  const value = answers[questionId as any] ?? answers[String(questionId)];
  return value == null ? '' : String(value).trim();
}

function sameAnswer(a: unknown, b: unknown) {
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}

function titleCase(value: unknown) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function csvResponse(rows: unknown[][], filename: string) {
  const csv = '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

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

function addActivityFilters(
  where: string[],
  values: any[],
  filters: ReportFilters,
  activityAlias: string,
  dateAlias: string,
  dateColumn: string,
) {
  const add = (value: any) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.activityId) where.push(`${activityAlias}.id = ${add(filters.activityId)}::bigint`);
  if (filters.activityType) where.push(`${activityAlias}.type = ${add(filters.activityType)}`);
  if (filters.from) where.push(`${dateAlias}.${dateColumn} >= ${add(filters.from)}::date`);
  if (filters.to) where.push(`${dateAlias}.${dateColumn} < (${add(filters.to)}::date + interval '1 day')`);
}

function addParticipantFilters(
  where: string[],
  values: any[],
  filters: ReportFilters,
  responseAlias: string,
) {
  const add = (value: any) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (!filters.category && !filters.organization) return;
  const conditions = [
    `p.organization_id = $1`,
    `(p.id = ${responseAlias}.participant_id OR (${responseAlias}.participant_id is null AND lower(p.email) = lower(${responseAlias}.respondent_email)))`,
  ];
  if (filters.category) conditions.push(`p.category = ${add(filters.category)}`);
  if (filters.organization) conditions.push(`coalesce(p.org, '') = ${add(filters.organization)}`);
  where.push(`exists (select 1 from participants p where ${conditions.join(' and ')})`);
}

async function loadSurveyData(db: ReturnType<typeof getPool>, organizationId: string, filters: ReportFilters) {
  const values: any[] = [organizationId];
  const where = ['s.organization_id = $1'];
  const add = (value: any) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.surveyId) where.push(`s.id = ${add(filters.surveyId)}::bigint`);
  if (filters.activityId) where.push(`s.activity_id = ${add(filters.activityId)}::bigint`);
  if (filters.activityType) where.push(`a.type = ${add(filters.activityType)}`);
  if (filters.from) where.push(`sr.submitted_at >= ${add(filters.from)}::date`);
  if (filters.to) where.push(`sr.submitted_at < (${add(filters.to)}::date + interval '1 day')`);
  addParticipantFilters(where, values, filters, 'sr');

  const responseResult = await db.query(
    `select sr.id, sr.survey_id, sr.participant_id, sr.respondent_name, sr.respondent_email,
            sr.answers, sr.submitted_at,
            s.title as survey_title, s.activity_id, s.status as survey_status,
            a.title as activity_title
     from survey_responses sr
     join surveys s on s.id = sr.survey_id
     left join activities a on a.id = s.activity_id and a.organization_id = s.organization_id
     where ${where.join(' and ')}
     order by sr.submitted_at desc`,
    values
  );

  const surveyValues: any[] = [organizationId];
  const surveyWhere = ['s.organization_id = $1'];
  const surveyAdd = (value: any) => {
    surveyValues.push(value);
    return `$${surveyValues.length}`;
  };
  if (filters.surveyId) surveyWhere.push(`s.id = ${surveyAdd(filters.surveyId)}::bigint`);
  if (filters.activityId) surveyWhere.push(`s.activity_id = ${surveyAdd(filters.activityId)}::bigint`);
  if (filters.activityType) surveyWhere.push(`a.type = ${surveyAdd(filters.activityType)}`);

  const [surveyResult, questionResult] = await Promise.all([
    db.query(
      `select s.id, s.title, s.activity_id, s.status, s.created_at, a.title as activity_title
       from surveys s
       left join activities a on a.id = s.activity_id and a.organization_id = s.organization_id
       where ${surveyWhere.join(' and ')}
       order by s.created_at desc`,
      surveyValues
    ),
    db.query(
      `select q.id, q.survey_id, q.question_text, q.question_type, q.options, q.required, q.sort_order,
              s.title as survey_title
       from survey_questions q
       join surveys s on s.id = q.survey_id
       left join activities a on a.id = s.activity_id and a.organization_id = s.organization_id
       where ${surveyWhere.join(' and ')}
       order by s.created_at desc, q.sort_order asc`,
      surveyValues
    ),
  ]);

  const responses = responseResult.rows;
  const questions = questionResult.rows;
  const responseCounts = new Map<string, number>();
  responses.forEach(row => responseCounts.set(String(row.survey_id), (responseCounts.get(String(row.survey_id)) || 0) + 1));

  const surveys = surveyResult.rows.map(row => ({
    id: row.id,
    title: row.title,
    activityId: row.activity_id,
    activityTitle: row.activity_title || 'Standalone',
    status: row.status,
    responseCount: responseCounts.get(String(row.id)) || 0,
  }));

  const questionAnalysis = questions.map(question => {
    const related = responses.filter(row => String(row.survey_id) === String(question.survey_id));
    const answers = related.map(row => answerFor(row.answers, question.id)).filter(Boolean);
    const type = question.question_type;
    const base = {
      id: question.id,
      surveyId: question.survey_id,
      surveyTitle: question.survey_title,
      question: question.question_text,
      type,
      answered: answers.length,
      totalResponses: related.length,
      responseRate: percent(answers.length, related.length),
      average: null as number | null,
      distribution: [] as Array<{ label: string; value: number }>,
      samples: [] as string[],
    };

    if (type === 'rating') {
      const distribution = [1, 2, 3, 4, 5].map(value => ({
        label: String(value),
        value: answers.filter(answer => Number(answer) === value).length,
      }));
      return { ...base, average: average(answers.map(answer => number(answer))), distribution };
    }

    if (type === 'multiple_choice' || type === 'yes_no') {
      const configured = type === 'yes_no' ? ['Yes', 'No'] : (Array.isArray(question.options) ? question.options.map(String) : []);
      const labels = configured.length ? configured : [...new Set(answers)];
      const distribution = labels.map(label => ({ label, value: answers.filter(answer => answer === label).length }));
      return { ...base, distribution };
    }

    return { ...base, samples: answers.slice(0, 5).map(answer => answer.slice(0, 240)) };
  });

  const ratingAverages = questionAnalysis
    .filter(question => question.type === 'rating')
    .flatMap(question => question.average === null ? [] : [question.average]);
  const averageRating = average(ratingAverages);

  const dataQuality: string[] = [];
  if (!responses.length) dataQuality.push('No survey responses match the current filters.');
  if ((filters.category || filters.organization) && responses.length) {
    dataQuality.push('Participant profile filters only include responses that can be matched to a participant record by ID or email; anonymous responses are excluded.');
  }
  if (responses.length && averageRating === null) dataQuality.push('No rating questions are available in the filtered survey responses, so an overall satisfaction average cannot be calculated.');

  const insights: string[] = [];
  if (responses.length) insights.push(`${responses.length} survey response${responses.length === 1 ? '' : 's'} match the current filters.`);
  if (averageRating !== null) insights.push(`Average rating across rating questions is ${averageRating.toFixed(2)} out of 5.`);
  const strongest = questionAnalysis
    .filter(question => question.type === 'rating' && question.average !== null)
    .sort((a, b) => Number(b.average) - Number(a.average))[0];
  if (strongest?.average !== null && strongest) insights.push(`Highest-rated item is “${strongest.question}” at ${Number(strongest.average).toFixed(2)}/5.`);

  return {
    summary: {
      surveyCount: surveys.length,
      responseCount: responses.length,
      averageRating,
      ratingQuestionCount: questionAnalysis.filter(question => question.type === 'rating').length,
    },
    surveys,
    questions: questionAnalysis,
    responseRecords: responses.map(row => ({
      id: row.id,
      surveyId: row.survey_id,
      survey: row.survey_title,
      activity: row.activity_title || 'Standalone',
      respondent: row.respondent_name || (row.respondent_email ? 'Named respondent' : 'Anonymous'),
      email: row.respondent_email || '',
      submittedAt: row.submitted_at,
      answered: Object.values(row.answers || {}).filter(value => String(value ?? '').trim()).length,
    })),
    rawResponses: responses,
    rawQuestions: questions,
    insights,
    dataQuality,
  };
}

async function loadAssessmentData(db: ReturnType<typeof getPool>, organizationId: string, filters: ReportFilters) {
  const values: any[] = [organizationId];
  const where = ['a.organization_id = $1'];
  const add = (value: any) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.assessmentId) where.push(`a.id = ${add(filters.assessmentId)}::bigint`);
  if (filters.activityId) where.push(`a.activity_id = ${add(filters.activityId)}::bigint`);
  if (filters.activityType) where.push(`act.type = ${add(filters.activityType)}`);
  if (filters.from) where.push(`sub.submitted_at >= ${add(filters.from)}::date`);
  if (filters.to) where.push(`sub.submitted_at < (${add(filters.to)}::date + interval '1 day')`);
  addParticipantFilters(where, values, filters, 'sub');

  const submissionResult = await db.query(
    `select sub.id, sub.assessment_id, sub.participant_id, sub.respondent_name, sub.respondent_email,
            sub.answers, sub.score, sub.total_points, sub.percentage, sub.passed, sub.submitted_at,
            a.title as assessment_title, a.activity_id, a.assessment_type, a.passing_score,
            act.title as activity_title
     from assessment_submissions sub
     join assessments a on a.id = sub.assessment_id
     left join activities act on act.id = a.activity_id and act.organization_id = a.organization_id
     where ${where.join(' and ')}
     order by sub.submitted_at desc`,
    values
  );

  const assessmentValues: any[] = [organizationId];
  const assessmentWhere = ['a.organization_id = $1'];
  const assessmentAdd = (value: any) => {
    assessmentValues.push(value);
    return `$${assessmentValues.length}`;
  };
  if (filters.assessmentId) assessmentWhere.push(`a.id = ${assessmentAdd(filters.assessmentId)}::bigint`);
  if (filters.activityId) assessmentWhere.push(`a.activity_id = ${assessmentAdd(filters.activityId)}::bigint`);
  if (filters.activityType) assessmentWhere.push(`act.type = ${assessmentAdd(filters.activityType)}`);

  const [assessmentResult, questionResult] = await Promise.all([
    db.query(
      `select a.id, a.title, a.activity_id, a.assessment_type, a.passing_score, a.status, a.created_at,
              act.title as activity_title
       from assessments a
       left join activities act on act.id = a.activity_id and act.organization_id = a.organization_id
       where ${assessmentWhere.join(' and ')}
       order by a.created_at desc`,
      assessmentValues
    ),
    db.query(
      `select q.id, q.assessment_id, q.question_text, q.question_type, q.options, q.correct_answer, q.points, q.sort_order,
              a.title as assessment_title
       from assessment_questions q
       join assessments a on a.id = q.assessment_id
       left join activities act on act.id = a.activity_id and act.organization_id = a.organization_id
       where ${assessmentWhere.join(' and ')}
       order by a.created_at desc, q.sort_order asc`,
      assessmentValues
    ),
  ]);

  const submissions = submissionResult.rows;
  const questions = questionResult.rows;
  const submissionCounts = new Map<string, number>();
  submissions.forEach(row => submissionCounts.set(String(row.assessment_id), (submissionCounts.get(String(row.assessment_id)) || 0) + 1));

  const assessments = assessmentResult.rows.map(row => ({
    id: row.id,
    title: row.title,
    activityId: row.activity_id,
    activityTitle: row.activity_title || 'Standalone',
    type: row.assessment_type,
    passingScore: row.passing_score,
    status: row.status,
    submissionCount: submissionCounts.get(String(row.id)) || 0,
  }));

  const questionAnalysis = questions.map(question => {
    const related = submissions.filter(row => String(row.assessment_id) === String(question.assessment_id));
    const answers = related.map(row => answerFor(row.answers, question.id)).filter(Boolean);
    const type = question.question_type;
    const distribution = (type === 'true_false' ? ['True', 'False'] : (Array.isArray(question.options) ? question.options.map(String) : []))
      .map(label => ({ label, value: answers.filter(answer => answer === label).length }));
    const hasKey = question.correct_answer != null && String(question.correct_answer).trim() !== '';
    const correctCount = hasKey ? answers.filter(answer => sameAnswer(answer, question.correct_answer)).length : 0;
    return {
      id: question.id,
      assessmentId: question.assessment_id,
      assessmentTitle: question.assessment_title,
      question: question.question_text,
      type,
      points: Number(question.points || 0),
      answered: answers.length,
      totalSubmissions: related.length,
      responseRate: percent(answers.length, related.length),
      correctAnswerConfigured: hasKey,
      correctRate: hasKey ? percent(correctCount, answers.length) : null,
      distribution,
      samples: ['short_answer', 'long_answer'].includes(type) ? answers.slice(0, 5).map(answer => answer.slice(0, 240)) : [],
    };
  });

  const percentages = submissions.map(row => number(row.percentage));
  const passedCount = submissions.filter(row => row.passed === true).length;
  const pre = submissions.filter(row => row.assessment_type === 'pre');
  const post = submissions.filter(row => row.assessment_type === 'post');
  const preAverage = average(pre.map(row => number(row.percentage)));
  const postAverage = average(post.map(row => number(row.percentage)));

  const matched = new Map<string, { pre?: any; post?: any }>();
  for (const row of submissions) {
    if (!['pre', 'post'].includes(row.assessment_type) || !row.activity_id) continue;
    const identity = row.participant_id
      ? `p:${row.participant_id}`
      : (String(row.respondent_email || '').trim() ? `e:${String(row.respondent_email).trim().toLowerCase()}` : null);
    if (!identity) continue;
    const key = `${row.activity_id}:${identity}`;
    const current = matched.get(key) || {};
    const slot = row.assessment_type as 'pre' | 'post';
    if (!current[slot] || new Date(row.submitted_at).getTime() > new Date(current[slot].submitted_at).getTime()) current[slot] = row;
    matched.set(key, current);
  }

  const pairs = [...matched.values()].filter(item => item.pre && item.post) as Array<{ pre: any; post: any }>;
  const matchedPreAverage = average(pairs.map(pair => number(pair.pre.percentage)));
  const matchedPostAverage = average(pairs.map(pair => number(pair.post.percentage)));
  const matchedChange = matchedPreAverage !== null && matchedPostAverage !== null
    ? Math.round((matchedPostAverage - matchedPreAverage) * 100) / 100
    : null;
  const aggregateChange = preAverage !== null && postAverage !== null
    ? Math.round((postAverage - preAverage) * 100) / 100
    : null;

  const missingKeys = questions.filter(question => Number(question.points || 0) > 0 && (question.correct_answer == null || String(question.correct_answer).trim() === '')).length;
  const dataQuality: string[] = [];
  if (!submissions.length) dataQuality.push('No assessment submissions match the current filters.');
  if ((filters.category || filters.organization) && submissions.length) {
    dataQuality.push('Participant profile filters only include submissions that can be matched to a participant record by ID or email.');
  }
  if (missingKeys) dataQuality.push(`${missingKeys} scored question${missingKeys === 1 ? '' : 's'} do not have a correct answer configured; automatic scores may not reflect the full assessment.`);
  if ((pre.length || post.length) && !pairs.length) dataQuality.push('Pre/post assessments exist, but no participants could be matched across both stages by participant ID or email. The comparison therefore uses aggregate averages only.');

  const passRate = percent(passedCount, submissions.length);
  const averageScore = average(percentages);
  const insights: string[] = [];
  if (submissions.length) insights.push(`${submissions.length} assessment submission${submissions.length === 1 ? '' : 's'} match the current filters.`);
  if (averageScore !== null) insights.push(`Average assessment score is ${averageScore.toFixed(2)}%.`);
  if (passRate !== null) insights.push(`${passRate.toFixed(2)}% of filtered submissions met their assessment pass mark.`);
  if (matchedChange !== null) insights.push(`Among ${pairs.length} matched participant${pairs.length === 1 ? '' : 's'}, post-test scores changed by ${matchedChange >= 0 ? '+' : ''}${matchedChange.toFixed(2)} percentage points on average.`);
  else if (aggregateChange !== null) insights.push(`Aggregate post-test average differs from the pre-test average by ${aggregateChange >= 0 ? '+' : ''}${aggregateChange.toFixed(2)} percentage points.`);

  return {
    summary: {
      assessmentCount: assessments.length,
      submissionCount: submissions.length,
      averageScore,
      passRate,
      passedCount,
      failedCount: Math.max(submissions.length - passedCount, 0),
    },
    assessments,
    questions: questionAnalysis,
    prePost: {
      preCount: pre.length,
      postCount: post.length,
      preAverage,
      postAverage,
      aggregateChange,
      matchedParticipants: pairs.length,
      matchedPreAverage,
      matchedPostAverage,
      matchedChange,
    },
    submissionRecords: submissions.map(row => ({
      id: row.id,
      assessmentId: row.assessment_id,
      assessment: row.assessment_title,
      activity: row.activity_title || 'Standalone',
      type: row.assessment_type,
      respondent: row.respondent_name || (row.respondent_email ? 'Named respondent' : 'Unidentified'),
      email: row.respondent_email || '',
      score: row.score,
      totalPoints: row.total_points,
      percentage: number(row.percentage),
      passed: row.passed === true,
      submittedAt: row.submitted_at,
    })),
    rawSubmissions: submissions,
    rawQuestions: questions,
    insights,
    dataQuality,
  };
}

export default async (request: Request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const tenant = await requireTenant(request);
  if (!tenant) return json({ error: 'Unauthorized' }, 401);

  const db = getPool();
  const billing = await getBillingSnapshot(db, tenant.organization_id);
  if (billing.subscription.plan !== 'pro') {
    return json({
      error: 'Advanced survey and assessment analytics are available on LexAMS Pro.',
      code: 'PRO_REQUIRED',
      feature: 'advanced analytics',
    }, 403);
  }

  const url = new URL(request.url);
  const filters = parseFilters(url);
  const [surveyData, assessmentData] = await Promise.all([
    loadSurveyData(db, tenant.organization_id, filters),
    loadAssessmentData(db, tenant.organization_id, filters),
  ]);

  const format = clean(url.searchParams.get('format'));
  const reportType = clean(url.searchParams.get('type'));
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    if (!billing.entitlements.csvExport) return json({ error: 'CSV export is available on LexAMS Pro.', code: 'PRO_REQUIRED' }, 403);

    if (reportType === 'surveys') {
      const rows: unknown[][] = [['Survey', 'Activity', 'Respondent', 'Email', 'Submitted', 'Question', 'Question type', 'Answer']];
      for (const response of surveyData.rawResponses) {
        const relatedQuestions = surveyData.rawQuestions.filter((question: any) => String(question.survey_id) === String(response.survey_id));
        for (const question of relatedQuestions) {
          const answer = answerFor(response.answers, question.id);
          if (!answer) continue;
          rows.push([
            response.survey_title,
            response.activity_title || 'Standalone',
            response.respondent_name || (response.respondent_email ? 'Named respondent' : 'Anonymous'),
            response.respondent_email || '',
            response.submitted_at,
            question.question_text,
            titleCase(question.question_type),
            answer,
          ]);
        }
      }
      return csvResponse(rows, `lexams-survey-analysis-${stamp}.csv`);
    }

    if (reportType === 'assessments') {
      const rows: unknown[][] = [['Assessment', 'Activity', 'Type', 'Respondent', 'Email', 'Score', 'Total points', 'Percentage', 'Passed', 'Submitted']];
      for (const row of assessmentData.rawSubmissions) {
        rows.push([
          row.assessment_title,
          row.activity_title || 'Standalone',
          titleCase(row.assessment_type),
          row.respondent_name || (row.respondent_email ? 'Named respondent' : 'Unidentified'),
          row.respondent_email || '',
          row.score,
          row.total_points,
          row.percentage,
          row.passed ? 'Yes' : 'No',
          row.submitted_at,
        ]);
      }
      return csvResponse(rows, `lexams-assessment-analysis-${stamp}.csv`);
    }
  }

  const { rawResponses, rawQuestions: surveyRawQuestions, ...surveys } = surveyData;
  const { rawSubmissions, rawQuestions: assessmentRawQuestions, ...assessments } = assessmentData;
  void rawResponses;
  void surveyRawQuestions;
  void rawSubmissions;
  void assessmentRawQuestions;

  return json({ surveys, assessments, generatedAt: new Date().toISOString() });
};

export const config: Config = {
  path: '/api/report-analytics',
  method: ['GET'],
};
