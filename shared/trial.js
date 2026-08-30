export const PRO_TRIAL_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function trialDaysRemaining(trialEndsAt, now = Date.now()) {
  const end = new Date(trialEndsAt || '').getTime();
  const current = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(end) || !Number.isFinite(current) || end <= current) return 0;
  return Math.ceil((end - current) / DAY_MS);
}

export function isTrialingSubscription(subscription, now = Date.now()) {
  return subscription?.plan === 'pro'
    && subscription?.status === 'trialing'
    && trialDaysRemaining(subscription.trial_ends_at || subscription.current_period_end, now) > 0;
}

export function trialDaysLabel(days) {
  const remaining = Math.max(0, Number(days) || 0);
  return `${remaining} day${remaining === 1 ? '' : 's'} left`;
}
