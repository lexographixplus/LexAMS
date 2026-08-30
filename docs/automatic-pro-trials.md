# Automatic 30-day Pro trials

Every newly created LexAMS workspace receives 30 days of Pro access without a
card. Existing workspaces are not retroactively changed.

## Lifecycle

1. The first authenticated request for a new signup creates the workspace and a
   `pro / trialing` organisation subscription.
2. `trial_started_at` and `trial_ends_at` record the fixed trial window. The API
   calculates the remaining calendar-day count by rounding a partial day up.
3. Trial users receive the normal Pro entitlement set. The interface labels the
   workspace as a Pro trial and shows the days remaining in the app shell and
   billing page.
4. The hourly billing lifecycle moves an expired trial directly to
   `free / active`. It records a billing event and does not delete workspace
   data. Paid subscriptions retain their existing seven-day grace behaviour.
5. If an organisation pays during a trial, its paid month or year begins at the
   trial end. The workspace becomes a normal active Pro subscription as soon as
   payment is verified.

## Preview review

Deploy previews remain synthetic and read-only. Add `?trial=12` to an app URL
to display a Pro trial with 12 days left. Omit the query parameter to use the
normal synthetic active-Pro state.
