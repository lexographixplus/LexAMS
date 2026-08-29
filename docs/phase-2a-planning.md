# LexAMS Phase 2A — Planning Foundation

Phase 2A extends the existing activity workspace with planning tasks, richer session plans, facilitator assignments and preparation progress. It does not create a separate project-management area and does not change existing registration, attendance, certificates, reporting or billing records.

## Architecture decisions

- The existing `activities` record remains the tenant-scoped container.
- Existing `activity_sessions` rows are extended so attendance and planning use the same session identity.
- `activity_tasks` stores activity-scoped work across before, during and after-training stages.
- `session_facilitators` links current organization members to sessions and supports one lead facilitator.
- Planning progress is derived from tasks, session readiness and facilitator coverage; percentages are not stored.
- Existing sessions begin in `draft` planning state and remain fully usable by attendance workflows.

## Permissions

- Owner, Admin and Programme Manager can create and manage tasks, session plans and facilitator assignments.
- Facilitator and M&E Officer can update the status of tasks assigned to them.
- Assigned Facilitators and M&E Officers can update the preparation state of their sessions.
- Viewer access is read-only.
- Every query and mutation verifies both organization and activity ownership on the server.

## Migration and rollout

Migration `011_phase_2a_planning.sql` is additive and backward-compatible. It adds new tables and default-safe session fields without rewriting historical activity data. The production Netlify build applies ordered migrations before building the application.

Recommended release sequence:

1. Run migration validation and the complete automated test suite.
2. Test the migration against a representative Neon branch when branch tooling is available.
3. Review the deploy preview on desktop and mobile.
4. Verify task and session mutations with Owner, Programme Manager, Facilitator and Viewer accounts.
5. Release without changing Free/Pro entitlements; commercial gating remains a later decision.

## Regression checklist

- Existing activity pages render when no tasks or facilitator assignments exist.
- Existing session check-in tokens, windows and attendance continue working.
- Renaming a planned session keeps linked attendance labels consistent.
- Cross-organization activity, task, session and member identifiers are rejected.
- A facilitator cannot change an assigned task’s title, owner, due date or priority.
- Duplicate session titles and sessions outside the activity dates are rejected.
- Mobile users can read the summary and update assigned statuses without horizontal page overflow.
