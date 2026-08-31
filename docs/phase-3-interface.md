# LexAMS Phase 3 — Interface and experience

Phase 3 is a quality pass over the existing application. It adds no features and
changes no data model, billing rule or permission. It fixes defects found in a
screen-by-screen review, brings the interface up to the accessibility baseline
the product standards already commit to, and begins moving the styling off
inline styles so the product can be maintained without breaking itself.

## What was wrong

The review covered 19 workspace screens and 11 public routes at 1440px and
390px. Seventeen findings were recorded. The ones that drove this work:

- Any address matching no route rendered an empty document.
- Reading the session could throw where nothing was listening, leaving the app
  on its splash screen indefinitely.
- Tertiary text measured 3.69:1 on white against a 4.5:1 minimum, and it was
  the colour applied to most small labels.
- 300 declarations set interface type below 12px, some as small as 7px.
- 17 of 19 workspace screens had no `<h1>`; 21 form fields had no label.
- The dashboard opened with a gradient panel of marketing copy that filled the
  whole first screen on a phone.
- Mobile layout was produced by matching fragments of inline style attributes.

## Stage 1 — Defects

- `src/pages/NotFound.jsx` with catch-all routes for the public site and the
  workspace. The workspace variant renders inside the shell.
- `AuthContext` guards its JSON parse and exposes `sessionError`, which
  `ProtectedRoute` renders as a recoverable screen with a retry.
- `src/lib/useDocumentTitle.js` gives every screen its own tab title. The shell
  supplies a fallback and leaves the title alone on addresses it does not
  recognise, so a not-found screen keeps its own.

## Stage 2 — Accessibility baseline

- `--color-ink-500` moved from `#7A8699` to `#616C7D`: 5.32:1 on white, 5.09:1
  on the page ground, 4.52:1 on the muted surface. Sidebar text on navy moved
  from a low of 3.99:1 to 6.95:1.
- All interface type sits on a 12px floor. Certificate artwork is exempt: it
  renders at fixed dimensions and is then scaled, so its sizes are part of the
  design.
- One `<h1>` per screen, a `main` landmark, a skip link, accessible names on
  icon-only controls, real labels on every form field, and a visible focus ring
  across the workspace. `prefers-reduced-motion` is honoured.

## Stage 3 — Shell, dashboard and states

- The dashboard leads with the workspace name, a line describing what is
  actually true right now, and the two actions people come here to take. The
  figures follow, two-up on a phone.
- "Current operations" shows a single meaningful state when nothing is running
  rather than a column of zeros beside a summary row of real totals.
- The breadcrumb lists a page's ancestors and stops, so it no longer repeats the
  heading below it. An activity reads as its own name.
- Five screens showed a line of grey text while loading. They now show skeletons
  (`src/components/Skeleton.jsx`). The Team screen never stopped loading when a
  profile had no team; it now resolves and surfaces failures with a retry.

## Stage 4 — Styling foundation

Styling is moving out of the components and onto real class names, one screen at
a time. Each conversion deletes that screen's rules from `src/responsive.css` in
the same change, so nothing is left half converted.

- `src/ui.css` holds the shared layer: buttons, fields, tables, pagination,
  drawers, dialogs, skeletons, states, page headings and the breadcrumb.
- `src/pages/participants.css` holds what is specific to that screen.
- Converted so far: the landing page (already class-based, its overrides were
  dead), the sign-in and sign-up pages, Participants, the Activities create
  dialog, and the activity detail header.
- `responsive.css` went from 90 inline-style selectors and 68 `!important`
  rules to 33 and 23. `test/interface-standards.test.js` ratchets those budgets
  so the file can only shrink.
- Typefaces are linked from `index.html` with a preconnect instead of being
  `@import`ed at the top of the stylesheet, so the fetch starts immediately.
- Removed `LandingV2.jsx` and `Communication.jsx`, which nothing referenced, and
  collapsed `Reports.jsx → ReportsPreview.jsx → ReportsV2.jsx` into
  `Reports.jsx` and `ReportsWorkspace.jsx`.
- Participants is now a semantic table with sortable columns, pagination at 25
  rows, keyboard-reachable rows, a drawer that behaves as a dialog, and separate
  first-run and no-results states.

## Still to convert

These screens continue to rely on the inline-style overrides and should be moved
next, in this order: Assessments, Surveys, Certificates, Settings, Team,
Billing, then the public pages. Each conversion should delete the matching rules
from `responsive.css` and lower the budgets in
`test/interface-standards.test.js`.

## Verification

- `npm test` — 45 tests, including contrast, type-floor and override-budget
  guards.
- `npm run build` and the marketing prerender.
- Every workspace and public route checked at 1440px and 390px for horizontal
  overflow, a missing `<h1>`, unlabelled fields and unnamed controls.

## Regression checklist

- An unknown address shows the not-found screen, not a blank page, on both the
  public site and inside the workspace.
- A non-JSON session response produces a retry screen rather than a permanent
  splash.
- Every tab title names its screen.
- No text in the interface renders below 12px.
- The dashboard shows the workspace's own figures above the fold on a phone.
- Participants sorts, pages, and opens its drawer by keyboard; Escape closes it.
- Activities, Assessments, Surveys, Certificates, Settings, Team and Billing
  still lay out correctly at 390px after the override pruning.
