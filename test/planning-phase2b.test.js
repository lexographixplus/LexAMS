import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActivityWeeks,
  calculateBudgetSummary,
  calculateJournalSummary,
  canEditJournalEntry,
  normalizeBudgetItem,
  normalizeJournalEntry,
  normalizeSessionImportRow,
  normalizeSpreadsheetDate,
  planningPermissions,
} from '../shared/planning.js';
import { autoMapCsvHeaders, parseCsv } from '../shared/csv.js';

test('budget summary preserves blank plans and exposes unplanned expenditure', () => {
  const summary = calculateBudgetSummary([
    { category: 'Venue', planned_amount: 1000, actual_amount: 1200 },
    { category: 'Support', planned_amount: null, actual_amount: 100 },
  ]);
  assert.equal(summary.planned, 1000);
  assert.equal(summary.actual, 1300);
  assert.equal(summary.variance, -300);
  assert.equal(summary.usedPercent, 130);
  assert.equal(summary.unplannedItems, 1);
  assert.deepEqual(summary.categories.map(item => item.category), ['Venue', 'Support']);
});

test('budget input validates money and evidence links', () => {
  assert.deepEqual(normalizeBudgetItem({ item_name: 'Venue', category: '', planned_amount: '', actual_amount: '45.678' }), {
    item_name: 'Venue', category: 'General', planned_amount: null, actual_amount: 45.68, evidence_date: null, notes: '', evidence_url: '',
  });
  assert.throws(() => normalizeBudgetItem({ item_name: 'Travel', actual_amount: -1 }), /non-negative/);
  assert.throws(() => normalizeBudgetItem({ item_name: 'Travel', evidence_url: 'javascript:alert(1)' }), /valid http or https/);
});

test('journal input validates weekly periods and tenant-linked identifiers', () => {
  const entry = normalizeJournalEntry({
    entry_mode: 'weekly', entry_date: '2026-08-03', period_end: '2026-08-09', progress_summary: 'Week one delivered.',
    actions_follow_up: 'Share materials.', session_ids: [2, '2', -1, 'bad'], task_ids: ['7'],
  });
  assert.equal(entry.follow_up_status, 'open');
  assert.deepEqual(entry.session_ids, [2]);
  assert.deepEqual(entry.task_ids, [7]);
  assert.throws(() => normalizeJournalEntry({ entry_mode: 'weekly', entry_date: '2026-08-09', period_end: '2026-08-03', progress_summary: 'Invalid.' }), /on or after/);
});

test('journal summary and edit permissions keep contributor ownership explicit', () => {
  const entries = [
    { id: 1, entry_date: '2026-08-03', include_in_report: true, follow_up_status: 'resolved', created_by: 'u1' },
    { id: 2, entry_date: '2026-08-10', include_in_report: false, follow_up_status: 'open', created_by: 'u2' },
  ];
  const summary = calculateJournalSummary(entries);
  assert.equal(summary.entryCount, 2);
  assert.equal(summary.reportRelevantCount, 1);
  assert.equal(summary.openFollowUps, 1);
  assert.equal(summary.latestEntry.id, 2);
  assert.equal(canEditJournalEntry({ role: 'facilitator', userId: 'u2', entry: entries[1] }), true);
  assert.equal(canEditJournalEntry({ role: 'facilitator', userId: 'u1', entry: entries[1] }), false);
  assert.equal(canEditJournalEntry({ role: 'programme_manager', userId: 'u1', entry: entries[1] }), true);
  assert.equal(planningPermissions('viewer').canCreateJournal, false);
});

test('multi-week activities are split into seven-day planning windows', () => {
  const weeks = buildActivityWeeks(
    { start_date: '2026-08-03', end_date: '2026-08-21' },
    [{ id: 1, session_date: '2026-08-03' }, { id: 2, session_date: '2026-08-12' }, { id: 3, session_date: '2026-08-20' }],
  );
  assert.equal(weeks.length, 3);
  assert.deepEqual(weeks.map(week => [week.startDate, week.endDate, week.sessions.length]), [
    ['2026-08-03', '2026-08-09', 1], ['2026-08-10', '2026-08-16', 1], ['2026-08-17', '2026-08-21', 1],
  ]);
});

test('session CSV supports quoted cells, automatic mapping and facilitator lists', () => {
  const rows = parseCsv('session_title,date,lead_facilitator_email,facilitator_emails\r\n"Data, tools",2026-08-12,LEAD@workspace.org,"one@example.org; two@example.org"\r\n');
  assert.equal(rows[1][0], 'Data, tools');
  const fields = [
    { key: 'title', aliases: ['sessiontitle'] },
    { key: 'session_date', aliases: ['date'] },
  ];
  assert.deepEqual(autoMapCsvHeaders(rows[0], fields), { title: '0', session_date: '1' });
  const normalized = normalizeSessionImportRow({
    title: rows[1][0], session_date: rows[1][1], lead_facilitator_email: rows[1][2], facilitator_emails: rows[1][3],
  });
  assert.deepEqual(normalized.facilitator_emails, ['lead@workspace.org', 'one@example.org', 'two@example.org']);
  assert.equal(normalized.lead_facilitator_email, 'lead@workspace.org');
});

test('session CSV accepts spreadsheet date formats and resolves them against the activity period', () => {
  const activityPeriod = { minDate: '2026-08-31', maxDate: '2026-10-09' };
  assert.equal(normalizeSpreadsheetDate('2026-08-31', 'Session date', activityPeriod), '2026-08-31');
  assert.equal(normalizeSpreadsheetDate('31/08/2026', 'Session date', activityPeriod), '2026-08-31');
  assert.equal(normalizeSpreadsheetDate('9/1/2026', 'Session date', activityPeriod), '2026-09-01');
  assert.equal(normalizeSpreadsheetDate('46266', 'Session date', activityPeriod), '2026-09-01');
  assert.throws(
    () => normalizeSpreadsheetDate('09/10/2026', 'Session date', activityPeriod),
    /ambiguous.*YYYY-MM-DD/,
  );

  const normalized = normalizeSessionImportRow({ title: 'Opening session', session_date: '9/1/2026' }, activityPeriod);
  assert.equal(normalized.session_date, '2026-09-01');
});

test('legacy downloaded session templates do not block imports with placeholder facilitator emails', () => {
  const normalized = normalizeSessionImportRow({
    title: 'Opening and orientation',
    session_date: '2026-08-31',
    lead_facilitator_email: 'lead@example.org',
    facilitator_emails: 'cofacilitator@example.org',
  }, { minDate: '2026-08-31', maxDate: '2026-10-09' });
  assert.deepEqual(normalized.facilitator_emails, []);
  assert.equal(normalized.lead_facilitator_email, null);
});
