-- Persistent, privacy-preserving fixed-window counters for public endpoints.
-- Client addresses are hashed in application code; raw IP addresses are never stored here.

create table if not exists public_rate_limits (
  scope text not null,
  client_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  primary key (scope, client_key, window_start)
);

create index if not exists idx_public_rate_limits_expires_at
  on public_rate_limits (expires_at);
