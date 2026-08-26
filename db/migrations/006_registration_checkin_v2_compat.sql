-- Compatibility layer for existing LexAMS write paths after Registration & Check-in V2.

-- Existing add_registration calls do not explicitly provide these V2 fields.
alter table registrations
  alter column reference_code set default ('REG-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  alter column confirmed_at set default now();

-- New activities use the permanent activity-wide check-in flow by default.
-- First-class sessions remain available as an advanced option and can be added
-- from the activity operations workspace when session-level attendance is needed.
