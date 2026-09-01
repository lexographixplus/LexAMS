#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

ADMIN_URL="${POSTGRES_ADMIN_URL:-postgresql://postgres:postgres@127.0.0.1:5432/postgres}"
UPGRADE_DB="lexams_upgrade_ci"
UPGRADE_URL="postgresql://postgres:postgres@127.0.0.1:5432/${UPGRADE_DB}"

mapfile -t MIGRATIONS < <(find db/migrations -maxdepth 1 -type f -name '[0-9][0-9][0-9]_*.sql' | sort)
if [[ ${#MIGRATIONS[@]} -lt 15 ]]; then
  echo "Expected at least 15 ordered migrations; found ${#MIGRATIONS[@]}." >&2
  exit 1
fi
if [[ "$(basename "${MIGRATIONS[-1]}")" != "015_public_rate_limits.sql" ]]; then
  echo "Unexpected latest migration: $(basename "${MIGRATIONS[-1]}")" >&2
  exit 1
fi

echo "Applying complete migration chain to empty database..."
for migration in "${MIGRATIONS[@]}"; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
select 1 from organizations limit 0;
select 1 from activities limit 0;
select 1 from participants limit 0;
select 1 from organization_subscriptions limit 0;
select 1 from public_rate_limits limit 0;
SQL

echo "Testing upgrade from representative pre-release schema/data..."
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "drop database if exists ${UPGRADE_DB};" >/dev/null
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "create database ${UPGRADE_DB};" >/dev/null

for migration in "${MIGRATIONS[@]}"; do
  base="$(basename "$migration")"
  if [[ "$base" > "013_phase_2c_2e_narrative_reporting.sql" ]]; then
    break
  fi
  psql "$UPGRADE_URL" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done

psql "$UPGRADE_URL" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
insert into organizations (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Migration Test Org', 'migration-test-org');

insert into activities (organization_id, title, start_date, end_date)
values ('00000000-0000-0000-0000-000000000001', 'Existing Training', current_date, current_date + 1);

insert into participants (organization_id, name, email)
values ('00000000-0000-0000-0000-000000000001', 'Existing Participant', 'existing@example.test');

insert into registrations (organization_id, activity_id, participant_id)
select '00000000-0000-0000-0000-000000000001', a.id, p.id
from activities a, participants p
where a.organization_id='00000000-0000-0000-0000-000000000001'
  and p.organization_id='00000000-0000-0000-0000-000000000001'
limit 1;
SQL

for migration in "${MIGRATIONS[@]}"; do
  base="$(basename "$migration")"
  if [[ "$base" > "013_phase_2c_2e_narrative_reporting.sql" ]]; then
    psql "$UPGRADE_URL" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
  fi
done

ORG_COUNT="$(psql "$UPGRADE_URL" -Atqc "select count(*) from organizations where slug='migration-test-org'")"
ACTIVITY_COUNT="$(psql "$UPGRADE_URL" -Atqc "select count(*) from activities where title='Existing Training'")"
PARTICIPANT_COUNT="$(psql "$UPGRADE_URL" -Atqc "select count(*) from participants where email='existing@example.test'")"
REGISTRATION_COUNT="$(psql "$UPGRADE_URL" -Atqc "select count(*) from registrations")"
RATE_LIMIT_TABLE="$(psql "$UPGRADE_URL" -Atqc "select to_regclass('public.public_rate_limits') is not null")"
TRIAL_COLUMN="$(psql "$UPGRADE_URL" -Atqc "select exists(select 1 from information_schema.columns where table_name='organization_subscriptions' and column_name='trial_ends_at')")"

[[ "$ORG_COUNT" == "1" ]]
[[ "$ACTIVITY_COUNT" == "1" ]]
[[ "$PARTICIPANT_COUNT" == "1" ]]
[[ "$REGISTRATION_COUNT" == "1" ]]
[[ "$RATE_LIMIT_TABLE" == "t" ]]
[[ "$TRIAL_COLUMN" == "t" ]]

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "drop database if exists ${UPGRADE_DB};" >/dev/null

echo "Database migration smoke tests passed."
