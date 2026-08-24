import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const anonClient = supabaseUrl ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function RegisterPublic() {
  const { token } = useParams();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Steps: email -> found -> form -> done -> already
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [foundParticipant, setFoundParticipant] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', org: '', category: 'Community member' });
  const [submitting, setSubmitting] = useState(false);
  const [regName, setRegName] = useState('');

  useEffect(() => {
    if (!anonClient) { setError('App not configured'); setLoading(false); return; }
    async function load() {
      const { data: a } = await anonClient.from('activities').select('*').eq('reg_token', token).single();
      if (!a) { setError('Activity not found'); setLoading(false); return; }
      if (!a.reg_open) { setError('Registration is closed for this activity.'); setLoading(false); return; }
      setActivity(a);
      setLoading(false);
    }
    load();
  }, [token]);

  function fmtRange(a) {
    const s = new Date(a.start_date + 'T00:00:00');
    const e = new Date(a.end_date + 'T00:00:00');
    const opts = { month: 'short', day: 'numeric', year: 'numeric' };
    if (a.start_date === a.end_date) return s.toLocaleDateString('en-US', opts);
    return s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '\u2013' + e.toLocaleDateString('en-US', opts);
  }

  async function checkEmail(e) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) { setError('Enter a valid email address.'); return; }
    setError(null);
    setSubmitting(true);

    // Check if already registered
    const { data: existing } = await anonClient.from('participants').select('id').eq('email', trimmed);
    if (existing?.length) {
      const pid = existing[0].id;
      const { data: reg } = await anonClient.from('registrations').select('id').eq('activity_id', activity.id).eq('participant_id', pid);
      if (reg?.length) { setStep('already'); setSubmitting(false); return; }
    }

    // Check if returning participant
    const { data: parts } = await anonClient.from('participants').select('*').eq('email', trimmed);
    if (parts?.length) {
      setFoundParticipant(parts[0]);
      setStep('found');
    } else {
      setFoundParticipant(null);
      setForm({ name: '', phone: '', org: '', category: 'Community member' });
      setStep('form');
    }
    setSubmitting(false);
  }

  async function confirmFound() {
    setSubmitting(true);
    await anonClient.from('registrations').insert({ activity_id: activity.id, participant_id: foundParticipant.id });
    setRegName(foundParticipant.name);
    setStep('done');
    setSubmitting(false);
  }

  async function submitForm(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setError(null);
    setSubmitting(true);

    let pid;
    if (foundParticipant) {
      const { error: updateError } = await anonClient.from('participants')
        .update({ name: form.name.trim(), phone: form.phone.trim(), org: form.org.trim(), category: form.category })
        .eq('id', foundParticipant.id)
        .eq('email', email.trim().toLowerCase());
      if (updateError) { setError(updateError.message); setSubmitting(false); return; }
      pid = foundParticipant.id;
    } else {
      const { data: p, error: insertError } = await anonClient.from('participants').insert({
        name: form.name.trim(), email: email.trim().toLowerCase(),
        phone: form.phone.trim() || '', org: form.org.trim() || '', category: form.category,
      }).select().single();
      if (insertError || !p) { setError(insertError?.message || 'Could not create participant.'); setSubmitting(false); return; }
      pid = p.id;
    }

    const { error: registrationError } = await anonClient.from('registrations').insert({ activity_id: activity.id, participant_id: pid });
    if (registrationError) { setError(registrationError.message); setSubmitting(false); return; }
    setRegName(form.name.trim());
    setStep('done');
    setSubmitting(false);
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', fontSize: 16, color: '#0F1B2B',
    border: '1.5px solid #E0E4E9', borderRadius: 6, background: '#FFFFFF', outline: 'none',
  };

  if (loading) return <Shell><p style={{ textAlign: 'center', color: '#7A8699' }}>Loading...</p></Shell>;
  if (error && !activity) return <Shell><p style={{ textAlign: 'center', color: '#C0362C' }}>{error}</p></Shell>;

  return (
    <Shell>
      <div style={{
        background: '#FFFFFF', border: '1px solid #E0E4E9', borderRadius: 12,
        boxShadow: '0 1px 2px rgba(0,43,84,0.06), 0 4px 16px rgba(0,43,84,0.06)',
        padding: '26px 28px',
      }}>
        <div style={{ fontFamily: "'Merriweather', serif", fontSize: 24, fontWeight: 700, color: '#002B54' }}>
          {activity.title}
        </div>
        <div style={{ fontSize: 13, color: '#5B6B80', marginTop: 8 }}>
          {activity.type} &middot; {fmtRange(activity)} &middot; {activity.venue}
        </div>
        {activity.description && (
          <p style={{ fontSize: 14, color: '#5B6B80', lineHeight: 1.65, marginTop: 14 }}>{activity.description}</p>
        )}
        <div style={{ fontSize: 12, color: '#7A8699', marginTop: 14 }}>Organized by {activity.organizer}</div>
      </div>

      <div style={{
        background: '#FFFFFF', border: '1px solid #E0E4E9', borderRadius: 12,
        boxShadow: '0 1px 2px rgba(0,43,84,0.06), 0 4px 16px rgba(0,43,84,0.06)',
        padding: '26px 28px', marginTop: 16,
      }}>
        {step === 'email' && (
          <form onSubmit={checkEmail}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#002B54' }}>Register with your email</div>
            <p style={{ fontSize: 13, color: '#5B6B80', marginTop: 5, lineHeight: 1.5 }}>
              Returning participants are recognized automatically.
            </p>
            <input type="email" required value={email} onChange={e => { setEmail(e.target.value); setError(null); }}
              placeholder="name@example.org" style={{ ...inputStyle, marginTop: 16 }} />
            {error && <p style={{ color: '#C0362C', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="submit" disabled={submitting} style={{
                padding: '10px 24px', fontSize: 14, fontWeight: 600,
                background: '#FAB72D', color: '#002B54', border: 'none', borderRadius: 8, cursor: 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}>{submitting ? 'Checking...' : 'Continue'}</button>
            </div>
          </form>
        )}

        {step === 'found' && foundParticipant && (
          <div>
            <div style={{ fontFamily: "'Merriweather', serif", fontSize: 19, fontWeight: 700, color: '#002B54' }}>
              Welcome back, {foundParticipant.name.split(' ')[0]}
            </div>
            <p style={{ fontSize: 13, color: '#5B6B80', marginTop: 5 }}>We found your details. Confirm to register.</p>
            <div style={{
              border: '1px solid #E0E4E9', borderRadius: 8, padding: '14px 16px', marginTop: 16,
              display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13,
            }}>
              {[['Name', foundParticipant.name], ['Organization', foundParticipant.org], ['Category', foundParticipant.category], ['Phone', foundParticipant.phone]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#7A8699' }}>{k}</span><span style={{ fontWeight: 600 }}>{v || '\u2014'}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => {
                setForm({ name: foundParticipant.name, phone: foundParticipant.phone || '', org: foundParticipant.org || '', category: foundParticipant.category });
                setStep('form');
              }} style={{
                padding: '10px 20px', fontSize: 14, fontWeight: 600, background: 'transparent',
                border: '1.5px solid #E0E4E9', borderRadius: 8, color: '#5B6B80', cursor: 'pointer',
              }}>Edit details</button>
              <button onClick={confirmFound} disabled={submitting} style={{
                padding: '10px 24px', fontSize: 14, fontWeight: 600,
                background: '#FAB72D', color: '#002B54', border: 'none', borderRadius: 8, cursor: 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}>{submitting ? 'Registering...' : 'Confirm registration'}</button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={submitForm}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#002B54' }}>Your details</div>
            <p style={{ fontSize: 13, color: '#5B6B80', marginTop: 5 }}>
              Registering as <strong>{email}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" style={inputStyle} />
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone (+254 ...)" style={inputStyle} />
              <input value={form.org} onChange={e => setForm(f => ({ ...f, org: e.target.value }))} placeholder="Organization" style={inputStyle} />
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                {['Volunteer', 'Staff', 'Community member', 'Partner', 'Youth', 'Teacher', 'Parent', 'External'].map(c =>
                  <option key={c} value={c}>{c}</option>
                )}
              </select>
            </div>
            {error && <p style={{ color: '#C0362C', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button type="button" onClick={() => setStep('email')} style={{
                padding: '10px 20px', fontSize: 14, fontWeight: 600, background: 'transparent',
                border: '1.5px solid #E0E4E9', borderRadius: 8, color: '#5B6B80', cursor: 'pointer',
              }}>Back</button>
              <button type="submit" disabled={submitting} style={{
                padding: '10px 24px', fontSize: 14, fontWeight: 600,
                background: '#FAB72D', color: '#002B54', border: 'none', borderRadius: 8, cursor: 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}>{submitting ? 'Registering...' : 'Register'}</button>
            </div>
          </form>
        )}

        {step === 'already' && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#002B54' }}>You're already registered</div>
            <p style={{ fontSize: 13, color: '#5B6B80', marginTop: 6, lineHeight: 1.6 }}>
              This email is already registered for this activity.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => { setStep('email'); setEmail(''); }} style={{
                padding: '10px 20px', fontSize: 14, fontWeight: 600, background: 'transparent',
                border: '1.5px solid #E0E4E9', borderRadius: 8, color: '#5B6B80', cursor: 'pointer',
              }}>Use another email</button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 999, background: '#E4F3E9', color: '#2E7D4F',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700,
            }}>{'\u2713'}</div>
            <div style={{ fontFamily: "'Merriweather', serif", fontSize: 21, fontWeight: 700, marginTop: 14, color: '#002B54' }}>
              You're registered
            </div>
            <p style={{ fontSize: 13, color: '#5B6B80', marginTop: 8, lineHeight: 1.6 }}>
              {regName} &mdash; {activity.title}<br />{fmtRange(activity)} &middot; {activity.venue}
            </p>
            <button onClick={() => { setStep('email'); setEmail(''); }} style={{
              marginTop: 18, padding: '10px 20px', fontSize: 14, fontWeight: 600, background: 'transparent',
              border: '1.5px solid #E0E4E9', borderRadius: 8, color: '#5B6B80', cursor: 'pointer',
            }}>Register someone else</button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', fontFamily: "'Inter', sans-serif", color: '#002B54' }}>
      <div style={{ background: '#002B54', padding: '20px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Merriweather', serif", fontWeight: 700, fontSize: 21, color: '#FFFFFF' }}>LexAMS</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Activity Registration</div>
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 64px' }}>{children}</div>
      <div style={{ textAlign: 'center', padding: 16, fontSize: 11, color: '#7A8699', borderTop: '1px solid #E0E4E9' }}>
        Powered by LexAMS &middot; LexoStudio
      </div>
    </div>
  );
}
