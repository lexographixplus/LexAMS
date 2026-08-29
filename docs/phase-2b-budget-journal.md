# Phase 2B — Budget, implementation journal and multi-week planning

## Scope delivered

Phase 2B extends the activity-first Planning workspace with:

- lightweight planned-versus-actual budget tracking;
- category totals, variance, budget-used percentage and unplanned-spend visibility;
- daily and weekly implementation journal entries;
- journal links to activity sessions and tasks;
- report-relevant and follow-up states for later narrative reporting;
- an activity overview pulse for planning, budget and implementation status;
- activity-week navigation and seven-day schedule views for programmes longer than one week;
- CSV import for sessions and facilitator assignments with preview, mapping and server-side validation.

This remains training operations functionality. It does not introduce ledger, reconciliation, payroll or general project-management behaviour.

## CSV format

The downloadable template supports:

- `session_title` (required)
- `date` (required and within the activity dates)
- `start_time`
- `end_time`
- `venue`
- `objectives`
- `outline`
- `planning_status` (`draft`, `ready`, `delivered`, or `cancelled`)
- `lead_facilitator_email`
- `facilitator_emails` (multiple addresses separated with semicolons)

Users map spreadsheet headers before import. A batch is limited to 200 rows. Every row must validate before anything is written, and facilitator addresses must belong to active, non-viewer workspace members. Existing session titles can be skipped or updated.

## Permissions

- Owner, admin and programme manager: manage tasks, sessions, facilitator assignments, CSV imports and budgets.
- Facilitator and M&E officer: update assigned task/session status and create journal entries.
- Journal contributors may edit/delete their own entries; planning managers may manage every entry.
- Viewer: read-only.
- Every API query and mutation validates organisation and activity scope.

## Data and migration

Migration `012_phase_2b_budget_journal.sql` is additive and default-safe. It adds:

- activity budget currency;
- `activity_budget_items`;
- `activity_journal_entries`;
- tenant-safe journal-to-session and journal-to-task link tables;
- supporting composite and lookup indexes.

Planned and actual amounts remain nullable so “not entered” is distinct from zero. Supporting evidence uses an optional HTTPS link in this checkpoint; a general-purpose activity attachment store should be designed separately before accepting arbitrary uploads.

## Rollback / forward-fix strategy

The application remains compatible with activities that have no Phase 2B records. If release issues occur, the UI/API changes can be rolled back while the additive tables remain dormant. A later forward-fix can amend constraints or indexes without rewriting existing activity, participant, attendance, certificate or reporting data.

## Verification targets

- budget calculations reconcile across item and category totals;
- blank planned amounts are surfaced as unplanned spend rather than zero-budget errors;
- daily/weekly journal validation and contributor ownership rules pass;
- linked session/task IDs cannot cross activity or tenant boundaries;
- CSV parsing handles quoted cells and multi-facilitator rows;
- long activities split into stable seven-day planning windows;
- production build, function bundle, migration sequence and responsive preview pass.
