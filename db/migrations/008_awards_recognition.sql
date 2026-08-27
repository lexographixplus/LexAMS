-- LexAMS Awards & Recognition
-- Extends certificates to support activity awards, standalone recognition,
-- reusable award templates, revocation and reissue history.

create table if not exists award_templates (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  certificate_title text not null,
  category text,
  citation_template text,
  active boolean not null default true,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists award_templates_org_name_unique
  on award_templates (organization_id, lower(btrim(name)));

create index if not exists award_templates_org_active_idx
  on award_templates (organization_id, active, updated_at desc);

alter table certificates
  add column if not exists certificate_kind text not null default 'completion',
  add column if not exists award_title text,
  add column if not exists award_category text,
  add column if not exists award_period text,
  add column if not exists citation text,
  add column if not exists recipient_name text,
  add column if not exists recipient_email text,
  add column if not exists template_id bigint,
  add column if not exists status text not null default 'active',
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid,
  add column if not exists revoke_reason text,
  add column if not exists reissued_from_id bigint,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Snapshot recipient details on all existing certificates before allowing
-- participant-less standalone certificates.
update certificates c
set recipient_name = coalesce(c.recipient_name, p.name),
    recipient_email = coalesce(c.recipient_email, nullif(lower(btrim(p.email)), ''))
from participants p
where p.id = c.participant_id
  and p.organization_id = c.organization_id
  and (c.recipient_name is null or c.recipient_email is null);

-- Awards can be standalone, so activity and participant relationships are optional.
alter table certificates alter column activity_id drop not null;
alter table certificates alter column participant_id drop not null;

-- Preserve issued certificate history if a participant or activity is later removed.
alter table certificates drop constraint if exists certificates_participant_org_fk;
alter table certificates drop constraint if exists certificates_participant_id_fkey;
alter table certificates drop constraint if exists certificates_activity_org_fk;
alter table certificates drop constraint if exists certificates_activity_id_fkey;

alter table certificates
  add constraint certificates_participant_id_fkey
  foreign key (participant_id) references participants(id) on delete set null;

alter table certificates
  add constraint certificates_activity_id_fkey
  foreign key (activity_id) references activities(id) on delete set null;

alter table certificates drop constraint if exists certificates_template_id_fkey;
alter table certificates
  add constraint certificates_template_id_fkey
  foreign key (template_id) references award_templates(id) on delete set null;

alter table certificates drop constraint if exists certificates_revoked_by_fkey;
alter table certificates
  add constraint certificates_revoked_by_fkey
  foreign key (revoked_by) references users(id) on delete set null;

alter table certificates drop constraint if exists certificates_reissued_from_id_fkey;
alter table certificates
  add constraint certificates_reissued_from_id_fkey
  foreign key (reissued_from_id) references certificates(id) on delete set null;

alter table certificates drop constraint if exists certificates_kind_check;
alter table certificates
  add constraint certificates_kind_check
  check (certificate_kind in ('completion','award','standalone')) not valid;
alter table certificates validate constraint certificates_kind_check;

alter table certificates drop constraint if exists certificates_status_check;
alter table certificates
  add constraint certificates_status_check
  check (status in ('active','revoked','superseded')) not valid;
alter table certificates validate constraint certificates_status_check;

alter table certificates drop constraint if exists certificates_recipient_check;
alter table certificates
  add constraint certificates_recipient_check
  check (participant_id is not null or nullif(btrim(recipient_name), '') is not null) not valid;
alter table certificates validate constraint certificates_recipient_check;

create index if not exists certificates_org_kind_issued_idx
  on certificates (organization_id, certificate_kind, issued_date desc, id desc);

create index if not exists certificates_org_participant_idx
  on certificates (organization_id, participant_id, issued_date desc)
  where participant_id is not null;

create index if not exists certificates_org_activity_idx
  on certificates (organization_id, activity_id, issued_date desc)
  where activity_id is not null;
