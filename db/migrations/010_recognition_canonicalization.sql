-- Canonicalize all definitive recognition records so certificate_kind becomes
-- the durable source of truth after the compatibility rollout.

update certificates
set certificate_kind = case when activity_id is null then 'standalone' else 'award' end,
    certificate_type = case
      when nullif(btrim(certificate_type), '') is null then 'recognition'
      else certificate_type
    end,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', coalesce(nullif(metadata->>'source', ''), 'awards_recognition'),
      'classification_repaired_at', now()
    )
where certificate_kind not in ('award','standalone')
  and (
    lower(coalesce(certificate_type, '')) = 'recognition'
    or nullif(btrim(award_title), '') is not null
    or template_id is not null
    or metadata->>'source' = 'awards_recognition'
  );

alter table certificates drop constraint if exists certificates_recognition_kind_consistency;
alter table certificates
  add constraint certificates_recognition_kind_consistency
  check (
    certificate_kind in ('award','standalone')
    or (
      certificate_kind = 'completion'
      and lower(coalesce(certificate_type, '')) <> 'recognition'
      and nullif(btrim(award_title), '') is null
      and template_id is null
      and coalesce(metadata->>'source', '') <> 'awards_recognition'
    )
  ) not valid;
alter table certificates validate constraint certificates_recognition_kind_consistency;

create index if not exists certificates_org_recognition_status_issued_idx
  on certificates (organization_id, status, issued_date desc, id desc)
  where certificate_kind in ('award','standalone');
