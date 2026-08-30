import { phaseTwoEntitlements } from '../../../shared/commercial.js';
import { PRO_TRIAL_DAYS, trialDaysRemaining } from '../../../shared/trial.js';

type Queryable = { query: (...args: any[]) => Promise<any> };

export type PlanName = 'free' | 'pro';

type EntitlementSet = {
  activeActivities: number;
  participants: number;
  teamSeats: number;
  surveysPerActivity: number;
  surveyQuestions: number;
  assessmentsPerActivity: number;
  assessmentQuestions: number;
  timedAssessments: boolean;
  csvExport: boolean;
  customBranding: boolean;
  monthlyCertificates: number;
  teamCollaboration: boolean;
  sessionCsvImport: boolean;
  reportsPerActivity: number;
  customReportTemplates: boolean;
  narrativeGeneration: boolean;
  reportApprovals: boolean;
  reportStructureEditing: boolean;
};

function envValue(name: string) {
  return (globalThis as any).Netlify?.env?.get?.(name) || process.env[name];
}

function limit(name: string, fallback: number) {
  const parsed = Number(envValue(name));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// Pro ceilings are explicit launch limits rather than an "unlimited" promise.
// Netlify environment values should match these public limits in production.
export const PLAN_ENTITLEMENTS: Record<PlanName, EntitlementSet> = {
  free: {
    activeActivities: 2,
    participants: 50,
    teamSeats: 1,
    surveysPerActivity: 1,
    surveyQuestions: 5,
    assessmentsPerActivity: 1,
    assessmentQuestions: 10,
    timedAssessments: false,
    csvExport: false,
    customBranding: false,
    monthlyCertificates: 5,
    teamCollaboration: false,
    ...phaseTwoEntitlements('free'),
  },
  pro: {
    activeActivities: limit('LEXAMS_PRO_MAX_ACTIVE_ACTIVITIES', 100),
    participants: limit('LEXAMS_PRO_MAX_PARTICIPANTS', 5000),
    teamSeats: limit('LEXAMS_PRO_MAX_TEAM_SEATS', 20),
    surveysPerActivity: limit('LEXAMS_PRO_MAX_SURVEYS_PER_ACTIVITY', 25),
    surveyQuestions: limit('LEXAMS_PRO_MAX_SURVEY_QUESTIONS', 50),
    assessmentsPerActivity: limit('LEXAMS_PRO_MAX_ASSESSMENTS_PER_ACTIVITY', 25),
    assessmentQuestions: limit('LEXAMS_PRO_MAX_ASSESSMENT_QUESTIONS', 100),
    timedAssessments: true,
    csvExport: true,
    customBranding: true,
    monthlyCertificates: limit('LEXAMS_PRO_MAX_MONTHLY_CERTIFICATES', 1000),
    teamCollaboration: true,
    ...phaseTwoEntitlements('pro'),
  },
};

export type BillingSnapshot = {
  subscription: {
    id: string | null;
    plan: PlanName;
    status: string;
    billing_cycle: 'monthly' | 'annual' | null;
    current_period_start: string | null;
    current_period_end: string | null;
    grace_period_end: string | null;
    trial_started_at: string | null;
    trial_ends_at: string | null;
    trial_days_remaining: number | null;
    provider: string;
    cancel_at_period_end: boolean;
  };
  entitlements: EntitlementSet;
  usage: {
    activeActivities: number;
    participants: number;
    teamSeats: number;
    monthlyCertificates: number;
  };
};

export type PlanAccess = Pick<BillingSnapshot, 'subscription' | 'entitlements'>;

function effectivePlan(subscription: any): PlanName {
  if (!subscription || subscription.plan !== 'pro') return 'free';
  const now = Date.now();
  const graceEnd = subscription.grace_period_end ? new Date(subscription.grace_period_end).getTime() : 0;
  const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end).getTime() : 0;
  const trialEnd = subscription.trial_ends_at ? new Date(subscription.trial_ends_at).getTime() : periodEnd;
  if (subscription.status === 'trialing' && trialEnd > now) return 'pro';
  if (subscription.status === 'active' && (!periodEnd || periodEnd >= now)) return 'pro';
  if (subscription.status === 'grace' && graceEnd >= now) return 'pro';
  return 'free';
}

