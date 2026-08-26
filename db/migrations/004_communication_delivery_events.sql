-- LexAMS communication delivery tracking and suppression foundation

alter table communication_deliveries
  add column if not exists provider_event_at timestamptz;

alter table communication_deliveries
  drop constraint if exists communication_deliveries_status_check;

alter table communication_deliveries
  add constraint communication_deliveries_status_check
  check (status in ('queued','sent','delivered','failed','bounced','complained','suppressed'));

create unique index if not exists idx_communication_deliveries_provider_message
  on communication_deliveries(provider_message_id)
  where provider_message_id is not null;

create table if not exists resend_webhook_events (
  event_id text primary key,
  event_type text not null,
  email_id text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index if not exists idx_resend_webhook_events_email
  on resend_webhook_events(email_id, received_at desc);

create table if not exists participant_email_suppressions (
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  reason text not null,
  source_event_id text references resend_webhook_events(event_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, email)
);
