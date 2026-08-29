export const TASK_STAGES = ['pre', 'during', 'post'];
export const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done'];
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const SESSION_PLANNING_STATUSES = ['draft', 'ready', 'delivered', 'cancelled'];

const PLANNING_MANAGERS = new Set(['owner', 'admin', 'programme_manager']);
const ASSIGNED_TASK_CONTRIBUTORS = new Set(['facilitator', 'me_officer']);

export function planningPermissions(role) {
  return {
    canManagePlanning: PLANNING_MANAGERS.has(String(role || '')),
    canUpdateAssignedTasks: ASSIGNED_TASK_CONTRIBUTORS.has(String(role || '')),
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

function cleanTime(value, label) {
  const time = cleanText(value, 8);
  if (!time) return null;
  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) throw new Error(`${label} must be a valid time.`);
  return time.slice(0, 5);
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
