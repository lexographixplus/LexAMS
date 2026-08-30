import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRO_TRIAL_DAYS,
  isTrialingSubscription,
  trialDaysLabel,
  trialDaysRemaining,
} from '../shared/trial.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-08-30T00:00:00.000Z');

test('the automatic Pro trial lasts 30 full days and rounds partial days up', () => {
  assert.equal(PRO_TRIAL_DAYS, 30);
  assert.equal(trialDaysRemaining(new Date(NOW + 30 * DAY).toISOString(), NOW), 30);
  assert.equal(trialDaysRemaining(new Date(NOW + DAY + 1).toISOString(), NOW), 2);
  assert.equal(trialDaysRemaining(new Date(NOW + DAY).toISOString(), NOW), 1);
});

test('expired or invalid trials report no remaining days', () => {
  assert.equal(trialDaysRemaining(new Date(NOW).toISOString(), NOW), 0);
  assert.equal(trialDaysRemaining(new Date(NOW - DAY).toISOString(), NOW), 0);
  assert.equal(trialDaysRemaining(null, NOW), 0);
});

test('only a current Pro trial receives trial treatment', () => {
  const currentTrial = { plan: 'pro', status: 'trialing', trial_ends_at: new Date(NOW + DAY).toISOString() };
  assert.equal(isTrialingSubscription(currentTrial, NOW), true);
  assert.equal(isTrialingSubscription({ ...currentTrial, plan: 'free' }, NOW), false);
  assert.equal(isTrialingSubscription({ ...currentTrial, status: 'active' }, NOW), false);
  assert.equal(isTrialingSubscription({ ...currentTrial, trial_ends_at: new Date(NOW).toISOString() }, NOW), false);
});

test('trial countdown labels remain grammatically clear', () => {
  assert.equal(trialDaysLabel(30), '30 days left');
  assert.equal(trialDaysLabel(1), '1 day left');
  assert.equal(trialDaysLabel(0), '0 days left');
});
