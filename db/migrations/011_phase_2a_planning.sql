-- LexAMS Phase 2A: activity planning, tasks, richer sessions and facilitator assignments.
-- All additions are nullable/default-safe so existing activities and sessions remain valid.

create table if not exists activity_tasks (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id bigint not null references activities(id) on delete cascade,
  title text not null,
  description text not null default '',
  stage text not null default 'pre' check (stage in ('pre','during','post')),
  assignee_user_id uuid references users(id) on delete set null,
  due_date date,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done')),
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_activity_tasks_activity
  on activity_tasks (organization_id, activity_id, stage, status, due_date, sort_order);
create index if not exists idx_activity_tasks_assignee
  on activity_tasks (organization_id, assignee_user_id, status, due_date);

alter table activity_sessions
  add column if not exists description text not null default '',
  add column if not exists learning_objectives text not null default '',
  add column if not exists venue text not null default '',
  add column if not exists planning_status text not null default 'draft';

alter table activity_sessions
  drop constraint if exists activity_sessions_planning_status_check;
alter table activity_sessions
  add constraint activity_sessions_planning_status_check
  check (planning_status in ('draft','ready','delivered','cancelled'));

create unique index if not exists idx_activity_sessions_tenant_identity
  on activity_sessions (id, activity_id, organization_id);

create table if not exists session_facilitators (
  organization_id uuid not null,
  activity_id bigint not null,
  session_id bigint not null,
  user_id uuid not null,
  is_lead boolean not null default false,
  role_label text not null default 'Facilitator',
  assigned_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id),
  foreign key (session_id, activity_id, organization_id)
    references activity_sessions(id, activity_id, organization_id) on delete cascade,
  foreign key (organization_id, user_id)
    references organization_members(organization_id, user_id) on delete cascade
);

create unique index if not exists idx_session_facilitators_one_lead
  on session_facilitators (session_id) where is_lead;
create index if not exists idx_session_facilitators_member
  on session_facilitators (organization_id, user_id, activity_id);
