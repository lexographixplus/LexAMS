-- LexAMS activity-wide daily check-in
-- One permanent activity QR/link is valid across the activity dates.
-- The server selects today's attendance day and enforces the configured daily window.

alter table activities
  add column if not exists daily_checkin_enabled boolean not null default true,
  add column if not exists daily_checkin_window_start time,
  add column if not exists daily_checkin_window_end time,
  add column if not exists daily_checkin_timezone text not null default 'UTC';

do $$
begin
  alter table activities
    add constraint activities_daily_checkin_window_check
    check (
      daily_checkin_window_start is null
      or daily_checkin_window_end is null
      or daily_checkin_window_end > daily_checkin_window_start
    );
exception
  when duplicate_object then null;
end $$;

-- Activity-wide attempts may be associated with a delivery session for the day,
-- but the audit record also works when no explicit session exists for that date.
alter table checkin_events
  alter column session_id drop not null,
  add column if not exists checkin_date date;

create index if not exists idx_checkin_events_activity_date
  on checkin_events (organization_id, activity_id, checkin_date, created_at desc);
