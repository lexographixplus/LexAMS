import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock3, CreditCard, Sparkles } from 'lucide-react';

const formatDate = (value) => value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
const formatMoney = (amount) => `GMD ${Number(amount || 0).toLocaleString()}`;

function Meter({ label, current, limit }) {
  const percent = Math.min(100, Math.round((current / limit) * 100));
  return <div style={{ marginTop: 13 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
      <span>{label}</span><strong style={{ color: 'var(--text-primary)' }}>{current}/{limit}</strong>
    </div>
    <div style={{ height: 7, borderRadius: 99, background: 'var(--surface-muted)', overflow: 'hidden', marginTop: 7 }}>
      <div style={{ height: '100%', width: `${percent}%`, borderRadius: 99, background: percent >= 90 ? 'var(--color-danger)' : 'var(--color-accent)' }} />
    </div>
  </div>;
}

export default function BillingPlan({ isAdmin, notify }) {
  const navigate = useNavigate();
  const [billing, setBilling] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [cycle, setCycle] = useState('annual');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/billing/plan', { credentials: 'include' }),
      fetch('/api/billing/invoices', { credentials: 'include' }),
    ]).then(async ([planResponse, invoicesResponse]) => {
      if (!active) return;
      if (planResponse.ok) setBilling(await planResponse.json());
      if (invoicesResponse.ok) {
        const data = await invoicesResponse.json();
        if (active) setInvoices(data.invoices || []);
      }
    }).catch(() => {
      if (active) notify('Could not load billing information.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [notify]);

  const isPro = billing?.subscription?.plan === 'pro';
  const entitlement = billing?.entitlements;
  const usage = billing?.usage;
  const renewalLabel = useMemo(() => {
    if (!billing?.subscription) return '';
    if (billing.subscription.status === 'grace') return `Grace period ends ${formatDate(billing.subscription.grace_period_end)}`;
    return billing.subscription.current_period_end ? `Renews or expires ${formatDate(billing.subscription.current_period_end)}` : 'No paid renewal is scheduled';
  }, [billing]);

  if (loading) return <section style={card}><div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading billing and plan details…</div></section>;

  return <section style={{ ...card, marginTop: 24 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
      <div>
        <div style={eyebrow}>Billing & plan</div>
        <h3 style={heading}>Your LexAMS plan</h3>
        <p style={subtext}>{isPro ? 'Your organisation has professional operating capacity.' : 'Start small today; upgrade when your programme needs more scale.'}</p>
      </div>
      <span style={{ ...pill, background: isPro ? '#E8F7EE' : '#EEF3F8', color: isPro ? '#18733B' : 'var(--color-navy-700)' }}>
        {isPro ? <Sparkles size={14} /> : <Clock3 size={14} />}{isPro ? 'LexAMS Pro' : 'Free plan'}
      </span>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20, marginTop: 24 }} className="billing-plan-grid">
      <div style={panel}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Current access</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 7 }}>{billing?.subscription?.status === 'grace' ? 'Pro access remains available during your grace period.' : renewalLabel}</div>
        {!isPro && entitlement && usage && <>
          <Meter label="Active activities" current={usage.activeActivities} limit={entitlement.activeActivities} />
          <Meter label="Participants" current={usage.participants} limit={entitlement.participants} />
          <Meter label="Team seats" current={usage.teamSeats} limit={entitlement.teamSeats} />
          <Meter label="Certificates this month" current={usage.monthlyCertificates} limit={entitlement.monthlyCertificates} />
        </>}
        {isPro && <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginTop: 20, padding: 12, borderRadius: 'var(--radius-sm)', background: '#F4FBF6', color: '#1B6A3A', fontSize: 13 }}><CheckCircle2 size={17} /> Pro features are enabled for your whole organisation.</div>}
      </div>

      {!isPro && <div style={{ ...panel, border: '1.5px solid var(--color-accent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15 }}><Sparkles size={17} color="var(--color-accent)" /> Upgrade to Pro</div>
        <p style={{ ...subtext, marginTop: 7 }}>Team collaboration, larger programme capacity, full reporting and professional outputs.</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={() => setCycle('annual')} style={{ ...optionButton, ...(cycle === 'annual' ? selectedOption : {}) }}>Annual <strong>GMD 10,000</strong><small>GMD 833/month · Save 17%</small></button>
          <button onClick={() => setCycle('monthly')} style={{ ...optionButton, ...(cycle === 'monthly' ? selectedOption : {}) }}>Monthly <strong>GMD 1,000</strong><small>Flexible access</small></button>
        </div>
        {isAdmin ? <button onClick={() => navigate(`/app/checkout?cycle=${cycle}`)} style={primaryButton}><CreditCard size={16} />Review order · {cycle === 'annual' ? 'Annual' : 'Monthly'}</button> : <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 18 }}>Only an organisation owner or administrator can manage billing.</p>}
      </div>}
    </div>

    <div style={{ marginTop: 24, borderTop: '1px solid var(--border-default)', paddingTop: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>Payment history</div>
      {invoices.length ? <div style={{ marginTop: 10 }}>{invoices.slice(0, 5).map(invoice => <div key={invoice.id} style={invoiceRow}><span>{formatDate(invoice.created_at)} · {invoice.internal_reference}</span><span>{formatMoney(invoice.amount)} · <strong>{invoice.status}</strong></span></div>)}</div> : <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 9 }}>No payment records yet.</p>}
    </div>
  </section>;
}

const card = { background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '24px 28px' };
const panel = { background: 'var(--surface-muted)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 18 };
const eyebrow = { color: 'var(--text-tertiary)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 };
const heading = { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginTop: 5 };
const subtext = { color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55, marginTop: 5 };
const pill = { display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 99, fontSize: 12, fontWeight: 700, padding: '7px 10px' };
const optionButton = { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 11px', border: '1px solid var(--border-default)', background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' };
const selectedOption = { borderColor: 'var(--color-accent)', boxShadow: '0 0 0 2px rgba(250,183,45,.25)' };
const primaryButton = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 14px', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-navy-900)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 18 };
const invoiceRow = { display: 'flex', justifyContent: 'space-between', gap: 14, padding: '10px 0', borderTop: '1px solid var(--border-default)', fontSize: 12, color: 'var(--text-secondary)' };
