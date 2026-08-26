-- LexAMS participant communications and certificate delivery foundation

alter table certificates
  add column if not exists access_token uuid not null default gen_random_uuid();
create unique index if not exists idx_certificates_access_token on certificates(access_token);

create table if not exists organization_communication_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  auto_send_certificates boolean not null default false,
  reply_to_email text,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists communication_messages (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id bigint references activities(id) on delete set null,
  kind text not null check (kind in ('announcement','certificate')),
  subject text not null,
  body text not null default '',
  audience jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists communication_deliveries (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  message_id bigint not null references communication_messages(id) on delete cascade,
  participant_id bigint references participants(id) on delete set null,
  certificate_id bigint references certificates(id) on delete set null,
  recipient_name text not null default '',
  recipient_email text not null,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued','sent','delivered','failed','bounced','complained')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_communication_messages_org_created
  on communication_messages(organization_id, created_at desc);
create index if not exists idx_communication_deliveries_org_created
  on communication_deliveries(organization_id, created_at desc);
create index if not exists idx_communication_deliveries_message
  on communication_deliveries(message_id);
create index if not exists idx_communication_deliveries_certificate
  on communication_deliveries(certificate_id);
