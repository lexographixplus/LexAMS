-- LexAMS Free + Pro monetisation foundation.
-- Subscription ownership is always at organisation level.

create table if not exists organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'grace', 'past_due', 'cancelled', 'expired')),
  billing_cycle text check (billing_cycle in ('monthly', 'annual')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_period_end timestamptz,
  provider text not null default 'manual' check (provider in ('modempay', 'manual', 'complimentary')),
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_organization_subscriptions_status_period
  on organization_subscriptions (status, current_period_end);

create table if not exists billing_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  subscription_id uuid references organization_subscriptions(id) on delete set null,
  provider text not null check (provider in ('modempay', 'manual', 'complimentary')),
  provider_invoice_id text,
  internal_reference text not null unique,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'GMD' check (currency = 'GMD'),
  status text not null default 'pending' check (status in ('draft', 'pending', 'paid', 'failed', 'cancelled', 'void', 'overdue')),
  due_at timestamptz,
  payment_url text,
  billing_period_start timestamptz,
  billing_period_end timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_invoice_id)
);

create index if not exists idx_billing_invoices_org_created
  on billing_invoices (organization_id, created_at desc);

create table if not exists billing_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id uuid references billing_invoices(id) on delete set null,
  provider text not null check (provider in ('modempay', 'manual', 'complimentary')),
  provider_transaction_id text,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'GMD' check (currency = 'GMD'),
  status text not null check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  payment_method text,
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_transaction_id)
);

create index if not exists idx_billing_transactions_org_created
  on billing_transactions (organization_id, created_at desc);

create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('modempay', 'manual', 'complimentary')),
  provider_event_id text,
  event_type text not null,
  payload_hash text,
  processing_status text not null default 'received' check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  unique (provider, provider_event_id)
);

create table if not exists platform_administrators (
  user_id uuid primary key references users(id) on delete cascade,
  role text not null default 'billing_admin' check (role in ('billing_admin', 'platform_admin')),
  created_at timestamptz not null default now(),
  created_by uuid references users(id) on delete set null
);

create table if not exists billing_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_user_id uuid not null references users(id) on delete restrict,
  action text not null,
  reason text not null,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Existing and future organisations are safe by default: Free, active and non-billed.
insert into organization_subscriptions (organization_id, plan, status, provider)
select id, 'free', 'active', 'manual'
from organizations
on conflict (organization_id) do nothing;
