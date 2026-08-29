import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateReportCompletion,
  generateGroundedReportNarrative,
  generateReportNarrative,
  hashReportSource,
  isReportSectionStale,
  normalizeActivityReport,
  normalizeReportTemplate,
  reportingPermissions,
} from '../shared/reporting.js';
import { printActivityReport } from '../src/lib/printActivityReport.js';
import { getActivityReportPreview } from '../src/lib/activityReportPreviewDemo.js';

test('report templates validate section types and stable source references', () => {
  const template = normalizeReportTemplate({
    name: 'Training report',
    sections: [
      { title: 'Background', section_type: 'manual' },
      { title: 'Attendance', section_type: 'linked', source_type: 'attendance', visualization: 'bars' },
    ],
  });
  assert.equal(template.sections[0].source_type, null);
  assert.equal(template.sections[1].source_type, 'attendance');
  assert.throws(() => normalizeReportTemplate({ name: 'Invalid', sections: [{ title: 'Bad source', section_type: 'generated', source_type: 'internet' }] }), /valid source/);
});

test('activity report periods remain bounded and ordered', () => {
  const report = normalizeActivityReport({ title: 'Final report', reporting_period_start: '2026-08-03', reporting_period_end: '2026-08-21', template_id: 2 });
  assert.equal(report.template_id, 2);
  assert.throws(() => normalizeActivityReport({ title: 'Invalid period', reporting_period_start: '2026-08-21', reporting_period_end: '2026-08-03' }), /cannot be before/);
});

test('source hashes are stable across object key order and change with evidence', () => {
  const first = hashReportSource({ summary: { attendance: 87, participants: 5 }, records: [{ id: 1 }] });
  const reordered = hashReportSource({ records: [{ id: 1 }], summary: { participants: 5, attendance: 87 } });
  const changed = hashReportSource({ records: [{ id: 1 }], summary: { participants: 6, attendance: 87 } });
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
});

test('deterministic narrative preserves verified figures and reports missing data', () => {
  const narrative = generateReportNarrative('attendance', { summary: { rate: 87, records: 15, present: 11, late: 2, absent: 2 } });
  assert.match(narrative, /87%/);
  assert.match(narrative, /11 present, 2 late and 2 absent/);
  assert.equal(generateReportNarrative('surveys', { summary: {} }), 'There is not yet enough verified source data to prepare this narrative.');
});

test('the narrative service exposes a provider boundary without enabling unapproved paid AI', () => {
  const result = generateGroundedReportNarrative({ sourceType: 'participants', source: { summary: { total: 12 } } });
  assert.equal(result.provider, 'deterministic');
  assert.equal(result.version, 'deterministic-v1');
  assert.match(result.content, /12 participants/);
  assert.throws(() => generateGroundedReportNarrative({ provider: 'paid-ai', sourceType: 'participants' }), /Unsupported report generation provider/);
});

test('the deploy preview assembles complete survey and assessment report sources', () => {
  const preview = getActivityReportPreview({ id: -8101, type: 'Training', status: 'Completed' });
  assert.equal(preview.sources.surveys.records.length, 1);
  assert.equal(preview.sources.assessments.records.length, 2);
  assert.equal(preview.sources.assessments.summary.submissions, 8);
  assert.equal(preview.reports[0].sections.length, 10);
});

test('completion distinguishes narrative, hybrid and live linked sections', () => {
  const completion = calculateReportCompletion([
    { id: 1, section_type: 'manual', content_text: 'Written', is_required: true },
    { id: 2, section_type: 'linked', has_source_data: true, content_text: '', is_required: true },
    { id: 3, section_type: 'hybrid', has_source_data: true, content_text: '', is_required: true },
    { id: 4, section_type: 'generated', content_text: 'Draft', is_required: false },
  ]);
  assert.deepEqual(completion, { total: 4, completed: 3, percent: 75, requiredIncomplete: 1, requiredIncompleteIds: [3] });
});

test('stale detection applies only to protected generated or hybrid content', () => {
  assert.equal(isReportSectionStale({ section_type: 'generated', content_state: 'user_edited', source_hash: 'old' }, 'new'), true);
  assert.equal(isReportSectionStale({ section_type: 'linked', content_state: 'approved', source_hash: 'old' }, 'new'), false);
  assert.equal(isReportSectionStale({ section_type: 'hybrid', content_state: 'empty', source_hash: 'old' }, 'new'), false);
});

test('report permissions extend existing roles without a parallel role model', () => {
  assert.equal(reportingPermissions('owner').canManageTemplates, true);
  assert.equal(reportingPermissions('programme_manager').canEditReports, true);
  assert.equal(reportingPermissions('me_officer').canGenerateNarrative, true);
  assert.equal(reportingPermissions('facilitator').canEditReports, false);
  assert.equal(reportingPermissions('viewer').canViewReports, true);
});

test('report print mode isolates the document and restores its title', () => {
  const classes = new Set();
  const rootClasses = new Set();
  const listeners = new Map();
  const originalDocument = global.document;
  const originalWindow = global.window;
  global.document = {
    title: 'LexAMS',
    body: { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } },
    documentElement: { classList: { add: value => rootClasses.add(value), remove: value => rootClasses.delete(value) } },
  };
  global.window = {
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
    print: () => {},
    setTimeout: () => 1,
  };
  try {
    printActivityReport('Training: Final/Report');
    assert.equal(document.title, 'Training- Final-Report');
    assert.equal(classes.has('activity-report-printing'), true);
    assert.equal(rootClasses.has('activity-report-printing'), true);
    listeners.get('afterprint')();
    assert.equal(document.title, 'LexAMS');
    assert.equal(classes.has('activity-report-printing'), false);
  } finally {
    global.document = originalDocument;
    global.window = originalWindow;
  }
});
