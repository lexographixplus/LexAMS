import { canonicalRecognitionKind, isRecognitionCertificate } from '../../../shared/recognition.js';

export { canonicalRecognitionKind, isRecognitionCertificate };

export function recognitionSql(alias = 'c') {
  if (!/^[a-z][a-z0-9_]*$/i.test(alias)) throw new Error('Invalid SQL alias');
  return `(
    ${alias}.certificate_kind in ('award','standalone')
    or lower(coalesce(${alias}.certificate_type, '')) = 'recognition'
    or nullif(btrim(${alias}.award_title), '') is not null
    or ${alias}.template_id is not null
    or ${alias}.metadata->>'source' = 'awards_recognition'
  )`;
}
