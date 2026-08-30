import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, CreditCard, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isTrialingSubscription, trialDaysLabel, trialDaysRemaining } from '../../shared/trial.js';

const plans = {
  annual: { label: 'Annual', amount: 10000, detail: 'GMD 833/month equivalent · Save 17%', period: '12 months of Pro access' },
  monthly: { label: 'Monthly', amount: 1000, detail: 'Flexible monthly access', period: '1 month of Pro access' },
};

const featureReasons = {
  'session-import': 'Import sessions and facilitator assignments from CSV instead of entering the schedule manually.',
  'living-reporting': 'Create multiple reports with custom structures, grounded narrative drafts and approval workflows.',
  'custom-report-templates': 'Create and reuse organisation-specific report templates.',
  'multiple-activity-reports': 'Create more than one report for the same activity.',
  'custom-report-structures': 'Add, remove and reorder sections for a tailored report structure.',
  'narrative-generation': 'Generate and refresh evidence-grounded narrative drafts from verified activity records.',
  'report-approvals': 'Move reports through review and protect approved writing.',
};

export default function BillingCheckout() {
  const { billing } = useAuth();
  const [params, setParams] = useSearchParams();
  const initialCycle = params.get('cycle') === 'monthly' ? 'monthly' : 'annual';
  const [cycle, setCycle] = useState(initialCycle);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const plan = plans[cycle];
  const requestedFeature = params.get('feature');
  const featureReason = featureReasons[requestedFeature] || '';
  const isTrialing = isTrialingSubscription(billing?.subscription);
  const trialDays = billing?.subscription?.trial_days_remaining
    ?? trialDaysRemaining(billing?.subscription?.trial_ends_at || billing?.subscription?.current_period_end);

  function chooseCycle(nextCycle) {
    setCycle(nextCycle);
    const next = new URLSearchParams(params);
    next.set('cycle', nextCycle);
    setParams(next, { replace: true });
  }

  async function continueToPayment() {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingCycle: cycle }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || 'Could not start checkout.');
      window.location.assign(data.checkoutUrl);
    } catch (checkoutError) {
      setError(checkoutError.message || 'Could not start checkout.');
      setSubmitting(false);
    }
  }

  return <div style={shell}>
    <div style={topbar}>
      <Link to="/app/billing" style={backLink}><ArrowLeft size={16} />Back to billing</Link>
      <div style={brand}>Lex<span style={{ color: '#FAB72D' }}>AMS</span></div>
      <div style={secureMark}><LockKeyhole size={14} />Secure checkout</div>
    </div>
    <main className="billing-checkout-main" style={main}>
      <section style={checkoutCard}>
        <div style={intro}><div style={eyebrow}><Sparkles size={14} />LEXAMS PRO</div><h1 style={title}>{isTrialing ? 'Keep Pro after your trial.' : 'Upgrade with confidence.'}</h1><p style={subtitle}>{isTrialing ? `Your trial has ${trialDaysLabel(trialDays)}. Choose a plan now and your paid access period will begin after the trial ends.` : 'Choose your plan, review the total, then complete payment securely with Modem Pay.'}</p></div>
        {featureReason && <div style={featureContext}><Sparkles size={17}/><div><strong style={{ display: 'block' }}>Unlock this workflow</strong><span style={{ display: 'block', marginTop: 2 }}>{featureReason}</span></div></div>}
        <div style={planPicker}>
          {Object.entries(plans).map(([key, item]) => <button key={key} onClick={() => chooseCycle(key)} style={{ ...planOption, ...(cycle === key ? selectedPlanOption : {}) }}>
            <span style={{ ...radio, borderColor: cycle === key ? '#FAB72D' : '#7890a4' }}><span style={cycle === key ? radioDot : undefined} /></span>
            <span style={{ textAlign: 'left', flex: 1 }}><strong style={{ display: 'block', fontSize: 14, color: '#072c54' }}>{item.label}</strong><small style={{ display: 'block', marginTop: 3, color: '#5e7084' }}>{item.detail}</small></span>
            <strong style={{ fontSize: 14, color: '#072c54' }}>GMD {item.amount.toLocaleString()}</strong>
          </button>)}
        </div>
        <div style={summary}>
          <div style={summaryRow}><span>LexAMS Pro · {plan.label}</span><strong>GMD {plan.amount.toLocaleString()}</strong></div>
          <div style={summaryRow}><span>Access period</span><span>{plan.period}</span></div>
          {isTrialing && <div style={summaryRow}><span>Paid period begins</span><span>After your Pro trial</span></div>}
          <div style={totalRow}><span>Total due today</span><strong>GMD {plan.amount.toLocaleString()}</strong></div>
        </div>
        {error && <div role="alert" style={errorBox}>{error}</div>}
        <button onClick={continueToPayment} disabled={submitting} style={{ ...payButton, opacity: submitting ? .7 : 1 }}><CreditCard size={17} />{submitting ? 'Opening secure payment…' : 'Continue to secure payment'}</button>
        <p style={paymentNote}><LockKeyhole size={14} />You will complete payment on Modem Pay’s secure payment page. LexAMS confirms access only after payment verification.</p>
      </section>
      <aside style={benefitCard}><div style={benefitIcon}><ShieldCheck size={22} /></div><h2 style={benefitTitle}>What Pro unlocks</h2><ul style={benefitList}><li><Check size={15} />Team collaboration and roles</li><li><Check size={15} />Higher programme capacity</li><li><Check size={15} />Session and facilitator CSV import</li><li><Check size={15} />Custom templates and multiple reports</li><li><Check size={15} />Grounded narrative generation and approvals</li><li><Check size={15} />Professional branded outputs and exports</li></ul><div style={receiptNote}>A branded receipt is sent after your payment is confirmed.</div></aside>
    </main>
  </div>;
}

