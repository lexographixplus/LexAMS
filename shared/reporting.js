export const REPORT_SECTION_TYPES = ['manual', 'linked', 'generated', 'hybrid'];
export const REPORT_SOURCE_TYPES = [
  'activity_details', 'tasks', 'sessions', 'facilitators', 'participants', 'attendance',
  'budget', 'journal', 'surveys', 'assessments', 'certificates', 'combined',
];
export const REPORT_VISUALIZATIONS = ['auto', 'summary', 'bars', 'table', 'none'];
export const REPORT_STATUSES = ['draft', 'in_review', 'approved', 'archived'];
export const REPORT_CONTENT_STATES = ['empty', 'generated', 'user_edited', 'approved'];

const SOURCE_LABELS = {
  activity_details: 'Activity details', tasks: 'Planning tasks', sessions: 'Sessions', facilitators: 'Facilitators',
  participants: 'Participants', attendance: 'Attendance', budget: 'Budget', journal: 'Implementation journal',
  surveys: 'Surveys & feedback', assessments: 'Assessments', certificates: 'Certificates', combined: 'Activity record',
};

function cleanText(value, max = 5000) {
  return String(value ?? '').trim().slice(0, max);
}

function dateValue(value) {
  const normalized = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

export function reportSourceLabel(sourceType) {
  return SOURCE_LABELS[sourceType] || 'Source data';
}

export function reportingPermissions(role) {
  const administrator = role === 'owner' || role === 'admin';
  const reportEditor = administrator || role === 'programme_manager' || role === 'me_officer';
  return {
    canViewReports: Boolean(role),
    canManageTemplates: administrator,
    canCreateReports: reportEditor,
    canEditReports: reportEditor,
    canApproveReports: reportEditor,
    canGenerateNarrative: reportEditor,
  };
}

export function normalizeTemplateSection(input = {}, position = 0) {
  const sectionType = REPORT_SECTION_TYPES.includes(String(input.section_type)) ? String(input.section_type) : 'manual';
  const sourceType = sectionType === 'manual' ? null : String(input.source_type || '');
  if (sectionType !== 'manual' && !REPORT_SOURCE_TYPES.includes(sourceType)) throw new Error('Choose a valid source for every linked or generated section.');
  const title = cleanText(input.title, 140);
  if (!title) throw new Error('Every report section needs a title.');
  return {
    id: Number.isSafeInteger(Number(input.id)) && Number(input.id) > 0 ? Number(input.id) : null,
    title,
    section_type: sectionType,
    source_type: sourceType,
    instructions: cleanText(input.instructions, 1500),
    starter_text: cleanText(input.starter_text, 20000),
    visualization: REPORT_VISUALIZATIONS.includes(String(input.visualization)) ? String(input.visualization) : 'auto',
    is_required: input.is_required !== false,
    position: Number.isSafeInteger(Number(input.position)) && Number(input.position) >= 0 ? Number(input.position) : position * 10,
  };
}

export function normalizeReportTemplate(input = {}) {
  const name = cleanText(input.name, 120);
  if (!name) throw new Error('Template name is required.');
  if (!Array.isArray(input.sections) || !input.sections.length) throw new Error('Add at least one report section.');
  if (input.sections.length > 30) throw new Error('A report template can contain up to 30 sections.');
  return {
    id: Number.isSafeInteger(Number(input.id)) && Number(input.id) > 0 ? Number(input.id) : null,
    name,
    description: cleanText(input.description, 600),
    sections: input.sections.map((section, index) => normalizeTemplateSection(section, index + 1)),
  };
}

export function normalizeActivityReport(input = {}, activity = {}) {
  const title = cleanText(input.title, 160);
  if (!title) throw new Error('Report title is required.');
  const start = dateValue(input.reporting_period_start || activity.start_date);
  const end = dateValue(input.reporting_period_end || activity.end_date);
  if (start && end && end < start) throw new Error('The report period end cannot be before its start.');
  return {
    title,
    template_id: Number.isSafeInteger(Number(input.template_id)) && Number(input.template_id) > 0 ? Number(input.template_id) : null,
    reporting_period_start: start,
    reporting_period_end: end,
  };
}

export function normalizeReportSectionContent(input = {}) {
  const id = Number(input.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid report section.');
  const title = cleanText(input.title, 140);
  if (!title) throw new Error('Section title is required.');
  return {
    id,
    title,
    content_text: cleanText(input.content_text, 60000),
    instructions: cleanText(input.instructions, 1500),
  };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

export function stableReportSource(value) {
  return JSON.stringify(canonicalize(value ?? null));
}

export function hashReportSource(value) {
  const source = stableReportSource(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function present(value) {
  return value !== null && value !== undefined && value !== '';
}

function listSentence(values = [], limit = 5) {
  const items = values.filter(Boolean).slice(0, limit);
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function money(value, currency = '') {
  const number = Number(value);
  return Number.isFinite(number) ? `${currency ? `${currency} ` : ''}${number.toLocaleString('en', { maximumFractionDigits: 2 })}` : null;
}

export function generateReportNarrative(sourceType, source = {}) {
  const summary = source.summary || {};
  const sentences = [];

  if (sourceType === 'activity_details') {
    if (summary.title) sentences.push(`${summary.title} was organised as ${summary.type || 'an activity'}${summary.startDate ? ` from ${summary.startDate}${summary.endDate && summary.endDate !== summary.startDate ? ` to ${summary.endDate}` : ''}` : ''}${summary.venue ? ` at ${summary.venue}` : ''}.`);
    if (summary.description) sentences.push(summary.description.endsWith('.') ? summary.description : `${summary.description}.`);
  } else if (sourceType === 'tasks') {
    if (present(summary.total)) sentences.push(`${summary.completed || 0} of ${summary.total} activity tasks are complete${summary.overdue ? `, with ${summary.overdue} overdue` : ''}.`);
    const open = listSentence(source.records?.filter(item => item.status !== 'done').map(item => item.title));
    if (open) sentences.push(`Current work includes ${open}.`);
  } else if (sourceType === 'sessions') {
    if (present(summary.total)) sentences.push(`${summary.delivered || 0} of ${summary.total} planned sessions are recorded as delivered${summary.ready ? `, while ${summary.ready} are ready` : ''}.`);
    const delivered = listSentence(source.records?.filter(item => item.status === 'delivered').map(item => item.title));
    if (delivered) sentences.push(`Delivered sessions include ${delivered}.`);
  } else if (sourceType === 'facilitators') {
    if (present(summary.total)) sentences.push(`${summary.total} facilitator${summary.total === 1 ? '' : 's'} ${summary.total === 1 ? 'is' : 'are'} assigned across the activity schedule.`);
    const names = listSentence(source.records?.map(item => item.name));
    if (names) sentences.push(`The delivery team includes ${names}.`);
  } else if (sourceType === 'participants') {
    if (present(summary.total)) sentences.push(`${summary.total} participant${summary.total === 1 ? '' : 's'} registered for the activity.`);
    const categories = listSentence(source.breakdown?.map(item => `${item.label} (${item.value})`));
    if (categories) sentences.push(`The recorded participant categories were ${categories}.`);
  } else if (sourceType === 'attendance') {
    if (present(summary.rate)) sentences.push(`Recorded attendance was ${summary.rate}%, based on ${summary.records || 0} attendance records.`);
    if (present(summary.present) || present(summary.late) || present(summary.absent)) sentences.push(`The records show ${summary.present || 0} present, ${summary.late || 0} late and ${summary.absent || 0} absent statuses.`);
  } else if (sourceType === 'budget') {
    const planned = money(summary.planned, summary.currency);
    const actual = money(summary.actual, summary.currency);
    const variance = money(Math.abs(Number(summary.variance || 0)), summary.currency);
    if (planned || actual) sentences.push(`The activity budget records ${planned || 'no planned total'} planned and ${actual || 'no actual expenditure'} spent.`);
    if (variance && Number(summary.variance) !== 0) sentences.push(`Actual expenditure is ${variance} ${Number(summary.variance) > 0 ? 'over' : 'under'} the recorded plan.`);
  } else if (sourceType === 'journal') {
    if (present(summary.total)) sentences.push(`${summary.total} implementation update${summary.total === 1 ? '' : 's'} ${summary.total === 1 ? 'has' : 'have'} been recorded${summary.openFollowUps ? `, with ${summary.openFollowUps} open follow-up${summary.openFollowUps === 1 ? '' : 's'}` : ''}.`);
    const progress = listSentence(source.records?.map(item => item.progress));
    if (progress) sentences.push(`Recorded progress includes ${progress}.`);
  } else if (sourceType === 'surveys') {
    if (present(summary.surveys)) sentences.push(`${summary.surveys} survey${summary.surveys === 1 ? '' : 's'} collected ${summary.responses || 0} response${summary.responses === 1 ? '' : 's'}.`);
    if (present(summary.averageRating)) sentences.push(`The average recorded rating was ${summary.averageRating} out of 5.`);
  } else if (sourceType === 'assessments') {
    if (present(summary.assessments)) sentences.push(`${summary.assessments} assessment${summary.assessments === 1 ? '' : 's'} recorded ${summary.submissions || 0} submission${summary.submissions === 1 ? '' : 's'}.`);
    if (present(summary.averageScore)) sentences.push(`The average recorded score was ${summary.averageScore}%${present(summary.passRate) ? ` and the pass rate was ${summary.passRate}%` : ''}.`);
  } else if (sourceType === 'certificates') {
    if (present(summary.total)) sentences.push(`${summary.total} certificate${summary.total === 1 ? '' : 's'} ${summary.total === 1 ? 'has' : 'have'} been issued for this activity.`);
  } else if (sourceType === 'combined') {
    const title = summary.title || 'The activity';
    sentences.push(`${title} brings together the verified planning, delivery and reporting records held in LexAMS.`);
    if (present(summary.participants)) sentences.push(`${summary.participants} participant${summary.participants === 1 ? '' : 's'} registered${present(summary.attendanceRate) ? `, with ${summary.attendanceRate}% recorded attendance` : ''}.`);
    if (present(summary.sessions)) sentences.push(`${summary.deliveredSessions || 0} of ${summary.sessions} planned sessions are marked delivered.`);
    if (present(summary.journalEntries)) sentences.push(`${summary.journalEntries} implementation update${summary.journalEntries === 1 ? '' : 's'} document progress, challenges and lessons.`);
    if (present(summary.actualBudget)) sentences.push(`Recorded expenditure is ${money(summary.actualBudget, summary.currency)}${present(summary.plannedBudget) ? ` against a ${money(summary.plannedBudget, summary.currency)} plan` : ''}.`);
  }

  return sentences.filter(Boolean).join(' ') || 'There is not yet enough verified source data to prepare this narrative.';
}

const REPORT_GENERATORS = {
  deterministic: {
    version: 'deterministic-v1',
    generate: generateReportNarrative,
  },
};

export function generateGroundedReportNarrative({ provider = 'deterministic', sourceType, source = {} } = {}) {
  const adapter = REPORT_GENERATORS[provider];
  if (!adapter) throw new Error(`Unsupported report generation provider: ${provider}`);
  return {
    provider,
    version: adapter.version,
    content: adapter.generate(sourceType, source),
  };
}

export function reportSectionHasSourceData(source) {
  if (!source) return false;
  if (typeof source.available === 'boolean') return source.available;
  return Boolean(source.records?.length || source.breakdown?.length || Object.values(source.summary || {}).some(present));
}

export function reportSectionIsComplete(section) {
  if (!section) return false;
  const hasContent = Boolean(String(section.content_text || '').trim());
  const hasSource = section.has_source_data ?? reportSectionHasSourceData(section.source_payload);
  if (section.section_type === 'linked') return Boolean(hasSource);
  if (section.section_type === 'hybrid') return hasContent && Boolean(hasSource);
  return hasContent;
}

export function calculateReportCompletion(sections = []) {
  const completed = sections.filter(reportSectionIsComplete).length;
  const requiredIncomplete = sections.filter(section => section.is_required && !reportSectionIsComplete(section));
  return {
    total: sections.length,
    completed,
    percent: sections.length ? Math.round((completed / sections.length) * 100) : 0,
    requiredIncomplete: requiredIncomplete.length,
    requiredIncompleteIds: requiredIncomplete.map(section => section.id),
  };
}

export function isReportSectionStale(section, currentSourceHash) {
  if (!section || !['generated', 'hybrid'].includes(section.section_type)) return false;
  if (!section.source_hash || !currentSourceHash || section.content_state === 'empty') return false;
  return section.source_hash !== currentSourceHash;
}
