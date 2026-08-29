-- Phase 2C-2E: reusable report templates, living activity reports,
-- evidence-grounded narrative state and source references.

create table if not exists report_templates (
  id bigint generated always as identity primary key,
  organization_id uuid references organizations(id) on delete cascade,
  code text,
  name text not null,
  description text not null default '',
  is_builtin boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_builtin and organization_id is null) or (not is_builtin and organization_id is not null))
);

create unique index if not exists idx_report_templates_builtin_code
  on report_templates(code) where is_builtin;
create unique index if not exists idx_report_templates_org_name
  on report_templates(organization_id, lower(name)) where organization_id is not null;
create index if not exists idx_report_templates_org
  on report_templates(organization_id, updated_at desc);

create table if not exists report_template_sections (
  id bigint generated always as identity primary key,
  organization_id uuid references organizations(id) on delete cascade,
  template_id bigint not null references report_templates(id) on delete cascade,
  title text not null,
  section_type text not null check (section_type in ('manual','linked','generated','hybrid')),
  source_type text check (source_type in (
    'activity_details','tasks','sessions','facilitators','participants','attendance',
    'budget','journal','surveys','assessments','certificates','combined'
  )),
  instructions text not null default '',
  starter_text text not null default '',
  visualization text not null default 'auto' check (visualization in ('auto','summary','bars','table','none')),
  is_required boolean not null default true,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((section_type='manual' and source_type is null) or (section_type<>'manual' and source_type is not null))
);

create index if not exists idx_report_template_sections_template
  on report_template_sections(template_id, position, id);

create table if not exists activity_reports (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id bigint not null references activities(id) on delete cascade,
  template_id bigint references report_templates(id) on delete set null,
  title text not null,
  status text not null default 'draft' check (status in ('draft','in_review','approved','archived')),
  reporting_period_start date,
  reporting_period_end date,
  created_by uuid references users(id) on delete set null,
  approved_by uuid references users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporting_period_end is null or reporting_period_start is null or reporting_period_end >= reporting_period_start)
);

create unique index if not exists idx_activity_reports_tenant_id
  on activity_reports(organization_id, activity_id, id);
create index if not exists idx_activity_reports_activity
  on activity_reports(organization_id, activity_id, updated_at desc);

create table if not exists activity_report_sections (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id bigint not null references activities(id) on delete cascade,
  report_id bigint not null references activity_reports(id) on delete cascade,
  template_section_id bigint references report_template_sections(id) on delete set null,
  title text not null,
  section_type text not null check (section_type in ('manual','linked','generated','hybrid')),
  source_type text check (source_type in (
    'activity_details','tasks','sessions','facilitators','participants','attendance',
    'budget','journal','surveys','assessments','certificates','combined'
  )),
  instructions text not null default '',
  content_text text not null default '',
  generated_text text not null default '',
  content_state text not null default 'empty' check (content_state in ('empty','generated','user_edited','approved')),
  generation_version text,
  source_hash text,
  source_snapshot jsonb,
  generated_at timestamptz,
  approved_by uuid references users(id) on delete set null,
  approved_at timestamptz,
  visualization text not null default 'auto' check (visualization in ('auto','summary','bars','table','none')),
  is_required boolean not null default true,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((section_type='manual' and source_type is null) or (section_type<>'manual' and source_type is not null))
);

create unique index if not exists idx_activity_report_sections_tenant_id
  on activity_report_sections(organization_id, activity_id, report_id, id);
create index if not exists idx_activity_report_sections_report
  on activity_report_sections(organization_id, activity_id, report_id, position, id);

create table if not exists report_section_references (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  activity_id bigint not null references activities(id) on delete cascade,
  report_id bigint not null references activity_reports(id) on delete cascade,
  section_id bigint not null references activity_report_sections(id) on delete cascade,
  source_type text not null,
  source_hash text not null,
  source_snapshot jsonb not null default '{}'::jsonb,
  generation_version text,
  captured_at timestamptz not null default now(),
  unique (organization_id, activity_id, report_id, section_id, source_type)
);

create index if not exists idx_report_section_references_section
  on report_section_references(organization_id, activity_id, report_id, section_id);

