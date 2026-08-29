# LexAMS Phase 2C–2E — Living narrative reporting

## Scope delivered

Phases 2C–2E add an activity-first reporting workspace that grows alongside delivery rather than being assembled from scratch at the end. The release includes:

- reusable organisation templates with ordered manual, linked, generated and hybrid sections;
- built-in Training Report, Workshop Report and Project Activity Report structures;
- report instances with explicit completion, review, approval and archive states;
- live sections linked to activity details, planning tasks, sessions, facilitators, participants, attendance, budget, implementation journal, surveys, assessments and certificates;
- evidence-grounded first drafts with source snapshots, stable hashes, generation versions and timestamps;
- protected user-edited and approved writing, plus Review, Refresh and Keep Existing actions when source records change;
- accessible metric cards, labelled charts and responsive tables;
- branded on-screen preview and isolated print/PDF output that excludes the surrounding application page;
- an overview pulse that makes report progress and stale sections visible from the activity summary.

## Reporting model

Migration `013_phase_2c_2e_narrative_reporting.sql` is additive and tenant-safe. It creates:

- `report_templates` and `report_template_sections` for reusable structures;
- `activity_reports` and `activity_report_sections` for activity-specific report instances;
- `report_section_references` for auditable evidence snapshots.

Built-in templates have no organisation owner and are read-only. Organisation templates may be created, duplicated, edited, reordered and removed by an owner or admin. Creating a report copies its template sections so later template changes cannot silently rewrite an existing report.

## Generation and evidence safety

The generation service has an adapter boundary and currently enables only the local `deterministic` provider (`deterministic-v1`). It creates concise prose from the supplied source bundle, preserves recorded figures and returns a clear missing-data statement when evidence is insufficient.

No paid AI service, external prompt, general web source or model credential is introduced in this phase. A future provider can be added behind the adapter only after Operations Lead approval and must retain the same source-grounding, audit and replacement protections.

For each generated or hybrid section, LexAMS stores the source type, canonical source hash, source snapshot, generation version and timestamp. If the live hash changes later, the current narrative remains untouched and is marked for review. Refreshing protected writing requires explicit confirmation. Keeping existing text acknowledges the current evidence without altering the prose.

## Permissions

- Owner and admin: manage templates; create, edit, generate and approve reports.
- Programme manager and M&E officer: create, edit, generate and approve activity reports.
- Facilitator and viewer: read report content.
- Deploy previews: synthetic read-only data; no mutation reaches Neon.
- Every API query and mutation verifies both organisation and activity scope.

## Print, mobile and accessibility

The report document uses organisation name, logo and brand colours where available. Print/PDF temporarily isolates the report document, sets an A4 document layout and restores the browser title and page state after printing. On smaller screens the editor becomes a single-column flow, the outline remains readable, controls wrap, and data tables retain a contained horizontal scroll.

Charts include visible numeric labels rather than relying on colour alone. Buttons and status controls have accessible names, semantic headings remain ordered, tables use headers and all source states provide text equivalents.

## Rollout and rollback

The migration is forward-only and safe for organisations with no reports. Existing activity, registration, attendance, certificate, planning, budget and journal records are not rewritten. If application code must be rolled back, the new tables can remain dormant; follow-up schema corrections should use another additive migration.

Recommended rollout:

1. Validate all ordered migrations and bundle the reporting function.
2. Run the complete test and production-build suites.
3. Inspect the read-only deploy preview on desktop and mobile.
4. Apply the migration to a representative Neon branch and exercise the permission matrix.
5. Confirm print/PDF output in Chrome, Edge and a mobile browser before production promotion.

## Regression checklist

- Activities without report records still open normally and show a report start state.
- Template changes never alter existing report structures.
- Linked source records cannot cross organisation or activity boundaries.
- Deterministic output preserves exact attendance, budget, learning and participant figures.
- User-edited or approved writing is never silently overwritten.
- A changed source hash produces a visible review state and preserves the previous snapshot.
- Approving or editing a section moves an approved report back to review when appropriate.
- Report printing excludes navigation, dialogs and the surrounding application page.
- Existing planning, communications, participant recognition and certificate workflows continue to pass their regression tests.
