-- ============================================================
-- SURVEYS & ASSESSMENTS - Full Builder Schema
-- ============================================================

-- ============================================================
-- SURVEYS (redesigned for builder)
-- ============================================================

create extension if not exists "uuid-ossp" schema extensions;

-- Drop old surveys table and recreate
drop table if exists public.surveys cascade;

create table public.surveys (
  id bigint generated always as identity primary key,
  activity_id bigint references public.activities(id) on delete cascade,
  title text not null,
  description text default '',
  share_token uuid not null default gen_random_uuid(),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_surveys_share_token on public.surveys(share_token);
create index idx_surveys_activity on public.surveys(activity_id);

alter table public.surveys enable row level security;

create policy "Authenticated users can manage surveys"
  on public.surveys for all
  to authenticated
  using (true);

create policy "Public can view active surveys by token"
  on public.surveys for select
  to anon
  using (status = 'active');

-- Survey questions
create table public.survey_questions (
  id bigint generated always as identity primary key,
  survey_id bigint not null references public.surveys(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'rating'
    check (question_type in ('rating', 'multiple_choice', 'text', 'yes_no')),
  options jsonb default '[]'::jsonb,
  required boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_survey_questions_survey on public.survey_questions(survey_id);

alter table public.survey_questions enable row level security;

create policy "Authenticated users can manage survey questions"
  on public.survey_questions for all
  to authenticated
  using (true);

create policy "Public can view questions for active surveys"
  on public.survey_questions for select
  to anon
  using (
    exists (
      select 1 from public.surveys
      where id = survey_id and status = 'active'
    )
  );

-- Survey responses (one per respondent per survey)
create table public.survey_responses (
  id bigint generated always as identity primary key,
  survey_id bigint not null references public.surveys(id) on delete cascade,
  participant_id bigint references public.participants(id) on delete set null,
  respondent_name text default '',
  respondent_email text default '',
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create index idx_survey_responses_survey on public.survey_responses(survey_id);

alter table public.survey_responses enable row level security;

create policy "Authenticated users can view survey responses"
  on public.survey_responses for select
  to authenticated
  using (true);

create policy "Anyone can submit survey responses"
  on public.survey_responses for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.surveys
      where id = survey_id and status = 'active'
    )
  );

-- ============================================================
-- ASSESSMENTS (redesigned for builder)
-- ============================================================

drop table if exists public.assessments cascade;

create table public.assessments (
  id bigint generated always as identity primary key,
  activity_id bigint references public.activities(id) on delete cascade,
  title text not null,
  description text default '',
  assessment_type text not null default 'standalone'
    check (assessment_type in ('pre', 'post', 'standalone')),
  share_token uuid not null default gen_random_uuid(),
  time_limit_minutes int,
  passing_score int default 70,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_assessments_share_token on public.assessments(share_token);
create index idx_assessments_activity on public.assessments(activity_id);

alter table public.assessments enable row level security;

create policy "Authenticated users can manage assessments"
  on public.assessments for all
  to authenticated
  using (true);

create policy "Public can view active assessments by token"
  on public.assessments for select
  to anon
  using (status = 'active');

-- Assessment questions
create table public.assessment_questions (
  id bigint generated always as identity primary key,
  assessment_id bigint not null references public.assessments(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'multiple_choice'
    check (question_type in ('multiple_choice', 'short_answer', 'long_answer', 'true_false')),
  options jsonb default '[]'::jsonb,
  correct_answer text,
  points int not null default 1,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_assessment_questions_assessment on public.assessment_questions(assessment_id);

alter table public.assessment_questions enable row level security;

create policy "Authenticated users can manage assessment questions"
  on public.assessment_questions for all
  to authenticated
  using (true);

create policy "Public can view questions for active assessments"
  on public.assessment_questions for select
  to anon
  using (
    exists (
      select 1 from public.assessments
      where id = assessment_id and status = 'active'
    )
  );

-- Assessment submissions
create table public.assessment_submissions (
  id bigint generated always as identity primary key,
  assessment_id bigint not null references public.assessments(id) on delete cascade,
  participant_id bigint references public.participants(id) on delete set null,
  respondent_name text default '',
  respondent_email text default '',
  answers jsonb not null default '{}'::jsonb,
  score int,
  total_points int,
  percentage numeric(5,2),
  passed boolean,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index idx_assessment_submissions_assessment on public.assessment_submissions(assessment_id);

alter table public.assessment_submissions enable row level security;

create policy "Authenticated users can view submissions"
  on public.assessment_submissions for select
  to authenticated
  using (true);

create policy "Anyone can submit assessments"
  on public.assessment_submissions for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.assessments
      where id = assessment_id and status = 'active'
    )
  );

-- Update trigger for new tables
create trigger set_surveys_updated_at
  before update on public.surveys
  for each row execute function public.set_updated_at();

create trigger set_assessments_updated_at
  before update on public.assessments
  for each row execute function public.set_updated_at();
