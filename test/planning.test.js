import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePlanningSummary,
  canUpdatePlanningTask,
  normalizePlanningTask,
  normalizeSessionPlan,
  planningPermissions,
} from '../shared/planning.js';

test('planning summary combines task, session and facilitator readiness', () => {
  const summary = calculatePlanningSummary({
    today: '2026-08-10',
    tasks: [
      { status: 'done', due_date: '2026-08-01' },
      { status: 'in_progress', due_date: '2026-08-09' },
      { status: 'todo', due_date: '2026-08-20' },
    ],
    sessions: [
      { planning_status: 'ready', facilitators: [{ user_id: 'one' }] },
      { planning_status: 'draft', facilitators: [] },
    ],
  });
  assert.deepEqual(summary, {
    totalTasks: 3,
    completedTasks: 1,
    overdueTasks: 1,
    totalSessions: 2,
    readySessions: 1,
    assignedSessions: 1,
    unassignedSessions: 1,
    taskCompletionPercent: 33,
    sessionReadinessPercent: 50,
    facilitatorCoveragePercent: 50,
    planningProgressPercent: 44,
  });
});

test('planning permissions keep management changes with owners, admins and programme managers', () => {
  assert.equal(planningPermissions('owner').canManagePlanning, true);
  assert.equal(planningPermissions('programme_manager').canManagePlanning, true);
  assert.equal(planningPermissions('facilitator').canManagePlanning, false);
  assert.equal(planningPermissions('viewer').canUpdateAssignedTasks, false);
});

test('facilitators can update only the status of their assigned task', () => {
  const task = { assignee_user_id: 'user-1' };
  assert.equal(canUpdatePlanningTask({ role: 'facilitator', userId: 'user-1', task, updates: { status: 'done' } }), true);
  assert.equal(canUpdatePlanningTask({ role: 'facilitator', userId: 'user-1', task, updates: { title: 'Changed' } }), false);
  assert.equal(canUpdatePlanningTask({ role: 'facilitator', userId: 'user-2', task, updates: { status: 'done' } }), false);
  assert.equal(canUpdatePlanningTask({ role: 'programme_manager', userId: 'user-2', task, updates: { title: 'Changed' } }), true);
});

test('task input is bounded and normalized for the API', () => {
  const task = normalizePlanningTask({ title: '  Confirm venue  ', stage: 'unknown', priority: 'urgent', status: 'done', due_date: '' });
  assert.equal(task.title, 'Confirm venue');
  assert.equal(task.stage, 'pre');
  assert.equal(task.priority, 'urgent');
  assert.equal(task.due_date, null);
  assert.throws(() => normalizePlanningTask({ title: '', due_date: 'tomorrow' }), /title is required/i);
});

test('session planning validates timing and lead facilitator membership', () => {
  const session = normalizeSessionPlan({
    title: 'Opening session',
    session_date: '2026-08-12',
    starts_at: '09:00',
    ends_at: '11:00',
    facilitator_ids: ['one', 'one', 'two'],
    lead_facilitator_id: 'two',
  });
  assert.deepEqual(session.facilitator_ids, ['one', 'two']);
  assert.equal(session.lead_facilitator_id, 'two');
  assert.throws(() => normalizeSessionPlan({ title: 'Invalid', session_date: '2026-08-12', starts_at: '12:00', ends_at: '11:00' }), /after its start time/i);
});
