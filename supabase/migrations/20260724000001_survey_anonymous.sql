alter table public.surveys
  add column allow_anonymous boolean not null default false;
