import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalRecognitionKind, hasRecognitionEvidence, isRecognitionCertificate, recognitionTitle } from '../shared/recognition.js';

test('recognizes canonical award and standalone certificate kinds', () => {
  assert.equal(isRecognitionCertificate({ certificate_kind: 'award' }), true);
  assert.equal(isRecognitionCertificate({ certificate_kind: 'standalone' }), true);
  assert.equal(isRecognitionCertificate({ certificate_kind: 'completion', certificate_type: 'completion' }), false);
});

test('recognizes every legacy signal during the migration rollout', () => {
  for (const certificate of [
    { certificate_type: 'Recognition' },
    { award_title: 'Trainee of the Week' },
    { template_id: 9 },
    { metadata: { source: 'awards_recognition' } },
  ]) {
    assert.equal(hasRecognitionEvidence(certificate), true);
    assert.equal(isRecognitionCertificate(certificate), true);
  }
});

test('canonical kind follows whether recognition belongs to an activity', () => {
  assert.equal(canonicalRecognitionKind({ award_title: 'Best project', activity_id: 42 }), 'award');
  assert.equal(canonicalRecognitionKind({ award_title: 'Community service' }), 'standalone');
  assert.equal(canonicalRecognitionKind({ certificate_type: 'completion', activity_id: 42 }), 'completion');
});

test('recognition title has a safe fallback', () => {
  assert.equal(recognitionTitle({ award_title: 'Leadership Award' }), 'Leadership Award');
  assert.equal(recognitionTitle({ certificate_kind: 'award' }), 'Certificate of Recognition');
});
