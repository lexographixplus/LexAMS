-- Compatibility layer for existing LexAMS write paths after Registration & Check-in V2.

-- Existing add_registration calls do not explicitly provide these V2 fields.
alter table registrations
  alter column reference_code set default ('REG-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  alter column confirmed_at set default now();

-- Seed first-class sessions automatically for activities created through the
-- existing activity creation flow. Customized sessions are never overwritten.
create or replace function lexams_seed_activity_sessions()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from activity_sessions s where s.activity_id = new.id) then
    insert into activity_sessions (organization_id, activity_id, title, session_date, sort_order)
    select new.organization_id,
           new.id,
           'Day ' || series.n,
           least(new.start_date + (series.n - 1), new.end_date),
           series.n - 1
    from generate_series(1, greatest(1, new.sessions)) as series(n)
    on conflict (activity_id, sort_order) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lexams_seed_activity_sessions on activities;
create trigger trg_lexams_seed_activity_sessions
after insert on activities
for each row execute function lexams_seed_activity_sessions();
