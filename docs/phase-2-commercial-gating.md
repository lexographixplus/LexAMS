# Phase 2 commercial gating

Phase 2 uses one shared entitlement model in `shared/commercial.js`. The same
values drive the Netlify Functions and the React interface so that a hidden or
disabled control is always backed by server-side enforcement.

## Plan matrix

| Capability | Free | Pro |
| --- | --- | --- |
| Manual tasks, sessions, weekly views, budgets, and journals | Included | Included |
| Session and facilitator CSV import | Locked | Included |
| Non-archived reports per activity | 1 | 25 |
| Built-in report templates | Included | Included |
| Custom templates and report structures | Read-only after downgrade | Included |
| Manual report narrative editing | Included for draft reports | Included |
| Grounded narrative generation | Locked | Included |
| Report review and approval | Read-only after downgrade | Included |
| Basic print/PDF output | Included | Included |

The existing organisation limits remain unchanged: Free includes 50
participants, two active activities, one seat, and five certificate issues per
month. Pro retains the higher limits already defined in the billing service.

## Downgrade behaviour

- Existing data is never deleted or hidden.
- Existing custom templates remain readable, but cannot be changed or copied.
- Reports already in review or approved remain readable and printable, but are
  frozen until Pro is restored.
- An archived report does not count against the Free one-report limit.
- Usage meters warn at 80% and show a limit-reached state at 100%.
- Locked controls remain visible and link to a checkout page that explains the
  relevant Pro capability.

## Enforcement points

- `netlify/functions/activity-planning.ts` enforces CSV-import access.
- `netlify/functions/activity-reports.ts` enforces report counts, template and
  structure changes, narrative generation, and review/approval workflows.
- Report creation rechecks the active report count inside a transaction after
  locking the activity, preventing concurrent requests from bypassing the cap.
- `netlify/functions/_shared/billing.ts` supplies the effective plan and shared
  entitlements, including grace-period and expiry handling.

## Preview review

Deploy previews use Pro by default. Add `?plan=free` to a planning or reporting
preview URL to exercise the Free experience without changing production billing
data. This query-only simulation is limited to preview demo data; production API
responses always use the organisation's effective billing plan.
