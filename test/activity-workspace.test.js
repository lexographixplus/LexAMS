import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('activity frame no longer dumps operational panels above the workspace', async () => {
  const frame = await source('src/pages/ActivityDetailFrame.jsx');
  assert.match(frame, /<ActivityDetail\s*\/>/);
  assert.doesNotMatch(frame, /ActivityOperationsPanel/);
  assert.doesNotMatch(frame, /ActivityWideCheckinPanel/);
  assert.doesNotMatch(frame, /<style>/);
});

test('activity detail mounts registration and attendance operations in their tabs', async () => {
  const detail = await source('src/pages/ActivityDetail.jsx');
  assert.match(detail, /className="lx-activity-tabs"/);
  assert.match(detail, /ActivityOperationsPanel mode="registration"/);
  assert.match(detail, /ActivityWideCheckinPanel/);
  assert.match(detail, /ActivityOperationsPanel mode="attendance"/);
  assert.match(detail, /Participant outcomes/);
  assert.match(detail, /Attendance ledger/);
  assert.doesNotMatch(detail, /const tabStyle/);
  assert.doesNotMatch(detail, /const _input/);
});

test('activity operations support focused modes without component style injection', async () => {
  const operations = await source('src/components/ActivityOperationsPanel.jsx');
  const daily = await source('src/components/ActivityWideCheckinPanel.jsx');
  assert.match(operations, /mode = 'all'/);
  assert.match(operations, /mode === 'registration'/);
  assert.match(operations, /mode === 'attendance'/);
  assert.doesNotMatch(operations, /<style>/);
  assert.doesNotMatch(daily, /<style>/);
  assert.match(daily, /className="lx-field"/);
});

test('activity workspace CSS uses stable semantic selectors', async () => {
  const css = await source('src/activity-workspace.css');
  assert.match(css, /\.lx-activity-tabs/);
  assert.match(css, /\.lexops-shell/);
  assert.match(css, /\.lexdaily-shell/);
  assert.doesNotMatch(css, /nth-of-type/);
  assert.doesNotMatch(css, /\[style\*=/);
});
