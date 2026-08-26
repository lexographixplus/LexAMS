import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const date = (value) => value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';

export default function BillingAdmin() {
  const { profile } = useAuth();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const selectedPanelRef = useRef(null);

  async function load() {
    const response = await fetch('/api/billing/admin', { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Could not load billing administration.');
    setData(body);
  }

  useEffect(() => { load().catch(error => setNotice({ type: 'error', text: error.message })); }, []);

  useEffect(() => {
    if (!selected) return;
    requestAnimationFrame(() => selectedPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [selected]);

  async function runAction(action, extra = {}) {
    if (!selected || !reason.trim() || saving) {
      if (!reason.trim()) setNotice({ type: 'error', text: 'Enter the reason for this auditable billing action.' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/billing/admin', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, organizationId: selected.organization_id, reason: reason.trim(), ...extra }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Billing action could not be completed.');
      setReason('');
      setSelected(null);
      setNotice({ type: 'success', text: action === 'downgrade_to_free' ? 'Account downgraded to Free. Existing organisation data was preserved and the action was recorded in the audit log.' : 'Billing action completed and recorded in the audit log.' });
      await load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Billing action could not be completed.' });
    } finally {
      setSaving(false);
    }
  }

  function downgrade() {
    if (!selected || saving) return;
    const confirmed = window.confirm(`Downgrade ${selected.organization_name} to Free now? Existing data will be preserved, but Free-plan limits will apply to new activity, participant, survey, assessment, certificate and collaboration actions.`);
    if (confirmed) runAction('downgrade_to_free');
  }

  if (!profile?.platform_admin) return <AccessDenied />;
  if (!data) return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Loading billing administration…</div>;
  const stats = data.summary || {};

  return <div style={{ display: 'grid', gap: 24 }}>
    <section style={card}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={icon}><ShieldCheck size={22} /></div>
        <div><div style={eyebrow}>Platform-only access</div><h2 style={title}>Subscription administration</h2><p style={subtext}>Organisation subscriptions, offline payment records, complimentary access and plan downgrades. Every change requires a reason and is retained in the billing audit log.</p></div>
      </div>
      <div style={statGrid}>
        <Stat label="Pro organisations" value={stats.pro_organizations || 0} />
        <Stat label="Free organisations" value={stats.free_organizations || 0} />
        <Stat label="In grace" value={stats.in_grace || 0} />
        <Stat label="Expired / past due" value={stats.expired_or_past_due || 0} />
      </div>
    </section>

    {notice && <div style={{ padding: '12px 15px', borderRadius: 'var(--radius-md)', fontSize: 13, background: notice.type === 'success' ? '#E8F7EE' : '#FFF0F0', color: notice.type === 'success' ? '#176C39' : '#A01E1E' }}>{notice.type === 'success' && <CheckCircle2 size={15} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />}{notice.text}</div>}

    <section style={card}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>Organisation subscriptions</div>
      <p style={subtext}>Select an organisation to record an approved manual payment, grant time-limited complimentary Pro access or downgrade a Pro account to Free.</p>
      <div style={tableWrap}><table style={table}><thead><tr><th>Organisation</th><th>Plan / status</th><th>Cycle</th><th>Ends</th><th /></tr></thead><tbody>
        {data.subscriptions.map(subscription => <tr key={subscription.organization_id}><td><strong>{subscription.organization_name}</strong><br /><span style={muted}>{subscription.provider}</span></td><td><span style={badge}>{subscription.plan} · {subscription.status}</span></td><td>{subscription.billing_cycle || '—'}</td><td>{date(subscription.grace_period_end || subscription.current_period_end)}</td><td><button onClick={() => setSelected(subscription)} style={smallButton}>Manage</button></td></tr>)}
      </tbody></table></div>
    </section>

    {selected && <section ref={selectedPanelRef} tabIndex={-1} aria-labelledby="billing-selected-organisation" style={{ ...card, border: '1.5px solid var(--color-accent)', scrollMarginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}><div><div style={eyebrow}>Selected organisation</div><h3 id="billing-selected-organisation" style={{ ...title, fontSize: 20 }}>{selected.organization_name}</h3><p style={subtext}>Current state: {selected.plan} · {selected.status} · {selected.provider}.</p></div><button onClick={() => setSelected(null)} style={smallButton}>Close</button></div>
      <label style={{ display: 'block', marginTop: 16, fontSize: 13, fontWeight: 700 }}>Audit reason <textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="e.g. Subscription cancelled at customer request" rows={3} style={input} /></label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        <button disabled={saving} onClick={() => runAction('record_manual_payment', { billingCycle: 'monthly' })} style={primary}>{saving ? 'Saving…' : 'Record GMD 1,000 monthly payment'}</button>
        <button disabled={saving} onClick={() => runAction('record_manual_payment', { billingCycle: 'annual' })} style={primary}>{saving ? 'Saving…' : 'Record GMD 10,000 annual payment'}</button>
        <button disabled={saving} onClick={() => runAction('grant_complimentary_pro', { durationDays: 30 })} style={secondary}>{saving ? 'Saving…' : 'Grant 30-day complimentary Pro'}</button>
        {selected.plan === 'pro' && <button disabled={saving} onClick={downgrade} style={danger}>{saving ? 'Saving…' : 'Downgrade to Free'}</button>}
      </div>
      {selected.plan === 'pro' && <div style={warning}><strong>Downgrade behaviour:</strong> no organisation data is deleted. The workspace immediately receives Free entitlements. If existing usage is above a Free limit, those records remain available, but new creation is restricted until usage is back within the Free allowance or Pro is restored.</div>}
    </section>}

    <section style={card}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>Recent billing activity</div>
      <div style={tableWrap}><table style={table}><thead><tr><th>Organisation</th><th>Action</th><th>Reason</th><th>Operator</th><th>When</th></tr></thead><tbody>
        {data.audit_log.length ? data.audit_log.map(item => <tr key={item.id}><td>{item.organization_name}</td><td>{item.action}</td><td>{item.reason}</td><td>{item.actor_name}</td><td>{date(item.created_at)}</td></tr>) : <tr><td colSpan="5" style={muted}>No audited actions yet.</td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}

function AccessDenied() { return <section style={card}><h2 style={title}>Platform administrator access required</h2><p style={subtext}>This area is kept separate from organisation roles. Ask a platform administrator to add your user to the authorised billing operator list.</p></section>; }
function Stat({ label, value }) { return <div style={{ background: 'var(--surface-muted)', borderRadius: 'var(--radius-md)', padding: 14 }}><div style={muted}>{label}</div><div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--color-navy-900)', marginTop: 4 }}>{value}</div></div>; }

const card = { background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '24px 28px', boxShadow: 'var(--shadow-card)' };
const icon = { display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: 12, background: '#EEF3F8', color: 'var(--color-navy-700)' };
const eyebrow = { color: 'var(--text-tertiary)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700 };
const title = { fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--color-navy-900)', margin: '4px 0 0' };
const subtext = { color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55, margin: '7px 0 0' };
const muted = { color: 'var(--text-tertiary)', fontSize: 12 };
const statGrid = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 20 };
const tableWrap = { overflowX: 'auto', marginTop: 16, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' };
const table = { width: '100%', borderCollapse: 'collapse', minWidth: 700, fontSize: 13 };
const smallButton = { border: '1px solid var(--border-default)', background: 'var(--surface-card)', padding: '7px 10px', borderRadius: 'var(--radius-sm)', fontWeight: 700, color: 'var(--color-navy-700)', cursor: 'pointer' };
const badge = { display: 'inline-block', padding: '4px 7px', borderRadius: 99, background: '#EEF3F8', color: 'var(--color-navy-700)', fontSize: 11, fontWeight: 700 };
const input = { display: 'block', boxSizing: 'border-box', width: '100%', marginTop: 7, padding: 10, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)', color: 'var(--text-primary)', fontFamily: 'inherit', resize: 'vertical' };
const primary = { padding: '10px 13px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--color-navy-900)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const secondary = { ...primary, background: 'var(--surface-muted)', color: 'var(--color-navy-700)', border: '1px solid var(--border-default)' };
const danger = { ...primary, background: '#FFF0F0', color: '#A01E1E', border: '1px solid #F0CACA' };
const warning = { marginTop: 16, padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: '#FFF8E8', color: '#6B4A00', fontSize: 12, lineHeight: 1.55, border: '1px solid #F0D89A' };
