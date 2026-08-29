import { calculateBudgetSummary, calculateJournalSummary } from '../../../shared/planning.js';
import { hashReportSource, reportSourceLabel } from '../../../shared/reporting.js';

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: unknown) {
  return value ? String(value).slice(0, 10) : null;
}

function round(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function countBy<T>(values: T[], read: (value: T) => string) {
  const counts = new Map<string, number>();
  values.forEach(value => {
    const label = read(value) || 'Not specified';
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function withMeta(type: string, payload: Record<string, unknown>) {
  const source = { type, label: reportSourceLabel(type), ...payload };
  return { ...source, hash: hashReportSource(source) };
}

export async function loadActivityReportSourceBundle(db: any, organizationId: string, activityId: number) {
  const [activityResult, tasksResult, sessionsResult, participantsResult, attendanceResult, budgetResult, journalResult, surveysResult, assessmentsResult, certificatesResult] = await Promise.all([
    db.query(
      `select a.id,a.title,a.type,a.status,a.start_date,a.end_date,a.venue,a.organizer,a.facilitator,
              a.description,a.budget_currency,o.name as organization_name,o.logo_url
       from activities a join organizations o on o.id=a.organization_id
       where a.id=$1 and a.organization_id=$2 limit 1`,
      [activityId, organizationId],
    ),
    db.query(
      `select id,title,description,stage,due_date,priority,status,completed_at
       from activity_tasks where organization_id=$1 and activity_id=$2
       order by sort_order,due_date nulls last,id`,
      [organizationId, activityId],
    ),
    db.query(
      `select s.id,s.title,s.session_date,s.starts_at,s.ends_at,s.venue,s.description,
              s.learning_objectives,s.planning_status,
              coalesce(f.facilitators,'[]'::jsonb) as facilitators
       from activity_sessions s
       left join lateral (
         select jsonb_agg(jsonb_build_object(
           'user_id',sf.user_id,'name',coalesce(nullif(p.full_name,''),nullif(u.name,''),u.email),
           'is_lead',sf.is_lead
         ) order by sf.is_lead desc,coalesce(p.full_name,u.name,u.email)) as facilitators
         from session_facilitators sf
         join users u on u.id=sf.user_id
         left join profiles p on p.user_id=sf.user_id
         where sf.organization_id=s.organization_id and sf.activity_id=s.activity_id and sf.session_id=s.id
       ) f on true
       where s.organization_id=$1 and s.activity_id=$2
       order by s.session_date,s.sort_order,s.id`,
      [organizationId, activityId],
    ),
    db.query(
      `select p.id,p.name,p.org,p.category,r.registered_at
       from registrations r join participants p on p.id=r.participant_id and p.organization_id=r.organization_id
       where r.organization_id=$1 and r.activity_id=$2
       order by p.name,p.id`,
      [organizationId, activityId],
    ),
    db.query(
      `select session_label,status,count(*)::int as count
       from attendance where organization_id=$1 and activity_id=$2
       group by session_label,status order by session_label,status`,
      [organizationId, activityId],
    ),
    db.query(
      `select id,category,item_name,planned_amount,actual_amount,evidence_date,notes
       from activity_budget_items where organization_id=$1 and activity_id=$2
       order by category,item_name,id`,
      [organizationId, activityId],
    ),
    db.query(
      `select id,entry_mode,entry_date,period_end,progress_summary,achievements,challenges,
              observations_lessons,actions_follow_up,follow_up_status,include_in_report
       from activity_journal_entries where organization_id=$1 and activity_id=$2
       order by entry_date,id`,
      [organizationId, activityId],
    ),
    db.query(
      `select s.id,s.title,s.status,count(r.id)::int as response_count
       from surveys s left join survey_responses r on r.survey_id=s.id
       where s.organization_id=$1 and s.activity_id=$2
       group by s.id,s.title,s.status order by s.created_at,s.id`,
      [organizationId, activityId],
    ),
    db.query(
      `select a.id,a.title,a.assessment_type,a.status,a.passing_score,
              count(s.id)::int as submission_count,
              round(avg(s.percentage),2) as average_score,
              round(100.0*count(*) filter (where s.passed is true)/nullif(count(s.id),0),2) as pass_rate
       from assessments a left join assessment_submissions s on s.assessment_id=a.id and s.submitted_at is not null
       where a.organization_id=$1 and a.activity_id=$2
       group by a.id,a.title,a.assessment_type,a.status,a.passing_score order by a.created_at,a.id`,
      [organizationId, activityId],
    ),
    db.query(
      `select certificate_type,count(*)::int as count
       from certificates where organization_id=$1 and activity_id=$2
       group by certificate_type order by certificate_type`,
      [organizationId, activityId],
    ),
  ]);

  const activity = activityResult.rows[0];
  if (!activity) return null;

  const tasks = tasksResult.rows;
  const sessions = sessionsResult.rows.map((session: any) => ({
    ...session,
    session_date: dateValue(session.session_date),
    starts_at: session.starts_at ? String(session.starts_at).slice(0, 5) : null,
    ends_at: session.ends_at ? String(session.ends_at).slice(0, 5) : null,
  }));
  const participants = participantsResult.rows;
  const attendance = attendanceResult.rows.map((row: any) => ({ ...row, count: number(row.count) }));
  const budgetItems = budgetResult.rows;
  const journalEntries = journalResult.rows;
  const surveys = surveysResult.rows.map((row: any) => ({ ...row, response_count: number(row.response_count) }));
  const assessments = assessmentsResult.rows.map((row: any) => ({
    ...row,
    submission_count: number(row.submission_count),
    average_score: round(row.average_score),
    pass_rate: round(row.pass_rate),
  }));
  const certificates = certificatesResult.rows.map((row: any) => ({ label: row.certificate_type, value: number(row.count) }));

  const budget = calculateBudgetSummary(budgetItems);
  const journal = calculateJournalSummary(journalEntries);
  const attendanceTotal = attendance.reduce((sum: number, row: any) => sum + row.count, 0);
  const present = attendance.filter((row: any) => row.status === 'present').reduce((sum: number, row: any) => sum + row.count, 0);
  const late = attendance.filter((row: any) => row.status === 'late').reduce((sum: number, row: any) => sum + row.count, 0);
  const absent = attendance.filter((row: any) => row.status === 'absent').reduce((sum: number, row: any) => sum + row.count, 0);
  const attendanceRate = attendanceTotal ? Math.round(((present + late) / attendanceTotal) * 100) : null;
  const facilitatorMap = new Map<string, { user_id: string; name: string; sessions: number }>();
  sessions.forEach((session: any) => (session.facilitators || []).forEach((person: any) => {
    const key = String(person.user_id);
    const current = facilitatorMap.get(key) || { user_id: key, name: person.name, sessions: 0 };
    current.sessions += 1;
    facilitatorMap.set(key, current);
  }));
  const facilitators = [...facilitatorMap.values()].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
  const surveyResponses = surveys.reduce((sum: number, row: any) => sum + row.response_count, 0);
  const assessmentSubmissions = assessments.reduce((sum: number, row: any) => sum + row.submission_count, 0);
  const weightedAssessmentScore = assessmentSubmissions
    ? round(assessments.reduce((sum: number, row: any) => sum + number(row.average_score) * row.submission_count, 0) / assessmentSubmissions)
    : null;
  const weightedPassRate = assessmentSubmissions
    ? round(assessments.reduce((sum: number, row: any) => sum + number(row.pass_rate) * row.submission_count, 0) / assessmentSubmissions)
    : null;
  const certificateTotal = certificates.reduce((sum: number, item: any) => sum + item.value, 0);

  const sources: Record<string, any> = {
    activity_details: withMeta('activity_details', {
      available: true,
      summary: {
        title: activity.title, type: activity.type, status: activity.status,
        startDate: dateValue(activity.start_date), endDate: dateValue(activity.end_date),
        venue: activity.venue, organizer: activity.organizer, facilitator: activity.facilitator,
        description: activity.description,
      },
      records: [],
    }),
    tasks: withMeta('tasks', {
      available: tasks.length > 0,
      summary: {
        total: tasks.length,
        completed: tasks.filter((item: any) => item.status === 'done').length,
        overdue: tasks.filter((item: any) => item.status !== 'done' && item.due_date && dateValue(item.due_date)! < new Date().toISOString().slice(0, 10)).length,
      },
      breakdown: countBy(tasks, (item: any) => item.status),
      records: tasks.map((item: any) => ({ id: item.id, title: item.title, stage: item.stage, status: item.status, dueDate: dateValue(item.due_date) })),
    }),
    sessions: withMeta('sessions', {
      available: sessions.length > 0,
      summary: {
        total: sessions.length,
        delivered: sessions.filter((item: any) => item.planning_status === 'delivered').length,
        ready: sessions.filter((item: any) => item.planning_status === 'ready').length,
      },
      breakdown: countBy(sessions, (item: any) => item.planning_status),
      records: sessions.map((item: any) => ({
        id: item.id, title: item.title, date: item.session_date, startsAt: item.starts_at, endsAt: item.ends_at,
        venue: item.venue, status: item.planning_status, facilitators: (item.facilitators || []).map((person: any) => person.name),
      })),
    }),
    facilitators: withMeta('facilitators', {
      available: facilitators.length > 0,
      summary: { total: facilitators.length, assignments: facilitators.reduce((sum, item) => sum + item.sessions, 0) },
      breakdown: facilitators.map(item => ({ label: item.name, value: item.sessions })),
      records: facilitators,
    }),
    participants: withMeta('participants', {
      available: participants.length > 0,
      summary: { total: participants.length, organizations: new Set(participants.map((item: any) => item.org).filter(Boolean)).size },
      breakdown: countBy(participants, (item: any) => item.category),
      secondaryBreakdown: countBy(participants.filter((item: any) => item.org), (item: any) => item.org).slice(0, 10),
      records: participants.map((item: any) => ({ id: item.id, name: item.name, organization: item.org, category: item.category })),
    }),
    attendance: withMeta('attendance', {
      available: attendanceTotal > 0,
      summary: { records: attendanceTotal, rate: attendanceRate, present, late, absent },
      breakdown: [
        { label: 'Present', value: present }, { label: 'Late', value: late }, { label: 'Absent', value: absent },
      ],
      records: attendance.map((item: any) => ({ session: item.session_label, status: item.status, count: item.count })),
    }),
    budget: withMeta('budget', {
      available: budgetItems.length > 0,
      summary: {
        currency: activity.budget_currency || 'GMD', planned: budget.planned, actual: budget.actual,
        variance: budget.actual - budget.planned, percentUsed: budget.usedPercent, items: budgetItems.length,
      },
      breakdown: budget.categories.map((item: any) => ({ label: item.category, value: item.actual })),
      records: budgetItems.map((item: any) => ({ id: item.id, category: item.category, item: item.item_name, planned: number(item.planned_amount), actual: number(item.actual_amount) })),
    }),
    journal: withMeta('journal', {
      available: journalEntries.length > 0,
      summary: { total: journal.entryCount, openFollowUps: journal.openFollowUps, reportRelevant: journal.reportRelevantCount },
      records: journalEntries.filter((item: any) => item.include_in_report).map((item: any) => ({
        id: item.id, date: dateValue(item.entry_date), periodEnd: dateValue(item.period_end), progress: item.progress_summary,
        achievements: item.achievements, challenges: item.challenges, lessons: item.observations_lessons,
        actions: item.actions_follow_up, followUpStatus: item.follow_up_status,
      })),
    }),
    surveys: withMeta('surveys', {
      available: surveys.length > 0,
      summary: { surveys: surveys.length, responses: surveyResponses, averageRating: null },
      breakdown: surveys.map((item: any) => ({ label: item.title, value: item.response_count })),
      records: surveys.map((item: any) => ({ id: item.id, title: item.title, status: item.status, responses: item.response_count })),
    }),
    assessments: withMeta('assessments', {
      available: assessments.length > 0,
      summary: { assessments: assessments.length, submissions: assessmentSubmissions, averageScore: weightedAssessmentScore, passRate: weightedPassRate },
      breakdown: assessments.map((item: any) => ({ label: item.title, value: item.average_score || 0 })),
      records: assessments.map((item: any) => ({ id: item.id, title: item.title, type: item.assessment_type, submissions: item.submission_count, averageScore: item.average_score, passRate: item.pass_rate })),
    }),
    certificates: withMeta('certificates', {
      available: certificateTotal > 0,
      summary: { total: certificateTotal },
      breakdown: certificates,
      records: certificates,
    }),
  };

  sources.combined = withMeta('combined', {
    available: true,
    summary: {
      title: activity.title,
      participants: participants.length,
      attendanceRate,
      sessions: sessions.length,
      deliveredSessions: sessions.filter((item: any) => item.planning_status === 'delivered').length,
      journalEntries: journal.entryCount,
      plannedBudget: budget.planned,
      actualBudget: budget.actual,
      currency: activity.budget_currency || 'GMD',
      assessmentAverage: weightedAssessmentScore,
      surveyResponses,
      certificates: certificateTotal,
    },
    records: [],
  });

  return {
    activity: {
      ...activity,
      start_date: dateValue(activity.start_date),
      end_date: dateValue(activity.end_date),
    },
    organization: { name: activity.organization_name, logo_url: activity.logo_url },
    sources,
  };
}
