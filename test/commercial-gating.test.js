import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canCreateActivityReport,
  isBasicReportStatus,
  phaseTwoEntitlements,
} from '../shared/commercial.js';

test('Free includes core planning and one basic report while Pro unlocks advanced operations', () => {
  const free = phaseTwoEntitlements('free');
  const pro = phaseTwoEntitlements('pro');

  assert.equal(free.sessionCsvImport, false);
  assert.equal(free.reportsPerActivity, 1);
  assert.equal(free.customReportTemplates, false);
  assert.equal(free.narrativeGeneration, false);
  assert.equal(free.reportApprovals, false);
  assert.equal(free.reportStructureEditing, false);

  assert.equal(pro.sessionCsvImport, true);
  assert.equal(pro.reportsPerActivity, 25);
  assert.equal(pro.customReportTemplates, true);
  assert.equal(pro.narrativeGeneration, true);
  assert.equal(pro.reportApprovals, true);
  assert.equal(pro.reportStructureEditing, true);
});

test('report limits and Free workflow states are deterministic', () => {
  const free = phaseTwoEntitlements('free');
  assert.equal(canCreateActivityReport(0, free), true);
  assert.equal(canCreateActivityReport(1, free), false);
  assert.equal(isBasicReportStatus('draft'), true);
  assert.equal(isBasicReportStatus('in_review'), false);
  assert.equal(isBasicReportStatus('approved'), false);
});
