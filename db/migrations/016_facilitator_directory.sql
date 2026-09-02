-- Organization facilitator directory and one explicit facilitator per session.
-- Existing lead assignments are preserved by backfilling the directory and
-- linking each session to its lead (or first) legacy assignment.

create table if not exists facilitators (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  role text not null default 'Facilitator',
  email text not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create unique index if not exists idx_facilitators_org_email
  on facilitators (organization_id, lower(btrim(email)));
create index if not exists idx_facilitators_org_name
  on facilitators (organization_id, lower(btrim(name)));

insert into facilitators (organization_id, name, role, email, created_by)
select distinct on (sf.organization_id, lower(btrim(u.email)))
       sf.organization_id,
       coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(u.name), ''), u.email),
       coalesce(nullif(btrim(sf.role_label), ''), 'Facilitator'),
       lower(btrim(u.email)),
       sf.assigned_by
from session_facilitators sf
join users u on u.id = sf.user_id
left join profiles p on p.user_id = sf.user_id
where btrim(u.email) <> ''
  and not exists (
    select 1 from facilitators existing
    where existing.organization_id = sf.organization_id
      and lower(btrim(existing.email)) = lower(btrim(u.email))
  )
order by sf.organization_id, lower(btrim(u.email)), sf.is_lead desc, sf.created_at;

alter table activity_sessions
  add column if not exists facilitator_id bigint;

with preferred_assignment as (
  select distinct on (sf.session_id)
         sf.session_id,
         f.id as facilitator_id
  from session_facilitators sf
  join users u on u.id = sf.user_id
  join facilitators f
    on f.organization_id = sf.organization_id
   and lower(btrim(f.email)) = lower(btrim(u.email))
  order by sf.session_id, sf.is_lead desc, sf.created_at, sf.user_id
)
update activity_sessions session
set facilitator_id = preferred.facilitator_id
from preferred_assignment preferred
where session.id = preferred.session_id
  and session.facilitator_id is null;

alter table activity_sessions
  drop constraint if exists activity_sessions_facilitator_tenant_fkey;
alter table activity_sessions
  add constraint activity_sessions_facilitator_tenant_fkey
  foreign key (facilitator_id, organization_id)
  references facilitators(id, organization_id);

create index if not exists idx_activity_sessions_facilitator
  on activity_sessions (organization_id, facilitator_id, session_date);
