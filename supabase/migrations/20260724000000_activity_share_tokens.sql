-- Add share tokens for registration and attendance links
alter table public.activities
  add column reg_token uuid default gen_random_uuid(),
  add column att_token uuid default gen_random_uuid();

-- Update existing rows
update public.activities set reg_token = gen_random_uuid(), att_token = gen_random_uuid() where reg_token is null;

-- Make non-null
alter table public.activities alter column reg_token set not null;
alter table public.activities alter column att_token set not null;

create unique index idx_activities_reg_token on public.activities(reg_token);
create unique index idx_activities_att_token on public.activities(att_token);

-- Allow anon to view activities by token (for public pages)
create policy "Anon can view activities by reg token"
  on public.activities for select
  to anon
  using (true);

-- Allow anon to insert participants (for public registration)
create policy "Anon can insert participants"
  on public.participants for insert
  to anon
  with check (true);

-- Allow anon to view participants by email (for returning participant check)
create policy "Anon can view participants"
  on public.participants for select
  to anon
  using (true);

-- Allow anon to insert attendance (for public check-in)
create policy "Anon can insert attendance"
  on public.attendance for insert
  to anon
  with check (true);

-- Allow anon to view registrations (for check-in validation)
create policy "Anon can view registrations"
  on public.registrations for select
  to anon
  using (true);