const shell = { minHeight: '100%', background: 'linear-gradient(135deg, #f4f8fb 0%, #eef3f8 48%, #fff8e9 100%)', padding: '24px clamp(16px, 4vw, 56px) 48px' };
const topbar = { maxWidth: 1010, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16 };
const backLink = { display: 'inline-flex', alignItems: 'center', gap: 7, color: '#33516d', fontSize: 13, fontWeight: 700, textDecoration: 'none' };
const brand = { fontFamily: 'var(--font-display)', color: '#002B54', fontSize: 21, fontWeight: 800, letterSpacing: '-.04em' };
const secureMark = { justifySelf: 'end', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#527087', fontSize: 12, fontWeight: 700 };
const main = { maxWidth: 1010, margin: '36px auto 0', display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(260px, .65fr)', gap: 24, alignItems: 'start' };
const checkoutCard = { background: '#fff', border: '1px solid #dce6ee', borderRadius: 20, boxShadow: '0 18px 48px rgba(0,43,84,.12)', padding: 'clamp(24px, 5vw, 42px)' };
const intro = { maxWidth: 530 };
const eyebrow = { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#a56d00', background: '#fff3d5', borderRadius: 99, padding: '6px 9px', fontSize: 11, fontWeight: 800, letterSpacing: '.08em' };
const title = { margin: '16px 0 7px', color: '#002B54', fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 38px)', letterSpacing: '-.04em', lineHeight: 1.05 };
const subtitle = { margin: 0, color: '#52677b', lineHeight: 1.6, fontSize: 14 };
const featureContext = { display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 20, padding: '12px 13px', border: '1px solid #efd48c', borderRadius: 11, background: '#fff8e5', color: '#705300', fontSize: 12, lineHeight: 1.5 };
const planPicker = { display: 'grid', gap: 10, marginTop: 28 };
const planOption = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '15px 16px', border: '1.5px solid #dce6ee', borderRadius: 12, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' };
const selectedPlanOption = { borderColor: '#FAB72D', boxShadow: '0 0 0 3px rgba(250,183,45,.22)', background: '#fffdf8' };
const radio = { width: 18, height: 18, border: '2px solid #7890a4', borderRadius: '50%', display: 'grid', placeItems: 'center', flex: '0 0 auto' };
const radioDot = { width: 8, height: 8, borderRadius: '50%', background: '#FAB72D' };
const summary = { marginTop: 26, borderTop: '1px solid #e4ebf1', borderBottom: '1px solid #e4ebf1', padding: '8px 0' };
const summaryRow = { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0', color: '#52677b', fontSize: 13 };
const totalRow = { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '16px 0 10px', color: '#002B54', fontSize: 15, borderTop: '1px dashed #dce6ee' };
const payButton = { marginTop: 24, width: '100%', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 9, border: 0, borderRadius: 11, background: '#002B54', color: '#fff', padding: '14px 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer' };
const paymentNote = { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 7, margin: '15px auto 0', maxWidth: 450, color: '#6c7f90', fontSize: 12, lineHeight: 1.45, textAlign: 'center' };
const errorBox = { marginTop: 18, background: '#fff0ef', border: '1px solid #f6c7c3', color: '#a52f25', borderRadius: 9, padding: '10px 12px', fontSize: 13 };
const benefitCard = { background: '#002B54', borderRadius: 20, padding: '30px 28px', color: '#fff', boxShadow: '0 18px 42px rgba(0,43,84,.18)' };
const benefitIcon = { display: 'grid', placeItems: 'center', width: 42, height: 42, background: 'rgba(250,183,45,.18)', color: '#FAB72D', borderRadius: 12 };
const benefitTitle = { margin: '18px 0 14px', fontFamily: 'var(--font-display)', fontSize: 21, letterSpacing: '-.02em' };
const benefitList = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12, color: '#d9e7f2', fontSize: 13 };
const receiptNote = { marginTop: 25, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,.18)', color: '#FAB72D', fontSize: 12, fontWeight: 700, lineHeight: 1.45 };
