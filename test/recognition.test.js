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

test('appreciation and activity snapshots remain completion history without recognition evidence', () => {
  const certificate = {
    certificate_kind: 'completion',
    certificate_type: 'appreciation',
    metadata: { activity_title: 'Community outreach', recipient_name: 'Archived participant' },
  };
  assert.equal(hasRecognitionEvidence(certificate), false);
  assert.equal(isRecognitionCertificate(certificate), false);
  assert.equal(canonicalRecognitionKind(certificate), 'completion');
});

test('legacy evidence stays recognizable after linked records are deleted', () => {
  const certificate = {
    activity_id: null,
    participant_id: null,
    award_title: 'Community Impact Award',
    metadata: { activity_title: 'Annual service day', recipient_name: 'A. Volunteer' },
  };
  assert.equal(isRecognitionCertificate(certificate), true);
  assert.equal(canonicalRecognitionKind(certificate), 'standalone');
  assert.equal(recognitionTitle(certificate), 'Community Impact Award');
});
