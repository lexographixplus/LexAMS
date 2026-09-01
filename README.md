# LexAMS

LexAMS is a training and activity management platform by LexoGraphix Plus. It brings planning, participants, registration, attendance, learning and feedback, certificates, communications, reporting, budgets, implementation journals and subscription management into one organisation-scoped workspace.

## Stack

- React + Vite
- Netlify Functions and Edge Functions
- Neon Postgres
- Auth.js
- Resend
- Modem Pay

## Local development

```bash
npm ci
cp .env.example .env
npm run dev
```

For function/API work, use Netlify Dev with the required server-side environment variables configured locally:

```bash
npm run netlify:dev
```

Never commit `.env` files or production secrets.

## Quality gates

```bash
npm run db:validate
npm test
npm run lint
npm run build
```

CI also runs a PostgreSQL-backed migration smoke test and `npm audit --audit-level=high`.

### Database migration smoke test

`npm run db:smoke` requires a PostgreSQL database and `psql`. CI provides these automatically. It performs two checks:

1. applies the complete ordered migration chain to an empty database;
2. builds a representative pre-release database through migration 013, seeds existing organisation/activity/participant/registration data, applies later migrations, and verifies the existing records survive.

This is the release gate for additive/backward-compatible schema work.

## Database migrations

Migrations live in `db/migrations` and must remain sequential (`001_...`, `002_...`, etc.).

Production migrations are applied with:

```bash
npm run db:migrate
```

Rules:

- never edit an already-applied migration;
- add a new migration instead;
- keep migrations additive and backward-compatible where possible;
- run `npm run db:smoke` before release;
- take/confirm a recoverable Neon branch or point-in-time recovery position before consequential production schema work.

The legacy migration ledger baseline is deliberately pinned through migration 013. New migrations are never silently inferred as historical.

## Authentication and permissions

LexAMS is organisation-scoped. API mutation paths must enforce both tenant ownership and role permissions server-side.

Billing checkout is restricted to `owner` and `admin` roles. UI hiding alone is not considered sufficient authorization.

## Public endpoint protection

Public registration and public check-in are protected by a Netlify edge rate limit aggregated by client IP and domain. The contact form additionally uses a persistent PostgreSQL fixed-window counter; raw IP addresses are not stored, only SHA-256 client keys. Expired counters are removed by a scheduled maintenance function.

When changing public routes, review the throttling configuration as part of the security checklist.

## Billing

Modem Pay checkout creates a LexAMS invoice first. The signed webhook is authoritative for activating Pro access. Successful payments are matched against the LexAMS invoice amount/currency and processed idempotently.

Billing documents and receipts exist, but formal LexoGraphix Plus legal/business details are intentionally deferred until verified. Do not add placeholder registration, tax/TIN, telephone, or legal address information.

## Email

Resend handles operational email. Delivery events are verified through the Resend webhook and tracked in LexAMS. Bounce/complaint suppression is persisted per organisation.

Required production variables are documented in `.env.example`.

## Security automation

GitHub automation includes:

- CI tests, lint and build;
- full-chain and upgrade-path database migration tests;
- high-severity npm dependency audit;
- CodeQL JavaScript/TypeScript analysis;
- Dependabot for npm and GitHub Actions.

`main` should remain protected and changes should normally arrive through pull requests.

## Release checklist

Before a production release:

1. confirm CI and CodeQL are green;
2. confirm migrations pass the empty-database and representative-upgrade smoke tests;
3. verify the Netlify deploy preview and key public flows;
4. verify owner/admin billing checkout permissions;
5. verify Modem Pay signed webhook processing using a test payment when billing code changed;
6. verify Resend delivery/webhook handling when communication code changed;
7. confirm required Netlify production environment variables are present;
8. confirm Neon recovery/branch readiness for schema changes;
9. merge only after review, then verify the production deploy and scheduled functions.

## Recovery guidance

If a release fails before a database migration, roll back/promote the last known-good Netlify deploy. If schema changes have already been applied, do not blindly reverse them: use the documented forward-fix strategy for that migration or restore from the verified Neon recovery point/branch when necessary. Never delete customer or Phase 2 data merely to downgrade a plan or recover a deployment.

## Repository policy

LexAMS is proprietary LexoGraphix Plus product source. The GitHub repository should be private. Do not publish source, secrets, production data, client information, or internal operational records.
