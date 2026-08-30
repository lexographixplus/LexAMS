export const TASK_STAGES = ['pre', 'during', 'post'];
export const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done'];
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const SESSION_PLANNING_STATUSES = ['draft', 'ready', 'delivered', 'cancelled'];
export const JOURNAL_ENTRY_MODES = ['daily', 'weekly'];
export const JOURNAL_FOLLOW_UP_STATUSES = ['open', 'resolved', 'not_required'];
export const BUDGET_CURRENCIES = ['GMD', 'USD', 'EUR', 'GBP', 'XOF'];

const PLANNING_MANAGERS = new Set(['owner', 'admin', 'programme_manager']);
const ASSIGNED_TASK_CONTRIBUTORS = new Set(['facilitator', 'me_officer']);
const JOURNAL_CONTRIBUTORS = new Set(['owner', 'admin', 'programme_manager', 'facilitator', 'me_officer']);
const LEGACY_SESSION_TEMPLATE_EMAILS = new Set(['lead@example.org', 'cofacilitator@example.org']);

export function planningPermissions(role) {
  return {
    canManagePlanning: PLANNING_MANAGERS.has(String(role || '')),
    canUpdateAssignedTasks: ASSIGNED_TASK_CONTRIBUTORS.has(String(role || '')),
    canManageBudget: PLANNING_MANAGERS.has(String(role || '')),
    canCreateJournal: JOURNAL_CONTRIBUTORS.has(String(role || '')),
  };
}