export async function ensureFreeSubscription(db: Queryable, organizationId: string) {
  await db.query(
    `insert into organization_subscriptions (organization_id, plan, status, provider)
     values ($1, 'free', 'active', 'manual')
     on conflict (organization_id) do nothing`,
    [organizationId]
  );
}

export async function startProTrial(db: Queryable, organizationId: string) {
  const result = await db.query(
    `insert into organization_subscriptions (
       organization_id, plan, status, provider, current_period_start, current_period_end,
       trial_started_at, trial_ends_at
     ) values (
       $1, 'pro', 'trialing', 'manual', now(), now() + ($2 || ' days')::interval,
       now(), now() + ($2 || ' days')::interval
     )
     on conflict (organization_id) do nothing
     returning id, trial_ends_at`,
    [organizationId, PRO_TRIAL_DAYS]
  );

  if (result.rowCount) {
    await db.query(
      `insert into billing_events (provider, event_type, processing_status, payload, processed_at)
       values ('manual', 'subscription.trial_started', 'processed', $1::jsonb, now())`,
      [JSON.stringify({
        organization_id: organizationId,
        subscription_id: result.rows[0].id,
        trial_days: PRO_TRIAL_DAYS,
        trial_ends_at: result.rows[0].trial_ends_at,
      })]
    );
  }

  return result.rows[0] || null;
}

export async function getPlanAccess(db: Queryable, organizationId: string): Promise<PlanAccess> {
  await ensureFreeSubscription(db, organizationId);
  const subscriptionResult = await db.query('select * from organization_subscriptions where organization_id = $1', [organizationId]);
  const record = subscriptionResult.rows[0] || null;
  const plan = effectivePlan(record);
  const status = plan === 'free' && record?.plan === 'pro' && !['cancelled', 'expired'].includes(record.status)
    ? 'expired'
    : (record?.status || 'active');

  return {
    subscription: {
      id: record?.id || null,
      plan,
      status,
      billing_cycle: record?.billing_cycle || null,
      current_period_start: record?.current_period_start || null,
      current_period_end: record?.current_period_end || null,
      grace_period_end: record?.grace_period_end || null,
      trial_started_at: record?.trial_started_at || null,
      trial_ends_at: record?.trial_ends_at || null,
      trial_days_remaining: record?.status === 'trialing'
        ? trialDaysRemaining(record.trial_ends_at || record.current_period_end)
        : null,
      provider: record?.provider || 'manual',
      cancel_at_period_end: Boolean(record?.cancel_at_period_end),
    },
    entitlements: PLAN_ENTITLEMENTS[plan],
  };
}

export async function getBillingSnapshot(db: Queryable, organizationId: string): Promise<BillingSnapshot> {
  const [access, activeActivities, participants, teamSeats, monthlyCertificates] = await Promise.all([
    getPlanAccess(db, organizationId),
    db.query(`select count(*)::int as count from activities where organization_id = $1 and status in ('Upcoming', 'Ongoing')`, [organizationId]),
    db.query('select count(*)::int as count from participants where organization_id = $1', [organizationId]),
    db.query(`select (select count(*)::int from organization_members where organization_id = $1)
                    + (select count(*)::int from team_invites where organization_id = $1 and status = 'pending') as count`, [organizationId]),
    db.query(`select count(*)::int as count from certificates
              where organization_id = $1 and issued_date >= date_trunc('month', current_date)::date`, [organizationId]),
  ]);

  return {
    ...access,
    usage: {
      activeActivities: activeActivities.rows[0].count,
      participants: participants.rows[0].count,
      teamSeats: teamSeats.rows[0].count,
      monthlyCertificates: monthlyCertificates.rows[0].count,
    },
  };
}

