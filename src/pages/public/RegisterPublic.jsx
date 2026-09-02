import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicExperienceLayout, { PublicCard, PublicNotice } from '../../components/PublicExperienceLayout';
import QrCode from '../../components/QrCode';
import { fmtRange } from '../../lib/format';
import useDocumentTitle from '../../lib/useDocumentTitle';

const CATEGORIES = ['Volunteer', 'Staff', 'Community member', 'Partner', 'Youth', 'Teacher', 'Parent', 'External'];

async function registrationApi(token, options = {}) {
  const response = await fetch(`/api/public-registration/${encodeURIComponent(token)}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 409) throw new Error(body.error || 'Registration could not be processed.');
  return { response, body };
}

function Progress({ step }) {
  const active = step === 'done' ? 3 : step === 'form' || step === 'found' ? 2 : 1;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 18 }} aria-label="Registration progress">
      {['Email', 'Details', 'Confirmed'].map((label, index) => (
        <div key={label}>
          <div style={{ height: 5, borderRadius: 99, background: index + 1 <= active ? '#FAB72D' : '#E7ECF1' }} />
          <div style={{ marginTop: 5, fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: index + 1 <= active ? '#002B54' : '#8A96A5' }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function CustomField({ field, value, onChange }) {
  const id = `custom-${field.id}`;
  if (field.type === 'checkbox') {
    return (
      <label htmlFor={id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: '#334155', fontSize: 14, lineHeight: 1.5 }}>
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} style={{ marginTop: 3 }} />
        <span>{field.label}{field.required ? ' *' : ''}</span>
      </label>
    );
  }
  return (
    <label className="lex-public-field" htmlFor={id}>
      <span className="lex-public-label">{field.label}{field.required ? ' *' : ''}</span>
      {field.type === 'textarea' ? (
        <textarea id={id} className="lex-public-textarea" rows={4} required={field.required} value={value || ''} onChange={e => onChange(e.target.value)} />
      ) : field.type === 'select' ? (
        <select id={id} className="lex-public-select" required={field.required} value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">Choose an option</option>
          {(field.options || []).map(option => <option key={option}>{option}</option>)}
        </select>
      ) : (
        <input id={id} className="lex-public-input" required={field.required} value={value || ''} onChange={e => onChange(e.target.value)} />
      )}
    </label>
  );
}

export default function RegisterPublic() {
  useDocumentTitle('Register for this activity');
  const { token } = useParams();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [existingParticipant, setExistingParticipant] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', org: '', category: 'Community member' });
  const [customAnswers, setCustomAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [resendState, setResendState] = useState('');

  useEffect(() => {
    registrationApi(token)
      .then(({ body }) => setActivity(body.activity))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const counts = useMemo(() => activity?.registration_counts || {}, [activity]);
  const capacityText = useMemo(() => {
    const capacity = Number(activity?.registration_capacity || 0);
    if (!capacity) return null;
    const used = Number(counts.confirmed || 0) + Number(counts.pending || 0);
    return `${Math.max(0, capacity - used)} of ${capacity} places remaining`;
  }, [activity, counts]);

  async function lookup(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { body } = await registrationApi(token, { method: 'POST', body: JSON.stringify({ action: 'lookup', email }) });
      if (body.state === 'already') {
        setResult({ status: body.status, reference: body.reference });
        setStep('already');
      } else {
        setExistingParticipant(body.state === 'found');
        setStep(body.state === 'found' ? 'found' : 'form');
      }
    } catch (e2) { setError(e2.message); }
    finally { setSubmitting(false); }
  }

  async function submitRegistration(e) {
    e?.preventDefault?.();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        email,
        ...(existingParticipant ? {} : form),
        custom_answers: customAnswers,
      };
      const { response, body } = await registrationApi(token, { method: 'POST', body: JSON.stringify(payload) });
      if (response.status === 409 && body.state === 'already') {
        setResult({ status: body.status, reference: body.reference });
        setStep('already');
        return;
      }
      setResult(body);
      setStep('done');
    } catch (e2) { setError(e2.message); }
    finally { setSubmitting(false); }
  }

  async function resend() {
    setResendState('sending');
    try {
      const { body } = await registrationApi(token, { method: 'POST', body: JSON.stringify({ action: 'resend', email }) });
      setResendState(body.email_sent ? 'sent' : 'requested');
    } catch { setResendState('requested'); }
  }

  function reset() {
    setStep('email');
    setEmail('');
    setExistingParticipant(false);
    setForm({ name: '', phone: '', org: '', category: 'Community member' });
    setCustomAnswers({});
    setResult(null);
    setError('');
    setResendState('');
  }

  if (loading) return <PublicExperienceLayout eyebrow="Registration" title="Loading activity…" narrow />;
  if (!activity) return <PublicExperienceLayout eyebrow="Registration" title="Registration unavailable" narrow><PublicNotice tone="error">{error || 'This registration link is unavailable.'}</PublicNotice></PublicExperienceLayout>;

  return (
    <PublicExperienceLayout
      eyebrow="Activity registration"
      title={activity.title}
      description={`${activity.type || 'Activity'} · ${fmtRange(activity)}${activity.venue ? ` · ${activity.venue}` : ''}`}
      organizationName={activity.organization_name}
      organizationLogo={activity.organization_logo}
      narrow
    >
      <PublicCard style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gap: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#002B54', fontWeight: 800 }}>{activity.title}</div>
              <div style={{ marginTop: 4, color: '#687587', fontSize: 13, lineHeight: 1.55 }}>{fmtRange(activity)}{activity.venue ? ` · ${activity.venue}` : ''}</div>
            </div>
            <span style={{ padding: '5px 9px', borderRadius: 999, flexShrink: 0, background: activity.registration_open ? '#EAF6EE' : '#FBEAEA', color: activity.registration_open ? '#24633D' : '#A42C27', fontSize: 12, fontWeight: 800 }}>{activity.registration_open ? 'Registration open' : 'Registration closed'}</span>
          </div>
          {activity.description && <p style={{ color: '#687587', lineHeight: 1.65, margin: '2px 0 0' }}>{activity.description}</p>}
          {capacityText && <div style={{ fontSize: 12, color: '#31516F', fontWeight: 700 }}>{capacityText}{activity.waitlist_enabled ? ' · Waitlist available when full' : ''}</div>}
        </div>
      </PublicCard>

      <PublicCard>
        <Progress step={step} />
        {!activity.registration_open && step !== 'done' && step !== 'already' && <PublicNotice tone="error">{activity.registration_closed_reason || 'Registration is closed.'}</PublicNotice>}

        {step === 'email' && (
          <form onSubmit={lookup}>
            <h3>Start with your email</h3>
            <p style={{ color: '#687587' }}>LexAMS will safely recognise an existing participant profile without displaying stored personal details.</p>
            <label className="lex-public-label" htmlFor="registration-email">Email address</label>
            <input id="registration-email" className="lex-public-input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.org" />
            {error && <PublicNotice tone="error">{error}</PublicNotice>}
            <div className="lex-public-actions"><button className="lex-public-button" disabled={submitting || !activity.registration_open}>{submitting ? 'Checking…' : 'Continue'}</button></div>
          </form>
        )}

        {step === 'found' && (
          <div>
            <h3>Existing participant profile found</h3>
            <p style={{ color: '#687587' }}>A participant profile already exists for this email. For privacy, LexAMS does not display the stored phone, organisation or profile details here.</p>
            <PublicNotice>Continue to register the existing profile for this activity. Contact the organiser if your saved details need to be updated.</PublicNotice>
            {error && <PublicNotice tone="error">{error}</PublicNotice>}
            <div className="lex-public-actions">
              <button className="lex-public-button ghost" type="button" onClick={() => { setExistingParticipant(false); setStep('email'); }}>Use another email</button>
              <button className="lex-public-button" type="button" onClick={() => setStep('form')}>Continue</button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={submitRegistration}>
            <h3>{existingParticipant ? 'Registration questions' : 'Your details'}</h3>
            {!existingParticipant && (
              <div className="lex-public-fields">
                <label><span className="lex-public-label">Full name *</span><input className="lex-public-input" autoComplete="name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
                <label><span className="lex-public-label">Phone number</span><input className="lex-public-input" autoComplete="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
                <label><span className="lex-public-label">Organisation</span><input className="lex-public-input" autoComplete="organization" value={form.org} onChange={e => setForm({ ...form, org: e.target.value })} /></label>
                <label><span className="lex-public-label">Participant category</span><select className="lex-public-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(x => <option key={x}>{x}</option>)}</select></label>
              </div>
            )}

            {(activity.registration_custom_fields || []).length > 0 && (
              <div style={{ marginTop: existingParticipant ? 0 : 22, display: 'grid', gap: 14 }}>
                {(activity.registration_custom_fields || []).map(field => <CustomField key={field.id} field={field} value={customAnswers[field.id]} onChange={value => setCustomAnswers(prev => ({ ...prev, [field.id]: value }))} />)}
              </div>
            )}

            {error && <PublicNotice tone="error">{error}</PublicNotice>}
            <div className="lex-public-actions">
              <button type="button" className="lex-public-button ghost" onClick={() => setStep(existingParticipant ? 'found' : 'email')}>Back</button>
              <button className="lex-public-button" disabled={submitting}>{submitting ? 'Registering…' : 'Review & register'}</button>
            </div>
          </form>
        )}

        {step === 'already' && (
          <div>
            <h3>You’re already registered</h3>
            <p style={{ color: '#687587' }}>This email already has a registration for {activity.title}.</p>
            {result?.reference && <PublicNotice><strong>{result.reference}</strong> · <span style={{ textTransform: 'capitalize' }}>{result.status}</span></PublicNotice>}
            {resendState === 'sent' && <PublicNotice tone="success">Confirmation email sent.</PublicNotice>}
            {resendState === 'requested' && <PublicNotice>Confirmation request processed. Check the registered inbox.</PublicNotice>}
            <div className="lex-public-actions">
              <button className="lex-public-button ghost" onClick={reset}>Register someone else</button>
              <button className="lex-public-button" onClick={resend} disabled={resendState === 'sending'}>{resendState === 'sending' ? 'Sending…' : 'Resend confirmation'}</button>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 999, margin: '0 auto 10px', display: 'grid', placeItems: 'center', background: '#EAF6EE', color: '#24633D', fontSize: 24, fontWeight: 900 }}>✓</div>
            <h3 style={{ marginBottom: 8 }}>Registration {result.status === 'confirmed' ? 'confirmed' : result.status === 'waitlisted' ? 'waitlisted' : 'submitted'}</h3>
            <p style={{ color: '#687587', marginTop: 0 }}>{result.name ? `${result.name}, your` : 'Your'} registration for {activity.title} is <strong>{result.status}</strong>.</p>
            <div style={{ margin: '18px auto', maxWidth: 330, border: '1px solid #DDE3EA', borderRadius: 12, padding: 16 }}>
              <div style={{ color: '#687587', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800 }}>Registration reference</div>
              <div style={{ color: '#002B54', fontSize: 22, fontWeight: 900, marginTop: 5, letterSpacing: '.04em' }}>{result.reference}</div>
            </div>
            {result.status === 'confirmed' && result.pass_token && (
              <div style={{ display: 'grid', justifyItems: 'center', gap: 10, marginTop: 18 }}>
                <QrCode value={`PASS:${result.pass_token}`} size={190} label="Participant pass QR code" />
                <Link className="lex-public-button secondary" to={`/pass/${result.pass_token}`}>Open participant pass</Link>
                <p style={{ color: '#687587', fontSize: 12, margin: 0 }}>Keep the pass or registration reference for activity check-in.</p>
              </div>
            )}
            {result.email_sent && <PublicNotice tone="success">A branded confirmation has been sent to your email.</PublicNotice>}
            <div className="lex-public-actions" style={{ justifyContent: 'center' }}><button className="lex-public-button ghost" onClick={reset}>Register someone else</button></div>
          </div>
        )}
      </PublicCard>
    </PublicExperienceLayout>
  );
}
