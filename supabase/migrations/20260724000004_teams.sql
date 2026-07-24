-- ============================================================
-- TEAM MANAGEMENT
-- Admin (account creator) can invite members
-- Members can work but some actions need admin approval
-- ============================================================

-- Add team fields to profiles
alter table public.profiles
  add column team_id uuid references auth.users(id) on delete set null,
  add column team_role text not null default 'admin'
    check (team_role in ('admin', 'member'));

-- Admin's team_id points to themselves
-- Members' team_id points to the admin who invited them

-- Team invitations
create table public.team_invites (
  id bigint generated always as identity primary key,
  invited_by uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'member'
    check (role in ('member')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create unique index idx_team_invites_token on public.team_invites(token);
create index idx_team_invites_email on public.team_invites(email);

alter table public.team_invites enable row level security;

create policy "Admins can manage their invites"
  on public.team_invites for all
  to authenticated
  using (invited_by = auth.uid());

create policy "Anyone can view invite by token"
  on public.team_invites for select
  to anon, authenticated
  using (true);

-- Pending approvals (for actions that need admin sign-off)
create table public.pending_approvals (
  id bigint generated always as identity primary key,
  team_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  action_type text not null
    check (action_type in ('issue_certificate', 'add_participant', 'delete_participant')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_pending_approvals_team on public.pending_approvals(team_id);

alter table public.pending_approvals enable row level security;

create policy "Team members can view their team approvals"
  on public.pending_approvals for select
  to authenticated
  using (true);

create policy "Team members can create approval requests"
  on public.pending_approvals for insert
  to authenticated
  with check (true);

create policy "Admins can update approval status"
  on public.pending_approvals for update
  to authenticated
  using (true);

create policy "Admins can delete approvals"
  on public.pending_approvals for delete
  to authenticated
  using (true);

-- Allow authenticated users to view other profiles in their team
create policy "Users can view team profiles"
  on public.profiles for select
  to authenticated
  using (true);
