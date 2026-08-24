create extension if not exists pgcrypto;

-- Auth.js Neon adapter tables
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

-- Multi-tenant LexAMS foundation
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

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
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
  description text default '',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text default '',
  org text default '',
  category text not null default 'Community member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  registered_at timestamptz not null default now(),
  unique (activity_id, participant_id)
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  session_label text not null default 'Day 1',
  status text not null default 'present' check (status in ('present','late','absent')),
  recorded_at timestamptz not null default now(),
  unique (activity_id, participant_id, session_label)
);

create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  title text,
  status text not null default 'draft',
  questions jsonb not null default '[]'::jsonb,
  responses integer not null default 0,
  share_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  pre_score integer,
  post_score integer,
  created_at timestamptz not null default now()
);

create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  cert_no text not null unique,
  activity_id uuid not null references activities(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  certificate_type text not null default 'completion',
  issued_date date not null default current_date,
  issued_by uuid references users(id) on delete set null,
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
create index if not exists idx_assessments_org_activity on assessments(organization_id, activity_id);
create index if not exists idx_certificates_org on certificates(organization_id, issued_date desc);
create index if not exists idx_audit_org_created on audit_log(organization_id, created_at desc);