-- System starter templates are shared read-only across tenants. Organisations
-- duplicate them before customising, keeping migrations tenant-neutral.
insert into report_templates (code,name,description,is_builtin)
values
  ('training-report','Training Report','A complete training report covering delivery, participants, attendance, learning, budget and lessons.',true),
  ('workshop-report','Workshop Report','A concise workshop report focused on objectives, participation, delivery, feedback and next steps.',true),
  ('project-activity-report','Project Activity Report','An implementation-oriented activity report covering progress, outputs, expenditure, challenges and follow-up.',true)
on conflict do nothing;

insert into report_template_sections
  (organization_id,template_id,title,section_type,source_type,instructions,starter_text,visualization,is_required,position)
select null,t.id,s.title,s.section_type,s.source_type,s.instructions,s.starter_text,s.visualization,s.is_required,s.position
from report_templates t
join (values
  ('training-report','Executive Summary','generated','combined','Summarise the strongest verified delivery, participation and outcome signals.','','summary',true,10),
  ('training-report','Background','manual',null,'Explain the activity context and why it was organised.','','none',true,20),
  ('training-report','Objectives','linked','activity_details','Present the stated activity objectives and core details.','','summary',true,30),
  ('training-report','Participant Profile','linked','participants','Describe the registered participant group without inferring missing demographics.','','bars',true,40),
  ('training-report','Training Delivery','generated','sessions','Summarise the sessions that were planned and delivered.','','table',true,50),
  ('training-report','Attendance & Engagement','linked','attendance','Present attendance figures and status distribution.','','bars',true,60),
  ('training-report','Financial Summary','linked','budget','Present planned expenditure, actual expenditure and variance.','','bars',false,70),
  ('training-report','Learning & Feedback','hybrid','assessments','Connect verified learning results with the author''s interpretation.','','bars',false,80),
  ('training-report','Challenges & Lessons Learned','hybrid','journal','Use implementation entries as evidence while preserving editorial judgement.','','summary',true,90),
  ('training-report','Conclusion & Recommendations','manual',null,'State conclusions, recommendations and the next action.','','none',true,100),
  ('workshop-report','Workshop Summary','generated','combined','Prepare a concise evidence-based workshop summary.','','summary',true,10),
  ('workshop-report','Purpose & Objectives','linked','activity_details','Present the workshop purpose and objectives.','','summary',true,20),
  ('workshop-report','Participation','linked','participants','Present the participant profile and registration total.','','bars',true,30),
  ('workshop-report','Workshop Delivery','generated','sessions','Summarise delivered workshop sessions.','','table',true,40),
  ('workshop-report','Attendance','linked','attendance','Present workshop attendance clearly.','','bars',false,50),
  ('workshop-report','Feedback & Learning','hybrid','surveys','Combine verified feedback data with the author''s interpretation.','','bars',false,60),
  ('workshop-report','Key Lessons & Next Steps','hybrid','journal','Use recorded lessons and follow-ups to frame next steps.','','summary',true,70),
  ('project-activity-report','Activity Summary','generated','combined','Summarise verified implementation progress and current results.','','summary',true,10),
  ('project-activity-report','Planned Outputs','hybrid','tasks','Relate activity tasks and progress to the planned outputs.','','summary',true,20),
  ('project-activity-report','Implementation Progress','generated','journal','Summarise implementation updates, achievements and follow-up.','','summary',true,30),
  ('project-activity-report','Delivery Schedule','linked','sessions','Present the session or delivery schedule.','','table',false,40),
  ('project-activity-report','Participation & Reach','linked','participants','Present verified participation and reach.','','bars',true,50),
  ('project-activity-report','Budget Performance','linked','budget','Present planned and actual activity expenditure.','','bars',false,60),
  ('project-activity-report','Challenges, Lessons & Actions','hybrid','journal','Connect recorded challenges and lessons to agreed actions.','','summary',true,70),
  ('project-activity-report','Recommendations','manual',null,'Record practical recommendations and accountable next steps.','','none',true,80)
) as s(template_code,title,section_type,source_type,instructions,starter_text,visualization,is_required,position)
  on t.code=s.template_code and t.is_builtin
where not exists (
  select 1 from report_template_sections existing
  where existing.template_id=t.id and existing.position=s.position
);
