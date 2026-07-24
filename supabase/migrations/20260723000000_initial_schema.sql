-- ============================================================
-- LexAMS Database Schema
-- Activity Management System for NGOs & Community Organizations
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  org_name text not null default 'My Organization',
  role text not null default 'Institution Administrator'
    check (role in ('Institution Administrator', 'Activity Manager', 'Facilitator')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, org_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    coalesce(new.raw_user_meta_data->>'org_name', 'My Organization')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. PARTICIPANTS
-- ============================================================
create table public.participants (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  phone text default '',
  org text default '',
  category text not null default 'Community member'
    check (category in ('Volunteer', 'Staff', 'Community member', 'Partner', 'Youth', 'Teacher', 'Parent', 'External')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_participants_email on public.participants(email);
create index idx_participants_user_id on public.participants(user_id);

alter table public.participants enable row level security;

create policy "Authenticated users can view participants"
  on public.participants for select
  to authenticated
  using (true);

create policy "Authenticated users can insert participants"
  on public.participants for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update participants"
  on public.participants for update
  to authenticated
  using (true);

-- ============================================================
-- 3. ACTIVITIES
-- ============================================================
create table public.activities (
  id bigint generated always as identity primary key,
  title text not null,
  type text not null default 'Training'
    check (type in ('Training', 'Workshop', 'Meeting', 'Seminar', 'Conference', 'Community engagement')),
  status text not null default 'Upcoming'
    check (status in ('Completed', 'Ongoing', 'Upcoming')),
  venue text not null default 'TBD',
  organizer text not null default '',
  facilitator text not null default '',
  start_date date not null,
  end_date date not null,
  sessions int not null default 1,
  reg_open boolean not null default true,
  description text default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.activities enable row level security;

create policy "Authenticated users can view activities"
  on public.activities for select
  to authenticated
  using (true);

create policy "Authenticated users can insert activities"
  on public.activities for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update activities"
  on public.activities for update
  to authenticated
  using (true);

-- Public can view activities with open registration
create policy "Public can view open activities"
  on public.activities for select
  to anon
  using (reg_open = true);

-- ============================================================
-- 4. REGISTRATIONS (participant <-> activity link)
-- ============================================================
create table public.registrations (
  id bigint generated always as identity primary key,
  activity_id bigint not null references public.activities(id) on delete cascade,
  participant_id bigint not null references public.participants(id) on delete cascade,
  registered_at timestamptz not null default now(),
  unique (activity_id, participant_id)
);

create index idx_registrations_activity on public.registrations(activity_id);
create index idx_registrations_participant on public.registrations(participant_id);

alter table public.registrations enable row level security;

create policy "Authenticated users can view registrations"
  on public.registrations for select
  to authenticated
  using (true);

create policy "Authenticated users can insert registrations"
  on public.registrations for insert
  to authenticated
  with check (true);

-- Public registration (anon users can register for open activities)
create policy "Anon can register for open activities"
  on public.registrations for insert
  to anon
  with check (
    exists (
      select 1 from public.activities
      where id = activity_id and reg_open = true
    )
  );

-- ============================================================
-- 5. ATTENDANCE
-- ============================================================
create table public.attendance (
  id bigint generated always as identity primary key,
  activity_id bigint not null references public.activities(id) on delete cascade,
  participant_id bigint not null references public.participants(id) on delete cascade,
  session_label text not null default 'Day 1',
  status text not null default 'present'
    check (status in ('present', 'late', 'absent')),
  recorded_at timestamptz not null default now(),
  unique (activity_id, participant_id, session_label)
);

create index idx_attendance_activity on public.attendance(activity_id);

alter table public.attendance enable row level security;

create policy "Authenticated users can view attendance"
  on public.attendance for select
  to authenticated
  using (true);

create policy "Authenticated users can insert attendance"
  on public.attendance for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update attendance"
  on public.attendance for update
  to authenticated
  using (true);

-- ============================================================
-- 6. CERTIFICATES
-- ============================================================
create table public.certificates (
  id bigint generated always as identity primary key,
  cert_no text not null unique,
  activity_id bigint not null references public.activities(id) on delete cascade,
  participant_id bigint not null references public.participants(id) on delete cascade,
  issued_date date not null default current_date,
  issued_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_certificates_cert_no on public.certificates(cert_no);
create index idx_certificates_activity on public.certificates(activity_id);

alter table public.certificates enable row level security;

create policy "Authenticated users can view certificates"
  on public.certificates for select
  to authenticated
  using (true);

create policy "Authenticated users can insert certificates"
  on public.certificates for insert
  to authenticated
  with check (true);

-- Public can verify certificates
create policy "Public can verify certificates"
  on public.certificates for select
  to anon
  using (true);

-- ============================================================
-- 7. SURVEYS
-- ============================================================
create table public.surveys (
  id bigint generated always as identity primary key,
  activity_id bigint not null references public.activities(id) on delete cascade unique,
  sent int not null default 0,
  responses int not null default 0,
  questions jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.surveys enable row level security;

create policy "Authenticated users can view surveys"
  on public.surveys for select
  to authenticated
  using (true);

create policy "Authenticated users can manage surveys"
  on public.surveys for all
  to authenticated
  using (true);

-- ============================================================
-- 8. ASSESSMENTS
-- ============================================================
create table public.assessments (
  id bigint generated always as identity primary key,
  activity_id bigint not null references public.activities(id) on delete cascade,
  participant_id bigint not null references public.participants(id) on delete cascade,
  pre_score int,
  post_score int,
  created_at timestamptz not null default now(),
  unique (activity_id, participant_id)
);

alter table public.assessments enable row level security;

create policy "Authenticated users can view assessments"
  on public.assessments for select
  to authenticated
  using (true);

create policy "Authenticated users can manage assessments"
  on public.assessments for all
  to authenticated
  using (true);

-- ============================================================
-- 9. CERTIFICATE NUMBER SEQUENCE
-- ============================================================
create sequence public.cert_seq start with 1;

create or replace function public.next_cert_no()
returns text as $$
begin
  return 'LEX-' || extract(year from current_date)::text || '-' || lpad(nextval('public.cert_seq')::text, 4, '0');
end;
$$ language plpgsql;

-- ============================================================
-- 10. UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_participants_updated_at
  before update on public.participants
  for each row execute function public.set_updated_at();

create trigger set_activities_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

-- ============================================================
-- 11. STORAGE BUCKET FOR CERTIFICATES / EXPORTS
-- ============================================================
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do nothing;

-- Storage policies
create policy "Authenticated users can upload certificates"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'certificates');

create policy "Anyone can view certificates"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'certificates');

create policy "Authenticated users can upload exports"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'exports');

create policy "Authenticated users can download exports"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'exports');
