import { calculateBudgetSummary, calculateJournalSummary } from '../../shared/planning.js';
import {
  calculateReportCompletion,
  generateReportNarrative,
  hashReportSource,
  reportSourceLabel,
} from '../../shared/reporting.js';
import { getPlanningPreview } from './planningPreviewDemo.js';
import { getReportPreviewAdvanced, reportPreviewDemo } from './reportPreviewDemo.js';

function countBy(values, read) {
  const counts = new Map();
  values.forEach(value => {
    const label = read(value) || 'Not specified';
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function withMeta(type, payload) {
  const source = { type, label: reportSourceLabel(type), ...payload };
  return { ...source, hash: hashReportSource(source) };
}

const trainingSections = [
  ['Executive Summary', 'generated', 'combined', 'summary', true],
  ['Background', 'manual', null, 'none', true],
  ['Objectives', 'linked', 'activity_details', 'summary', true],
  ['Participant Profile', 'linked', 'participants', 'bars', true],
  ['Training Delivery', 'generated', 'sessions', 'table', true],
  ['Attendance & Engagement', 'linked', 'attendance', 'bars', true],
  ['Financial Summary', 'linked', 'budget', 'bars', false],
  ['Learning & Feedback', 'hybrid', 'assessments', 'bars', false],
  ['Challenges & Lessons Learned', 'hybrid', 'journal', 'summary', true],
  ['Conclusion & Recommendations', 'manual', null, 'none', true],
];

const workshopSections = [
  ['Workshop Summary', 'generated', 'combined', 'summary', true],
  ['Purpose & Objectives', 'linked', 'activity_details', 'summary', true],
  ['Participation', 'linked', 'participants', 'bars', true],
  ['Workshop Delivery', 'generated', 'sessions', 'table', true],
  ['Attendance', 'linked', 'attendance', 'bars', false],
  ['Feedback & Learning', 'hybrid', 'surveys', 'bars', false],
  ['Key Lessons & Next Steps', 'hybrid', 'journal', 'summary', true],
];

const projectSections = [
  ['Activity Summary', 'generated', 'combined', 'summary', true],
  ['Planned Outputs', 'hybrid', 'tasks', 'summary', true],
  ['Implementation Progress', 'generated', 'journal', 'summary', true],
  ['Delivery Schedule', 'linked', 'sessions', 'table', false],
  ['Participation & Reach', 'linked', 'participants', 'bars', true],
  ['Budget Performance', 'linked', 'budget', 'bars', false],
  ['Challenges, Lessons & Actions', 'hybrid', 'journal', 'summary', true],
  ['Recommendations', 'manual', null, 'none', true],
];

function templateSections(rows, prefix) {
  return rows.map(([title, sectionType, sourceType, visualization, required], index) => ({
    id: `${prefix}-${index + 1}`,
    title,
    section_type: sectionType,
    source_type: sourceType,
    instructions: sectionType === 'manual' ? `Write the ${title.toLowerCase()} in the organisation's voice.` : `Use only verified ${reportSourceLabel(sourceType).toLowerCase()} records.`,
    starter_text: '',
    visualization,
    is_required: required,
    position: (index + 1) * 10,
  }));
}

const templates = [
  { id: -101, code: 'training-report', name: 'Training Report', description: 'A complete training report covering delivery, participants, attendance, learning, budget and lessons.', is_builtin: true, sections: templateSections(trainingSections, 'training') },
  { id: -102, code: 'workshop-report', name: 'Workshop Report', description: 'A concise workshop report focused on objectives, participation, delivery, feedback and next steps.', is_builtin: true, sections: templateSections(workshopSections, 'workshop') },
  { id: -103, code: 'project-activity-report', name: 'Project Activity Report', description: 'An implementation report covering progress, outputs, expenditure, challenges and follow-up.', is_builtin: true, sections: templateSections(projectSections, 'project') },
  { id: -104, name: 'LexAMS Programme Close-out', description: 'A customised organisation template for recurring capacity-building programmes.', is_builtin: false, sections: templateSections(trainingSections, 'custom') },
];

export function getActivityReportPreview(activity = {}) {
  const planning = getPlanningPreview(activity);
  const activityId = Number(activity.id || -8101);
  const registrations = reportPreviewDemo.registrations.filter(item => Number(item.activity_id) === activityId);
  const participantIds = new Set(registrations.map(item => item.participant_id));
  const participants = reportPreviewDemo.participants.filter(item => participantIds.has(item.id));
  const attendanceRows = reportPreviewDemo.attendance.filter(item => Number(item.activity_id) === activityId);
  const advanced = getReportPreviewAdvanced({ activity: String(activityId) });
  const assessmentRecords = reportPreviewDemo.assessments
    .filter(item => Number(item.activity_id) === activityId)
    .map(item => {
      const submissions = advanced.assessments.submissionRecords.filter(row => Number(row.assessmentId) === Number(item.id));
      const averageScore = submissions.length ? Math.round((submissions.reduce((sum, row) => sum + Number(row.percentage || 0), 0) / submissions.length) * 100) / 100 : null;
      const passRate = submissions.length ? Math.round((submissions.filter(row => row.passed).length / submissions.length) * 10000) / 100 : null;
      return { id: item.id, title: item.title, type: item.assessment_type, submissions: submissions.length, averageScore, passRate };
    });
  const budget = calculateBudgetSummary(planning.budgetItems);
  const journal = calculateJournalSummary(planning.journalEntries);
  const present = attendanceRows.filter(item => item.status === 'present').length;
  const late = attendanceRows.filter(item => item.status === 'late').length;
  const absent = attendanceRows.filter(item => item.status === 'absent').length;
  const attendanceRate = attendanceRows.length ? Math.round(((present + late) / attendanceRows.length) * 100) : null;
  const facilitatorMap = new Map();
  planning.sessions.forEach(session => session.facilitators.forEach(person => {
    const current = facilitatorMap.get(person.user_id) || { user_id: person.user_id, name: person.name, sessions: 0 };
    current.sessions += 1;
    facilitatorMap.set(person.user_id, current);
  }));
  const facilitators = [...facilitatorMap.values()];
  const activityCertificates = reportPreviewDemo.certificates.filter(item => Number(item.activity_id) === activityId);

  const sources = {
    activity_details: withMeta('activity_details', { available: true, summary: { title: planning.activity.title, type: activity.type || 'Training', status: activity.status || 'Completed', startDate: planning.activity.start_date, endDate: planning.activity.end_date, venue: planning.activity.venue, organizer: activity.organizer || 'LexAMS Demo Workspace', facilitator: activity.facilitator || 'Ebrima Njie and Awa Ceesay', description: planning.activity.description }, records: [] }),
    tasks: withMeta('tasks', { available: true, summary: { total: planning.tasks.length, completed: planning.tasks.filter(item => item.status === 'done').length, overdue: planning.tasks.filter(item => item.status !== 'done').length }, breakdown: countBy(planning.tasks, item => item.status), records: planning.tasks.map(item => ({ id: item.id, title: item.title, stage: item.stage, status: item.status, dueDate: item.due_date })) }),
    sessions: withMeta('sessions', { available: true, summary: { total: planning.sessions.length, delivered: planning.sessions.filter(item => item.planning_status === 'delivered').length, ready: planning.sessions.filter(item => item.planning_status === 'ready').length }, breakdown: countBy(planning.sessions, item => item.planning_status), records: planning.sessions.map(item => ({ id: item.id, title: item.title, date: item.session_date, startsAt: item.starts_at, endsAt: item.ends_at, venue: item.venue, status: item.planning_status, facilitators: item.facilitators.map(person => person.name) })) }),
    facilitators: withMeta('facilitators', { available: facilitators.length > 0, summary: { total: facilitators.length, assignments: facilitators.reduce((sum, item) => sum + item.sessions, 0) }, breakdown: facilitators.map(item => ({ label: item.name, value: item.sessions })), records: facilitators }),
    participants: withMeta('participants', { available: participants.length > 0, summary: { total: participants.length, organizations: new Set(participants.map(item => item.org)).size }, breakdown: countBy(participants, item => item.category), secondaryBreakdown: countBy(participants, item => item.org), records: participants.map(item => ({ id: item.id, name: item.name, organization: item.org, category: item.category })) }),
    attendance: withMeta('attendance', { available: attendanceRows.length > 0, summary: { records: attendanceRows.length, rate: attendanceRate, present, late, absent }, breakdown: [{ label: 'Present', value: present }, { label: 'Late', value: late }, { label: 'Absent', value: absent }], records: countBy(attendanceRows, item => `${item.session_label} · ${item.status}`).map(item => ({ session: item.label.split(' · ')[0], status: item.label.split(' · ')[1], count: item.value })) }),
    budget: withMeta('budget', { available: planning.budgetItems.length > 0, summary: { currency: planning.activity.budget_currency, planned: budget.planned, actual: budget.actual, variance: budget.actual - budget.planned, percentUsed: budget.usedPercent, items: planning.budgetItems.length }, breakdown: budget.categories.map(item => ({ label: item.category, value: item.actual })), records: planning.budgetItems.map(item => ({ id: item.id, category: item.category, item: item.item_name, planned: item.planned_amount, actual: item.actual_amount })) }),
    journal: withMeta('journal', { available: planning.journalEntries.length > 0, summary: { total: journal.entryCount, openFollowUps: journal.openFollowUps, reportRelevant: journal.reportRelevantCount }, records: planning.journalEntries.map(item => ({ id: item.id, date: item.entry_date, periodEnd: item.period_end, progress: item.progress_summary, achievements: item.achievements, challenges: item.challenges, lessons: item.observations_lessons, actions: item.actions_follow_up, followUpStatus: item.follow_up_status })) }),
    surveys: withMeta('surveys', { available: advanced.surveys.summary.surveyCount > 0, summary: { surveys: advanced.surveys.summary.surveyCount, responses: advanced.surveys.summary.responseCount, averageRating: advanced.surveys.summary.averageRating }, breakdown: advanced.surveys.surveys.map(item => ({ label: item.title, value: item.responseCount })), records: advanced.surveys.surveys }),
    assessments: withMeta('assessments', { available: assessmentRecords.length > 0, summary: { assessments: advanced.assessments.summary.assessmentCount, submissions: advanced.assessments.summary.submissionCount, averageScore: advanced.assessments.summary.averageScore, passRate: advanced.assessments.summary.passRate }, breakdown: assessmentRecords.map(item => ({ label: item.title, value: item.averageScore || 0 })), records: assessmentRecords }),
    certificates: withMeta('certificates', { available: activityCertificates.length > 0, summary: { total: activityCertificates.length }, breakdown: countBy(activityCertificates, item => item.certificate_type), records: countBy(activityCertificates, item => item.certificate_type) }),
  };
  sources.combined = withMeta('combined', { available: true, summary: { title: planning.activity.title, participants: participants.length, attendanceRate, sessions: planning.sessions.length, deliveredSessions: planning.sessions.filter(item => item.planning_status === 'delivered').length, journalEntries: journal.entryCount, plannedBudget: budget.planned, actualBudget: budget.actual, currency: planning.activity.budget_currency, assessmentAverage: advanced.assessments.summary.averageScore, surveyResponses: advanced.surveys.summary.responseCount, certificates: activityCertificates.length }, records: [] });

  const reportSections = trainingSections.map(([title, sectionType, sourceType, visualization, required], index) => {
    const source = sourceType ? sources[sourceType] : null;
    let content = '';
    let state = 'empty';
    if (index === 0) { content = generateReportNarrative('combined', sources.combined); state = 'user_edited'; }
    if (index === 1) { content = 'The Youth Digital Skills Bootcamp was organised to strengthen practical digital confidence among emerging community leaders and connect learning directly to local action.'; state = 'approved'; }
    if (index === 4) { content = generateReportNarrative('sessions', sources.sessions); state = 'generated'; }
    if (index === 7) { content = 'Assessment results indicate a clear improvement in practical digital skills. The post-training results should be read alongside facilitator observations and participant feedback.'; state = 'user_edited'; }
    if (index === 8) { content = 'Implementation records show strong engagement in applied work, while access to equipment remained the main delivery constraint. Short peer-review rounds and stable working groups improved participation and the quality of feedback.'; state = 'approved'; }
    const sourceHash = source?.hash || null;
    const stale = index === 0;
    return {
      id: -200 - index,
      report_id: -150,
      title,
      section_type: sectionType,
      source_type: sourceType,
      instructions: sectionType === 'manual' ? `Write the ${title.toLowerCase()} in the organisation's voice.` : `Use only verified ${reportSourceLabel(sourceType).toLowerCase()} records.`,
      content_text: content,
      generated_text: state === 'generated' ? content : '',
      content_state: state,
      generation_version: sourceType && ['generated', 'hybrid'].includes(sectionType) ? 'deterministic-v1' : null,
      source_hash: stale ? 'fnv1a-previous' : sourceHash,
      current_source_hash: sourceHash,
      source_snapshot: stale ? { ...source, summary: { ...source.summary, participants: 4, journalEntries: 2 } } : source,
      source_payload: source,
      source_changed: stale,
      has_source_data: Boolean(source?.available),
      generated_at: sourceType && content ? '2026-08-21T16:30:00Z' : null,
      visualization,
      is_required: required,
      position: (index + 1) * 10,
    };
  });
  const report = {
    id: -150,
    template_id: -101,
    template_name: 'Training Report',
    title: 'Youth Digital Skills Bootcamp — Final Report',
    status: 'in_review',
    reporting_period_start: planning.activity.start_date,
    reporting_period_end: planning.activity.end_date,
    author_name: 'Neneh Sowe',
    created_at: '2026-08-03T08:00:00Z',
    updated_at: '2026-08-21T16:30:00Z',
    sections: reportSections,
    completion: calculateReportCompletion(reportSections),
  };

  return {
    activity: { ...planning.activity, type: activity.type || 'Training', organizer: activity.organizer || 'LexAMS Demo Workspace', facilitator: activity.facilitator || 'Ebrima Njie and Awa Ceesay' },
    organization: { name: 'LexAMS Demo Workspace', logo_url: '' },
    sources,
    templates,
    reports: [report],
    permissions: { canViewReports: true, canManageTemplates: false, canCreateReports: false, canEditReports: false, canApproveReports: false, canGenerateNarrative: false, role: 'owner', currentUserId: 'preview-user', readOnlyPreview: true },
  };
}
