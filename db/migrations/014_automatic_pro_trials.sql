-- Every newly created workspace starts with a 30-day Pro trial.
-- Existing subscriptions are deliberately left unchanged.

alter table organization_subscriptions
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

alter table organization_subscriptions
  drop constraint if exists organization_subscriptions_status_check;

alter table organization_subscriptions
  add constraint organization_subscriptions_status_check
  check (status in ('trialing', 'active', 'grace', 'past_due', 'cancelled', 'expired'));

create index if not exists idx_organization_subscriptions_trial_expiry
  on organization_subscriptions (trial_ends_at)
  where status = 'trialing';
