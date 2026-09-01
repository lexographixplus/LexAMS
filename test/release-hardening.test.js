import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('billing checkout is restricted to workspace owners and admins', async () => {
  const checkout = await source('netlify/functions/billing-checkout.ts');
  assert.match(checkout, /\['owner', 'admin'\]\.includes/);
  assert.match(checkout, /BILLING_ROLE_REQUIRED/);
  assert.match(checkout, /status: 403/);
});

test('public registration and check-in share an edge rate limit', async () => {
  const limiter = await source('netlify/edge-functions/public-api-rate-limit.js');
  assert.match(limiter, /public-registration/);
  assert.match(limiter, /public-checkin/);
  assert.match(limiter, /windowLimit:\s*120/);
  assert.match(limiter, /aggregateBy:\s*\['ip', 'domain'\]/);
});

test('contact submissions use persistent rate limiting', async () => {
  const contact = await source('netlify/functions/contact.ts');
  const helper = await source('netlify/functions/_shared/rate-limit.ts');
  assert.match(contact, /consumePublicRateLimit/);
  assert.match(contact, /status: 429/);
  assert.match(helper, /sha256/);
  assert.match(helper, /public_rate_limits/);
});

test('migration baseline cannot silently expand with new migrations', async () => {
  const migrate = await source('scripts/migrate-neon.mjs');
  assert.match(migrate, /LEGACY_BASELINE_LAST = '013_phase_2c_2e_narrative_reporting\.sql'/);
  assert.doesNotMatch(migrate, /migrations\.slice\(0, -1\)/);
});

test('release CI includes upgrade-path, audit, browser smoke and security scanning', async () => {
  const ci = await source('.github/workflows/lexams-v2-ci.yml');
  const smoke = await source('scripts/ci-db-smoke.sh');
  const browserSmoke = await source('scripts/browser-smoke.sh');
  const codeql = await source('.github/workflows/codeql.yml');
  const dependabot = await source('.github/dependabot.yml');
  assert.match(ci, /npm run db:smoke/);
  assert.match(ci, /npm audit --audit-level=high/);
  assert.match(ci, /npm run browser:smoke/);
  assert.match(smoke, /Existing Training/);
  assert.match(smoke, /015_public_rate_limits\.sql/);
  assert.match(browserSmoke, /assert_app_page "\/app" "dashboard"/);
  assert.match(browserSmoke, /assert_app_page "\/app\/billing" "billing"/);
  assert.match(codeql, /github\/codeql-action\/analyze@v(?:3|4)/);
  assert.match(dependabot, /package-ecosystem: "npm"/);
});