export function canUpdatePlanningTask({ role, userId, task, updates }) {
  if (planningPermissions(role).canManagePlanning) return true;
  if (!ASSIGNED_TASK_CONTRIBUTORS.has(String(role || ''))) return false;
  if (!task || String(task.assignee_user_id || '') !== String(userId || '')) return false;
  const keys = Object.keys(updates || {});
  return keys.length > 0 && keys.every(key => key === 'status');
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanDate(value, label) {
  const date = cleanText(value, 10);
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${label} must be a valid date.`);
  return date;
}

function isoDateFromParts(year, month, day) {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())
    || date.getUTCFullYear() !== Number(year)
    || date.getUTCMonth() !== Number(month) - 1
    || date.getUTCDate() !== Number(day)) return null;
  return date.toISOString().slice(0, 10);
}

export function normalizeSpreadsheetDate(value, label = 'Date', { minDate = '', maxDate = '' } = {}) {
  const raw = cleanText(value, 64).replace(/^\uFEFF/, '').replace(/^'/, '');
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const normalized = isoDateFromParts(isoMatch[1], isoMatch[2], isoMatch[3]);
    if (normalized) return normalized;
  }

  const candidates = new Set();
  const localMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (localMatch) {
    const [, first, second, year] = localMatch;
    const dayFirst = isoDateFromParts(year, second, first);
    const monthFirst = isoDateFromParts(year, first, second);
    if (dayFirst) candidates.add(dayFirst);
    if (monthFirst) candidates.add(monthFirst);
  }

  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (Number.isFinite(serial) && serial >= 1 && serial <= 2958465) {
      const excelDate = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
      if (!Number.isNaN(excelDate.getTime())) candidates.add(excelDate.toISOString().slice(0, 10));
    }
  }

  if (candidates.size === 1) return [...candidates][0];
  if (candidates.size > 1 && (minDate || maxDate)) {
    const inRange = [...candidates].filter(candidate => (!minDate || candidate >= minDate) && (!maxDate || candidate <= maxDate));
    if (inRange.length === 1) return inRange[0];
  }
  if (candidates.size > 1) throw new Error(`${label} “${raw}” is ambiguous. Use YYYY-MM-DD.`);
  throw new Error(`${label} must use YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, or an Excel date value.`);
}

function cleanTime(value, label) {
  const time = cleanText(value, 8);
  if (!time) return null;
  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) throw new Error(`${label} must be a valid time.`);
  return time.slice(0, 5);
}

function cleanMoney(value, label) {
  if (value === '' || value === null || value === undefined) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 999999999999.99) {
    throw new Error(`${label} must be a valid non-negative amount.`);
  }
  return Math.round(amount * 100) / 100;
}

function cleanUrl(value, label = 'Evidence link') {
  const url = cleanText(value, 1200);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    throw new Error(`${label} must be a valid http or https link.`);
  }
  return url;
}

function positiveIds(values, limit = 100) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => Number(value))
    .filter(value => Number.isSafeInteger(value) && value > 0))].slice(0, limit);
}

export function normalizePlanningTask(input = {}) {
  const title = cleanText(input.title, 180);
  if (!title) throw new Error('Task title is required.');
  const stage = TASK_STAGES.includes(String(input.stage)) ? String(input.stage) : 'pre';
  const status = TASK_STATUSES.includes(String(input.status)) ? String(input.status) : 'todo';
  const priority = TASK_PRIORITIES.includes(String(input.priority)) ? String(input.priority) : 'medium';
  return {
    title,
    description: cleanText(input.description, 3000),
    stage,
    status,
    priority,
    due_date: cleanDate(input.due_date, 'Due date'),
    assignee_user_id: input.assignee_user_id ? String(input.assignee_user_id) : null,
  };
}

export function normalizeSessionPlan(input = {}) {
  const title = cleanText(input.title, 180);
  if (!title) throw new Error('Session title is required.');
  const sessionDate = cleanDate(input.session_date, 'Session date');
  if (!sessionDate) throw new Error('Session date is required.');
  const startsAt = cleanTime(input.starts_at, 'Start time');
  const endsAt = cleanTime(input.ends_at, 'End time');
  if (startsAt && endsAt && endsAt <= startsAt) throw new Error('Session end time must be after its start time.');
  const planningStatus = SESSION_PLANNING_STATUSES.includes(String(input.planning_status))
    ? String(input.planning_status)
    : 'draft';
  const facilitatorIds = [...new Set((Array.isArray(input.facilitator_ids) ? input.facilitator_ids : [])
    .map(value => String(value || '').trim()).filter(Boolean))].slice(0, 30);
  const leadFacilitatorId = input.lead_facilitator_id && facilitatorIds.includes(String(input.lead_facilitator_id))
    ? String(input.lead_facilitator_id)
    : facilitatorIds[0] || null;
  return {
    title,
    session_date: sessionDate,
    starts_at: startsAt,
    ends_at: endsAt,
    venue: cleanText(input.venue, 240),
    description: cleanText(input.description, 3000),
    learning_objectives: cleanText(input.learning_objectives, 3000),
    planning_status: planningStatus,
    facilitator_ids: facilitatorIds,
    lead_facilitator_id: leadFacilitatorId,
  };
}

export function normalizeBudgetItem(input = {}) {
  const itemName = cleanText(input.item_name, 180);
  if (!itemName) throw new Error('Budget item name is required.');
  return {
    category: cleanText(input.category, 100) || 'General',
    item_name: itemName,
    planned_amount: cleanMoney(input.planned_amount, 'Planned amount'),
    actual_amount: cleanMoney(input.actual_amount, 'Actual amount'),
    evidence_date: cleanDate(input.evidence_date, 'Evidence date'),
    notes: cleanText(input.notes, 3000),
    evidence_url: cleanUrl(input.evidence_url),
  };
}

export function normalizeJournalEntry(input = {}) {
  const entryMode = JOURNAL_ENTRY_MODES.includes(String(input.entry_mode)) ? String(input.entry_mode) : 'daily';
  const entryDate = cleanDate(input.entry_date, entryMode === 'weekly' ? 'Week start' : 'Entry date');
  if (!entryDate) throw new Error(entryMode === 'weekly' ? 'Week start is required.' : 'Entry date is required.');
  const periodEnd = entryMode === 'weekly' ? cleanDate(input.period_end, 'Week end') : null;
  if (entryMode === 'weekly' && !periodEnd) throw new Error('Week end is required.');
  if (periodEnd && periodEnd < entryDate) throw new Error('Week end must be on or after the start date.');
  const progressSummary = cleanText(input.progress_summary, 5000);
  if (!progressSummary) throw new Error('Progress summary is required.');
  const followUpStatus = JOURNAL_FOLLOW_UP_STATUSES.includes(String(input.follow_up_status))
    ? String(input.follow_up_status)
    : cleanText(input.actions_follow_up, 5000) ? 'open' : 'not_required';
  return {
    entry_mode: entryMode,
    entry_date: entryDate,
    period_end: periodEnd,
    progress_summary: progressSummary,
    achievements: cleanText(input.achievements, 5000),
    challenges: cleanText(input.challenges, 5000),
    observations_lessons: cleanText(input.observations_lessons, 5000),
    actions_follow_up: cleanText(input.actions_follow_up, 5000),
    follow_up_status: followUpStatus,
    evidence_url: cleanUrl(input.evidence_url),
    include_in_report: input.include_in_report !== false,
    session_ids: positiveIds(input.session_ids),
    task_ids: positiveIds(input.task_ids),
  };
}

export function canEditJournalEntry({ role, userId, entry }) {
  if (PLANNING_MANAGERS.has(String(role || ''))) return true;
  return JOURNAL_CONTRIBUTORS.has(String(role || ''))
    && Boolean(entry)
    && String(entry.created_by || '') === String(userId || '');
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function normalizeEmailList(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[;,|]/);
  const emails = [...new Set(source.map(item => String(item || '').trim().toLowerCase()).filter(Boolean))].slice(0, 30);
  const invalid = emails.find(email => !validEmail(email));
  if (invalid) throw new Error(`Invalid facilitator email: ${invalid}.`);
  return emails;
}

export function normalizeSessionImportRow(input = {}, dateRange = {}) {
  const facilitatorEmails = normalizeEmailList(input.facilitator_emails)
    .filter(email => !LEGACY_SESSION_TEMPLATE_EMAILS.has(email));
  const requestedLeadEmail = cleanText(input.lead_facilitator_email, 320).toLowerCase();
  const leadEmail = LEGACY_SESSION_TEMPLATE_EMAILS.has(requestedLeadEmail) ? '' : requestedLeadEmail;
  if (leadEmail && !validEmail(leadEmail)) throw new Error(`Invalid lead facilitator email: ${leadEmail}.`);
  const emails = leadEmail && !facilitatorEmails.includes(leadEmail) ? [leadEmail, ...facilitatorEmails] : facilitatorEmails;
  const sessionDate = normalizeSpreadsheetDate(input.session_date, 'Session date', dateRange);
  return {
    ...normalizeSessionPlan({ ...input, session_date: sessionDate, facilitator_ids: [] }),
    facilitator_emails: emails,
    lead_facilitator_email: leadEmail || emails[0] || null,
  };
}

export function filterSessionFacilitatorsToTeam(input = {}, allowedEmails = []) {
  const allowed = new Set(Array.from(allowedEmails, email => String(email || '').trim().toLowerCase()).filter(Boolean));
  const requestedEmails = (Array.isArray(input.facilitator_emails) ? input.facilitator_emails : [])
    .map(email => String(email || '').trim().toLowerCase()).filter(Boolean);
  const facilitatorEmails = requestedEmails.filter(email => allowed.has(email));
  const skippedFacilitatorEmails = requestedEmails.filter(email => !allowed.has(email));
  const requestedLeadEmail = String(input.lead_facilitator_email || '').trim().toLowerCase();
  const leadFacilitatorEmail = requestedLeadEmail && facilitatorEmails.includes(requestedLeadEmail)
    ? requestedLeadEmail
    : facilitatorEmails[0] || null;
  return {
    facilitator_emails: facilitatorEmails,
    lead_facilitator_email: leadFacilitatorEmail,
    skipped_facilitator_emails: skippedFacilitatorEmails,
  };
}

function percent(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

export function calculatePlanningSummary({ tasks = [], sessions = [], today = new Date().toISOString().slice(0, 10) } = {}) {
  const activeTasks = tasks.filter(task => task.status !== 'done');
  const completedTasks = tasks.filter(task => task.status === 'done').length;
  const overdueTasks = activeTasks.filter(task => task.due_date && String(task.due_date).slice(0, 10) < today).length;
  const readySessions = sessions.filter(session => ['ready', 'delivered'].includes(session.planning_status)).length;
  const assignedSessions = sessions.filter(session => Array.isArray(session.facilitators) && session.facilitators.length > 0).length;
  const scores = [];
  if (tasks.length) scores.push(percent(completedTasks, tasks.length));
  if (sessions.length) {
    scores.push(percent(readySessions, sessions.length));
    scores.push(percent(assignedSessions, sessions.length));
  }
  return {
    totalTasks: tasks.length,
    completedTasks,
    overdueTasks,
    totalSessions: sessions.length,
    readySessions,
    assignedSessions,
    unassignedSessions: Math.max(0, sessions.length - assignedSessions),
    taskCompletionPercent: percent(completedTasks, tasks.length),
    sessionReadinessPercent: percent(readySessions, sessions.length),
    facilitatorCoveragePercent: percent(assignedSessions, sessions.length),
    planningProgressPercent: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
  };
}

export function calculateBudgetSummary(items = []) {
  const categoryMap = new Map();
  let planned = 0;
  let actual = 0;
  let unplannedItems = 0;
  for (const item of items) {
    const itemPlanned = item.planned_amount === null || item.planned_amount === '' ? 0 : Number(item.planned_amount || 0);
    const itemActual = item.actual_amount === null || item.actual_amount === '' ? 0 : Number(item.actual_amount || 0);
    planned += itemPlanned;
    actual += itemActual;
    if ((item.planned_amount === null || item.planned_amount === '') && itemActual > 0) unplannedItems += 1;
    const category = String(item.category || 'General');
    const current = categoryMap.get(category) || { category, planned: 0, actual: 0 };
    current.planned += itemPlanned;
    current.actual += itemActual;
    categoryMap.set(category, current);
  }
  const categories = [...categoryMap.values()].map(category => ({
    ...category,
    variance: category.planned - category.actual,
  })).sort((a, b) => b.actual - a.actual || a.category.localeCompare(b.category));
  return {
    itemCount: items.length,
    planned,
    actual,
    variance: planned - actual,
    usedPercent: planned > 0 ? Math.round((actual / planned) * 100) : null,
    unplannedItems,
    categories,
  };
}

export function calculateJournalSummary(entries = []) {
  const ordered = [...entries].sort((a, b) => String(b.entry_date || '').localeCompare(String(a.entry_date || '')) || Number(b.id || 0) - Number(a.id || 0));
  return {
    entryCount: entries.length,
    reportRelevantCount: entries.filter(entry => entry.include_in_report).length,
    openFollowUps: entries.filter(entry => entry.follow_up_status === 'open').length,
    latestEntry: ordered[0] || null,
  };
}

function parseUtcDate(value) {
  const date = new Date(`${String(value || '').slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function buildActivityWeeks(activity = {}, sessions = []) {
  const start = parseUtcDate(activity.start_date);
  const end = parseUtcDate(activity.end_date || activity.start_date);
  if (!start || !end || end < start) return [];
  const weeks = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(Math.min(end.getTime(), weekStart.getTime() + (6 * 86400000)));
    const startDate = isoDate(weekStart);
    const endDate = isoDate(weekEnd);
    const weekSessions = sessions.filter(session => {
      const date = String(session.session_date || '').slice(0, 10);
      return date >= startDate && date <= endDate;
    });
    weeks.push({
      index: weeks.length,
      label: `Week ${weeks.length + 1}`,
      startDate,
      endDate,
      sessions: weekSessions,
    });
  }
  return weeks;
}