export class PlanLimitError extends Error {
  code: string;
  feature: string;
  current: number | boolean;
  limit: number | boolean;

  constructor(code: string, feature: string, current: number | boolean, limit: number | boolean, message: string) {
    super(message);
    this.code = code;
    this.feature = feature;
    this.current = current;
    this.limit = limit;
  }

  toResponse() {
    return { error: this.message, code: this.code, feature: this.feature, current: this.current, limit: this.limit };
  }
}

export function requireAllowance(feature: string, current: number, limitValue: number, code = 'PLAN_LIMIT_REACHED', plan: PlanName = 'free') {
  if (current < limitValue) return;
  const planLabel = plan === 'pro' ? 'Your Pro plan' : 'Your Free plan';
  throw new PlanLimitError(code, feature, current, limitValue, `${planLabel} has reached its ${feature} limit.${plan === 'free' ? ' Upgrade to Pro to continue.' : ' Contact LexAMS support if you need more capacity.'}`);
}

export function requirePro(feature: string, allowed: boolean) {
  if (allowed) return;
  throw new PlanLimitError('PRO_REQUIRED', feature, false, true, `${feature} is available on LexAMS Pro.`);
}

export async function assertCreationEntitlement(
  db: Queryable,
  organizationId: string,
  table: string,
  row: Record<string, any>,
) {
  const snapshot = await getBillingSnapshot(db, organizationId);
  const limits = snapshot.entitlements;

  if (table === 'activities' && ['Upcoming', 'Ongoing'].includes(row.status || 'Upcoming')) {
    requireAllowance('active activities', snapshot.usage.activeActivities, limits.activeActivities, 'ACTIVITY_LIMIT_REACHED', snapshot.subscription.plan);
  }
  if (table === 'participants') {
    requireAllowance('participants', snapshot.usage.participants, limits.participants, 'PARTICIPANT_LIMIT_REACHED', snapshot.subscription.plan);
  }
  if (table === 'team_invites') {
    requirePro('team collaboration', limits.teamCollaboration);
    requireAllowance('team seats', snapshot.usage.teamSeats, limits.teamSeats, 'TEAM_SEAT_LIMIT_REACHED', snapshot.subscription.plan);
  }
  if (table === 'certificates') {
    requireAllowance('monthly certificates', snapshot.usage.monthlyCertificates, limits.monthlyCertificates, 'CERTIFICATE_LIMIT_REACHED', snapshot.subscription.plan);
  }
  if (table === 'surveys') {
    const result = await db.query('select count(*)::int as count from surveys where organization_id = $1 and activity_id is not distinct from $2', [organizationId, row.activity_id ?? null]);
    requireAllowance('surveys per activity', result.rows[0].count, limits.surveysPerActivity, undefined, snapshot.subscription.plan);
  }
  if (table === 'survey_questions') {
    const result = await db.query('select count(*)::int as count from survey_questions where survey_id = $1', [row.survey_id]);
    requireAllowance('survey questions', result.rows[0].count, limits.surveyQuestions, undefined, snapshot.subscription.plan);
  }
  if (table === 'assessments') {
    const result = await db.query('select count(*)::int as count from assessments where organization_id = $1 and activity_id is not distinct from $2', [organizationId, row.activity_id ?? null]);
    requireAllowance('assessments per activity', result.rows[0].count, limits.assessmentsPerActivity, undefined, snapshot.subscription.plan);
    if (row.time_limit_minutes) requirePro('timed assessments', limits.timedAssessments);
  }
  if (table === 'assessment_questions') {
    const result = await db.query('select count(*)::int as count from assessment_questions where assessment_id = $1', [row.assessment_id]);
    requireAllowance('assessment questions', result.rows[0].count, limits.assessmentQuestions, undefined, snapshot.subscription.plan);
  }
}

export async function requirePlatformAdmin(db: Queryable, userId: string) {
  const result = await db.query('select role from platform_administrators where user_id = $1', [userId]);
  return result.rows[0] || null;
}
