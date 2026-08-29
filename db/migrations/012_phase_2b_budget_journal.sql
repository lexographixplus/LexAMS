-- LexAMS Phase 2B: lightweight activity budgets and implementation journals.
-- Additive/default-safe changes preserve every existing activity and planning record.

alter table activities
  add column if not exists budget_currency text not null default 'GMD';

alter table activities
  drop constraint if exists activities_budget_currency_check;
alter table activities
  add constraint activities_budget_currency_check
  check (budget_currency ~ '^[A-Z]{3}$');

create table if not exists activity_budget_items (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id bigint not null references activities(id) on delete cascade,
  category text not null default 'General',
  item_name text not null,
  planned_amount numeric(14,2),
  actual_amount numeric(14,2),
  evidence_date date,
  notes text not null default '',
  evidence_url text not null default '',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (planned_amount is null or planned_amount >= 0),
  check (actual_amount is null or actual_amount >= 0)
);

create index if not exists idx_activity_budget_items_activity
  on activity_budget_items (organization_id, activity_id, category, evidence_date, id);

create unique index if not exists idx_activity_tasks_tenant_identity
  on activity_tasks (id, activity_id, organization_id);

create table if not exists activity_journal_entries (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id bigint not null references activities(id) on delete cascade,
  entry_mode text not null default 'daily' check (entry_mode in ('daily','weekly')),
  entry_date date not null,
  period_end date,
  progress_summary text not null,
  achievements text not null default '',
  challenges text not null default '',
  observations_lessons text not null default '',
  actions_follow_up text not null default '',
  follow_up_status text not null default 'open' check (follow_up_status in ('open','resolved','not_required')),
  evidence_url text not null default '',
  include_in_report boolean not null default true,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (entry_mode = 'daily' and period_end is null)
    or (entry_mode = 'weekly' and period_end is not null and period_end >= entry_date)
  )
);

create unique index if not exists idx_activity_journal_entries_tenant_identity
  on activity_journal_entries (id, activity_id, organization_id);
create index if not exists idx_activity_journal_entries_timeline
  on activity_journal_entries (organization_id, activity_id, entry_date desc, id desc);
create index if not exists idx_activity_journal_entries_follow_up
  on activity_journal_entries (organization_id, activity_id, follow_up_status)
  where follow_up_status = 'open';

create table if not exists journal_entry_sessions (
  organization_id uuid not null,
  activity_id bigint not null,
  journal_entry_id bigint not null,
  session_id bigint not null,
  primary key (journal_entry_id, session_id),
  foreign key (journal_entry_id, activity_id, organization_id)
    references activity_journal_entries(id, activity_id, organization_id) on delete cascade,
  foreign key (session_id, activity_id, organization_id)
    references activity_sessions(id, activity_id, organization_id) on delete cascade
);

create table if not exists journal_entry_tasks (
  organization_id uuid not null,
  activity_id bigint not null,
  journal_entry_id bigint not null,
  task_id bigint not null,
  primary key (journal_entry_id, task_id),
  foreign key (journal_entry_id, activity_id, organization_id)
    references activity_journal_entries(id, activity_id, organization_id) on delete cascade,
  foreign key (task_id, activity_id, organization_id)
    references activity_tasks(id, activity_id, organization_id) on delete cascade
);

create index if not exists idx_journal_entry_sessions_session
  on journal_entry_sessions (organization_id, activity_id, session_id);
create index if not exists idx_journal_entry_tasks_task
  on journal_entry_tasks (organization_id, activity_id, task_id);
