create extension if not exists pgcrypto;

-- Auth.js tables
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text unique,
  "emailVerified" timestamptz,
  image text
);
create table if not exists accounts (
  id bigserial primary key,
  "userId" uuid not null references users(id) on delete cascade,
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  unique (provider, "providerAccountId")
);
create table if not exists sessions (
  id bigserial primary key,
  "sessionToken" text not null unique,
  "userId" uuid not null references users(id) on delete cascade,
  expires timestamptz not null
);
create table if not exists verification_token (
  identifier text not null,
  token text not null unique,
  expires timestamptz not null,
  primary key (identifier, token)
);

-- Workspace tenancy
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','programme_manager','facilitator','me_officer','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create table if not exists profiles (
  user_id uuid primary key references users(id) on delete cascade,
  full_name text,
  active_organization_id uuid references organizations(id) on delete set null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing LexAMS operational model, now tenant-scoped
create table if not exists activities (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  type text not null default 'Training',
  status text not null default 'Upcoming' check (status in ('Completed','Ongoing','Upcoming')),
  venue text not null default 'TBD',
  organizer text not null default '',
  facilitator text not null default '',
  start_date date not null,
  end_date date not null,
  sessions integer not null default 1,
  reg_open boolean not null default true,
  reg_token uuid not null default gen_random_uuid(),
  att_token uuid not null default gen_random_uuid(),
  description text default '',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_activities_reg_token on activities(reg_token);
create unique index if not exists idx_activities_att_token on activities(att_token);

create table if not exists participants (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  email text not null,
  phone text default '',
  org text default '',
  category text not null default 'Community member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists registrations (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id bigint not null references activities(id) on delete cascade,
  participant_id bigint not null references participants(id) on delete cascade,
  registered_at timestamptz not null default now(),
  unique (activity_id, participant_id)
);
create table if not exists attendance (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id bigint not null references activities(id) on delete cascade,
  participant_id bigint not null references participants(id) on delete cascade,
  session_label text not null default 'Day 1',
  status text not null default 'present' check (status in ('present','late','absent')),
  recorded_at timestamptz not null default now(),
  unique (activity_id, participant_id, session_label)
);

create table if not exists surveys (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id bigint references activities(id) on delete cascade,
  title text not null,
  description text default '',
  share_token uuid not null default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft','active','closed')),
  allow_anonymous boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_surveys_share_token on surveys(share_token);
create table if not exists survey_questions (
  id bigint generated always as identity primary key,
  survey_id bigint not null references surveys(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'rating' check (question_type in ('rating','multiple_choice','text','yes_no')),
  options jsonb default '[]'::jsonb,
  required boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists survey_responses (
  id bigint generated always as identity primary key,
  survey_id bigint not null references surveys(id) on delete cascade,
  participant_id bigint references participants(id) on delete set null,
  respondent_name text default '',
  respondent_email text default '',
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create table if not exists assessments (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id bigint references activities(id) on delete cascade,
  title text not null,
  description text default '',
  assessment_type text not null default 'standalone' check (assessment_type in ('pre','post','standalone')),
  share_token uuid not null default gen_random_uuid(),
  time_limit_minutes integer,
  passing_score integer default 70,
  status text not null default 'draft' check (status in ('draft','active','closed')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_assessments_share_token on assessments(share_token);
create table if not exists assessment_questions (
  id bigint generated always as identity primary key,
  assessment_id bigint not null references assessments(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'multiple_choice' check (question_type in ('multiple_choice','short_answer','long_answer','true_false')),
  options jsonb default '[]'::jsonb,
  correct_answer text,
  points integer not null default 1,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists assessment_submissions (
  id bigint generated always as identity primary key,
  assessment_id bigint not null references assessments(id) on delete cascade,
  participant_id bigint references participants(id) on delete set null,
  respondent_name text default '',
  respondent_email text default '',
  answers jsonb not null default '{}'::jsonb,
  score integer,
  total_points integer,
  percentage numeric(5,2),
  passed boolean,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists certificates (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  cert_no text not null unique,
  activity_id bigint not null references activities(id) on delete cascade,
  participant_id bigint not null references participants(id) on delete cascade,
  certificate_type text not null default 'completion',
  issued_date date not null default current_date,
  issued_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists team_invites (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  invited_by uuid not null references users(id) on delete cascade,
  email text not null,
  role text not null default 'viewer',
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create unique index if not exists idx_team_invites_token on team_invites(token);

create table if not exists pending_approvals (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  requested_by uuid not null references users(id) on delete cascade,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_members_user on organization_members(user_id);
create index if not exists idx_activities_org on activities(organization_id, start_date desc);
create index if not exists idx_participants_org on participants(organization_id, name);
create index if not exists idx_registrations_org_activity on registrations(organization_id, activity_id);
create index if not exists idx_attendance_org_activity on attendance(organization_id, activity_id);
create index if not exists idx_surveys_org_activity on surveys(organization_id, activity_id);
create index if not exists idx_survey_questions_survey on survey_questions(survey_id);
create index if not exists idx_survey_responses_survey on survey_responses(survey_id);
create index if not exists idx_assessments_org_activity on assessments(organization_id, activity_id);
create index if not exists idx_assessment_questions_assessment on assessment_questions(assessment_id);
create index if not exists idx_assessment_submissions_assessment on assessment_submissions(assessment_id);
create index if not exists idx_certificates_org on certificates(organization_id, issued_date desc);
create index if not exists idx_pending_approvals_org on pending_approvals(organization_id, status);
create index if not exists idx_audit_org_created on audit_log(organization_id, created_at desc);
