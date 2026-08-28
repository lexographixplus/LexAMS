-- LexAMS Certificate Signatories
-- Reusable organisation signatories, default/template configuration, and
-- immutable signatory snapshots on every newly issued certificate.

create table if not exists organization_signatories (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  full_name text not null,
  title text,
  organization_label text,
  signature_mode text not null default 'typed',
  signature_blob_key text,
  signature_content_type text,
  active boolean not null default true,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_signatories_name_check
    check (nullif(btrim(full_name), '') is not null),
  constraint organization_signatories_mode_check
    check (signature_mode in ('uploaded', 'typed'))
);

create index if not exists organization_signatories_org_active_idx
  on organization_signatories (organization_id, active, lower(full_name));

create table if not exists organization_certificate_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  signatory_config jsonb not null default '[]'::jsonb,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint organization_certificate_settings_signatories_check
    check (
      jsonb_typeof(signatory_config) = 'array'
      and jsonb_array_length(signatory_config) <= 4
    )
);

alter table award_templates
  add column if not exists signatory_config jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'award_templates_signatories_check'
  ) then
    alter table award_templates
      add constraint award_templates_signatories_check
      check (
        jsonb_typeof(signatory_config) = 'array'
        and jsonb_array_length(signatory_config) <= 4
      );
  end if;
end $$;

create or replace function lexams_snapshot_certificate_signatories()
returns trigger
language plpgsql
as $$
declare
  selected_config jsonb := '[]'::jsonb;
  signatory_snapshots jsonb := '[]'::jsonb;
begin
  -- Award templates may override the organisation-wide defaults.
  if new.template_id is not null then
    select coalesce(t.signatory_config, '[]'::jsonb)
      into selected_config
    from award_templates t
    where t.id = new.template_id
      and t.organization_id = new.organization_id;
  end if;

  if selected_config is null or jsonb_array_length(selected_config) = 0 then
    select coalesce(s.signatory_config, '[]'::jsonb)
      into selected_config
    from organization_certificate_settings s
    where s.organization_id = new.organization_id;
  end if;

  selected_config := coalesce(selected_config, '[]'::jsonb);

  if jsonb_array_length(selected_config) > 0 then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'signatory_id', s.id,
          'name', s.full_name,
          'title', coalesce(s.title, ''),
          'organization', coalesce(nullif(btrim(s.organization_label), ''), o.name),
          'signature_mode', s.signature_mode,
          'signature_key', s.signature_blob_key,
          'signature_content_type', s.signature_content_type,
          'show_signature', coalesce((entry.item ->> 'show_signature')::boolean, true),
          'show_name', coalesce((entry.item ->> 'show_name')::boolean, true),
          'show_title', coalesce((entry.item ->> 'show_title')::boolean, true),
          'show_organization', coalesce((entry.item ->> 'show_organization')::boolean, false)
        )
        order by entry.ordinality
      ),
      '[]'::jsonb
    )
      into signatory_snapshots
    from jsonb_array_elements(selected_config) with ordinality as entry(item, ordinality)
    join organization_signatories s
      on s.id = case
        when coalesce(entry.item ->> 'signatory_id', '') ~ '^[0-9]+$'
          then (entry.item ->> 'signatory_id')::bigint
        else null
      end
      and s.organization_id = new.organization_id
      and s.active = true
    join organizations o on o.id = new.organization_id;
  end if;

  -- Trigger runs only on INSERT. Existing certificates are never rewritten,
  -- so later signatory changes cannot alter an already-issued certificate.
  new.metadata := coalesce(new.metadata, '{}'::jsonb)
    || jsonb_build_object('signatories', signatory_snapshots);

  return new;
end;
$$;

drop trigger if exists certificates_snapshot_signatories_before_insert on certificates;
create trigger certificates_snapshot_signatories_before_insert
before insert on certificates
for each row
execute function lexams_snapshot_certificate_signatories();
