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
};

function envValue(name: string) {
  return (globalThis as any).Netlify?.env?.get?.(name) || process.env[name];
}

function limit(name: string, fallback: number) {
  const parsed = Number(envValue(name));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// Pro ceilings remain configuration, rather than a promise of "unlimited" use.
// The fallbacks are deliberately generous development defaults and must be approved
// through environment configuration before a production paid launch.
export const PLAN_ENTITLEMENTS: Record<PlanName, EntitlementSet> = {
  free: {
    activeActivities: 2,
    participants: 100,
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
  },
  pro: {
    activeActivities: limit('LEXAMS_PRO_MAX_ACTIVE_ACTIVITIES', 250),
    participants: limit('LEXAMS_PRO_MAX_PARTICIPANTS', 10000),
    teamSeats: limit('LEXAMS_PRO_MAX_TEAM_SEATS', 50),
    surveysPerActivity: limit('LEXAMS_PRO_MAX_SURVEYS_PER_ACTIVITY', 100),
    surveyQuestions: limit('LEXAMS_PRO_MAX_SURVEY_QUESTIONS', 100),
    assessmentsPerActivity: limit('LEXAMS_PRO_MAX_ASSESSMENTS_PER_ACTIVITY', 100),
    assessmentQuestions: limit('LEXAMS_PRO_MAX_ASSESSMENT_QUESTIONS', 200),
    timedAssessments: true,
    csvExport: true,
    customBranding: true,
    monthlyCertificates: limit('LEXAMS_PRO_MAX_MONTHLY_CERTIFICATES', 5000),
    teamCollaboration: true,
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

function effectivePlan(subscription: any): PlanName {
  if (!subscription || subscription.plan !== 'pro') return 'free';
  const now = Date.now();
  const graceEnd = subscription.grace_period_end ? new Date(subscription.grace_period_end).getTime() : 0;
  const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end).getTime() : 0;
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

export async function getBillingSnapshot(db: Queryable, organizationId: string): Promise<BillingSnapshot> {
  await ensureFreeSubscription(db, organizationId);
  const [subscriptionResult, activeActivities, participants, teamSeats, monthlyCertificates] = await Promise.all([
    db.query('select * from organization_subscriptions where organization_id = $1', [organizationId]),
    db.query(`select count(*)::int as count from activities where organization_id = $1 and status in ('Upcoming', 'Ongoing')`, [organizationId]),
    db.query('select count(*)::int as count from participants where organization_id = $1', [organizationId]),
    db.query(`select (select count(*)::int from organization_members where organization_id = $1)
                    + (select count(*)::int from team_invites where organization_id = $1 and status = 'pending') as count`, [organizationId]),
    db.query(`select count(*)::int as count from certificates
              where organization_id = $1 and issued_date >= date_trunc('month', current_date)::date`, [organizationId]),
  ]);

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
      provider: record?.provider || 'manual',
      cancel_at_period_end: Boolean(record?.cancel_at_period_end),
    },
    entitlements: PLAN_ENTITLEMENTS[plan],
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

export function requireAllowance(feature: string, current: number, limitValue: number, code = 'PLAN_LIMIT_REACHED') {
  if (current < limitValue) return;
  throw new PlanLimitError(code, feature, current, limitValue, `Your Free plan has reached its ${feature} limit. Upgrade to Pro to continue.`);
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
    requireAllowance('active activities', snapshot.usage.activeActivities, limits.activeActivities, 'ACTIVITY_LIMIT_REACHED');
  }
  if (table === 'participants') {
    requireAllowance('participants', snapshot.usage.participants, limits.participants, 'PARTICIPANT_LIMIT_REACHED');
  }
  if (table === 'team_invites') {
    requirePro('team collaboration', limits.teamCollaboration);
    requireAllowance('team seats', snapshot.usage.teamSeats, limits.teamSeats, 'TEAM_SEAT_LIMIT_REACHED');
  }
  if (table === 'certificates') {
    requireAllowance('monthly certificates', snapshot.usage.monthlyCertificates, limits.monthlyCertificates, 'CERTIFICATE_LIMIT_REACHED');
  }
  if (table === 'surveys') {
    const result = await db.query('select count(*)::int as count from surveys where organization_id = $1 and activity_id is not distinct from $2', [organizationId, row.activity_id ?? null]);
    requireAllowance('surveys per activity', result.rows[0].count, limits.surveysPerActivity);
  }
  if (table === 'survey_questions') {
    const result = await db.query('select count(*)::int as count from survey_questions where survey_id = $1', [row.survey_id]);
    requireAllowance('survey questions', result.rows[0].count, limits.surveyQuestions);
  }
  if (table === 'assessments') {
    const result = await db.query('select count(*)::int as count from assessments where organization_id = $1 and activity_id is not distinct from $2', [organizationId, row.activity_id ?? null]);
    requireAllowance('assessments per activity', result.rows[0].count, limits.assessmentsPerActivity);
    if (row.time_limit_minutes) requirePro('timed assessments', limits.timedAssessments);
  }
  if (table === 'assessment_questions') {
    const result = await db.query('select count(*)::int as count from assessment_questions where assessment_id = $1', [row.assessment_id]);
    requireAllowance('assessment questions', result.rows[0].count, limits.assessmentQuestions);
  }
}

export async function requirePlatformAdmin(db: Queryable, userId: string) {
  const result = await db.query('select role from platform_administrators where user_id = $1', [userId]);
  return result.rows[0] || null;
}
