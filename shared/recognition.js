export const RECOGNITION_KINDS = Object.freeze(['award', 'standalone']);

export function hasRecognitionEvidence(certificate) {
  return Boolean(
    String(certificate?.certificate_type || '').trim().toLowerCase() === 'recognition'
    || String(certificate?.award_title || '').trim()
    || certificate?.template_id
    || certificate?.metadata?.source === 'awards_recognition'
  );
}

export function isRecognitionCertificate(certificate) {
  return RECOGNITION_KINDS.includes(String(certificate?.certificate_kind || '').trim().toLowerCase())
    || hasRecognitionEvidence(certificate);
}

export function canonicalRecognitionKind(certificate) {
  if (!isRecognitionCertificate(certificate)) return 'completion';
  return certificate?.activity_id ? 'award' : 'standalone';
}

export function recognitionTitle(certificate) {
  return String(certificate?.award_title || '').trim()
    || (isRecognitionCertificate(certificate) ? 'Certificate of Recognition' : String(certificate?.certificate_type || 'Certificate'));
}
