-- LexAMS Registration & Check-in V2
-- Introduces first-class activity sessions, safer participant identity handling,
-- registration lifecycle states, capacity/waitlist settings, participant passes,
-- and reporting-friendly attendance session references.

-- 1. Normalize and deduplicate participant email identity within each organization.
-- Preserve the earliest participant record as canonical and merge dependent records.
-- Use a short-lived regular helper table rather than a TEMP table so this migration
-- is safe with runners that auto-commit each statement.
drop table if exists _lexams_participant_merge_map_005;
create table _lexams_participant_merge_map_005 as
select duplicate.id as duplicate_id, canonical.id as canonical_id
from participants duplicate
join lateral (
  select p2.id
  from participants p2
  where p2.organization_id = duplicate.organization_id
    and lower(btrim(p2.email)) = lower(btrim(duplicate.email))
  order by p2.id
  limit 1
) canonical on true
where duplicate.id <> canonical.id
  and btrim(duplicate.email) <> '';

-- Registrations: copy to canonical participant, preserving the earliest registration.
insert into registrations (organization_id, activity_id, participant_id, registered_at)
select r.organization_id, r.activity_id, m.canonical_id, min(r.registered_at)
from registrations r
join _lexams_participant_merge_map_005 m on m.duplicate_id = r.participant_id
group by r.organization_id, r.activity_id, m.canonical_id
on conflict (activity_id, participant_id) do nothing;

delete from registrations r
using _lexams_participant_merge_map_005 m
where r.participant_id = m.duplicate_id;

-- Attendance: copy duplicate attendance to the canonical participant. Existing
-- canonical attendance remains authoritative when both records already exist.
insert into attendance (organization_id, activity_id, participant_id, session_label, status, recorded_at)
select a.organization_id,
       a.activity_id,
       m.canonical_id,
       a.session_label,
       case min(case a.status when 'present' then 1 when 'late' then 2 else 3 end)
         when 1 then 'present'
         when 2 then 'late'
         else 'absent'
       end,
       min(a.recorded_at)
from attendance a
join _lexams_participant_merge_map_005 m on m.duplicate_id = a.participant_id
group by a.organization_id, a.activity_id, m.canonical_id, a.session_label
on conflict (activity_id, participant_id, session_label) do nothing;

delete from attendance a
using _lexams_participant_merge_map_005 m
where a.participant_id = m.duplicate_id;

update certificates c
set participant_id = m.canonical_id
from _lexams_participant_merge_map_005 m
where c.participant_id = m.duplicate_id;

update survey_responses s
set participant_id = m.canonical_id
from _lexams_participant_merge_map_005 m
where s.participant_id = m.duplicate_id;

update assessment_submissions a
set participant_id = m.canonical_id
from _lexams_participant_merge_map_005 m
where a.participant_id = m.duplicate_id;

delete from participants p
using _lexams_participant_merge_map_005 m
where p.id = m.duplicate_id;

drop table if exists _lexams_participant_merge_map_005;

create unique index if not exists idx_participants_org_normalized_email
  on participants (organization_id, lower(btrim(email)))
  where btrim(email) <> '';

-- 2. Participant pass identity.
alter table participants
  add column if not exists pass_token uuid not null default gen_random_uuid();
create unique index if not exists idx_participants_pass_token on participants(pass_token);

-- 3. Registration lifecycle and activity-level registration configuration.
alter table activities
  add column if not exists registration_capacity integer,
  add column if not exists waitlist_enabled boolean not null default false,
  add column if not exists registration_opens_at timestamptz,
  add column if not exists registration_closes_at timestamptz,
  add column if not exists registration_approval_required boolean not null default false,
  add column if not exists registration_confirmation_email boolean not null default true,
  add column if not exists registration_confirmation_message text not null default '',
  add column if not exists registration_custom_fields jsonb not null default '[]'::jsonb;

alter table activities
  drop constraint if exists activities_registration_capacity_check;
alter table activities
  add constraint activities_registration_capacity_check
  check (registration_capacity is null or registration_capacity > 0);

alter table registrations
  add column if not exists status text not null default 'confirmed',
  add column if not exists reference_code text,
  add column if not exists custom_answers jsonb not null default '{}'::jsonb,
  add column if not exists confirmed_at timestamptz;

-- Backfill stable registration references before enforcing uniqueness.
update registrations
set reference_code = 'REG-' || upper(substr(md5(id::text || ':' || activity_id::text || ':' || participant_id::text), 1, 10))
where reference_code is null or btrim(reference_code) = '';

update registrations
set confirmed_at = coalesce(confirmed_at, registered_at)
where status = 'confirmed';

alter table registrations
  alter column reference_code set not null;

alter table registrations
  drop constraint if exists registrations_status_check;
alter table registrations
  add constraint registrations_status_check check (status in ('confirmed','pending','waitlisted','cancelled'));

create unique index if not exists idx_registrations_reference_code on registrations(reference_code);
create index if not exists idx_registrations_activity_status on registrations(organization_id, activity_id, status);

-- 4. First-class sessions. One row is created for every existing Day N session.
create table if not exists activity_sessions (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id bigint not null references activities(id) on delete cascade,
  title text not null,
  session_date date not null,
  starts_at time,
  ends_at time,
  checkin_open_at timestamptz,
  checkin_close_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','open','closed')),
  checkin_token uuid not null default gen_random_uuid(),
  checkin_pin text,
  grace_minutes integer not null default 15 check (grace_minutes >= 0 and grace_minutes <= 240),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, sort_order)
);

create unique index if not exists idx_activity_sessions_checkin_token on activity_sessions(checkin_token);
create index if not exists idx_activity_sessions_activity on activity_sessions(organization_id, activity_id, session_date, sort_order);

insert into activity_sessions (organization_id, activity_id, title, session_date, sort_order)
select a.organization_id,
       a.id,
       'Day ' || series.n,
       least(a.start_date + (series.n - 1), a.end_date),
       series.n - 1
from activities a
cross join lateral generate_series(1, greatest(1, a.sessions)) as series(n)
where not exists (select 1 from activity_sessions s where s.activity_id = a.id)
on conflict (activity_id, sort_order) do nothing;

-- 5. Link attendance to real sessions while retaining session_label for compatibility.
alter table attendance
  add column if not exists session_id bigint references activity_sessions(id) on delete cascade,
  add column if not exists source text not null default 'staff',
  add column if not exists recorded_by uuid references users(id) on delete set null;

alter table attendance
  drop constraint if exists attendance_source_check;
alter table attendance
  add constraint attendance_source_check check (source in ('staff','self','kiosk','import'));

update attendance a
set session_id = s.id
from activity_sessions s
where a.session_id is null
  and s.activity_id = a.activity_id
  and s.organization_id = a.organization_id
  and lower(s.title) = lower(a.session_label);

create index if not exists idx_attendance_session on attendance(organization_id, session_id, status);

-- 6. Session-specific public check-in attempts provide a small audit surface and
-- make multi-device/idempotency behaviour observable without blocking attendance.
create table if not exists checkin_events (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id bigint not null references activities(id) on delete cascade,
  session_id bigint not null references activity_sessions(id) on delete cascade,
  participant_id bigint references participants(id) on delete set null,
  result text not null check (result in ('checked_in','already_checked_in','not_registered','invalid_identity','session_closed')),
  source text not null default 'self' check (source in ('staff','self','kiosk')),
  created_at timestamptz not null default now()
);
create index if not exists idx_checkin_events_session_created on checkin_events(organization_id, session_id, created_at desc);
