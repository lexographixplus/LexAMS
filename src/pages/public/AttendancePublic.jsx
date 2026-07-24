import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const anonClient = supabaseUrl ? createClient(supabaseUrl, supabaseAnonKey) : null;

function computeSessionDay(activity) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(activity.start_date + 'T00:00:00');
  start.setHours(0, 0, 0, 0);
  const diffMs = today - start;
  const diffDays = Math.floor(diffMs / 86400000);
  // Clamp to valid range: Day 1 to sessions count
  const dayNum = Math.max(1, Math.min(diffDays + 1, activity.sessions));
  return 'Day ' + dayNum;
}

function isBeforeActivity(activity) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(activity.start_date + 'T00:00:00');
  return today < start;
}

function isAfterActivity(activity) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(activity.end_date + 'T00:00:00');
  return today > end;
}

export default function AttendancePublic() {
  const { token } = useParams();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [checkedName, setCheckedName] = useState('');
  const [sessionLabel, setSessionLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!anonClient) { setError('App not configured'); setLoading(false); return; }
    async function load() {
      const { data: a } = await anonClient.from('activities').select('*').eq('att_token', token).single();
      if (!a) { setError('Activity not found'); setLoading(false); return; }
      setActivity(a);
      setSessionLabel(computeSessionDay(a));
      setLoading(false);
    }
    load();
  }, [token]);

  function fmtRange(a) {
    const s = new Date(a.start_date + 'T00:00:00');
    const e = new Date(a.end_date + 'T00:00:00');
    if (a.start_date === a.end_date) return s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '\u2013' + e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function todayStr() {
    const d = new Date();
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) { setError('Enter a valid email address.'); return; }
    setSubmitting(true);

    // Find participant
    const { data: parts } = await anonClient.from('participants').select('id, name').eq('email', trimmed);
    if (!parts?.length) { setError('No participant found with this email.'); setSubmitting(false); return; }
    const participant = parts[0];

    // Check registration
    const { data: regs } = await anonClient.from('registrations').select('id').eq('activity_id', activity.id).eq('participant_id', participant.id);
    if (!regs?.length) { setError('You are not registered for this activity.'); setSubmitting(false); return; }

    // Check if already recorded for this session (once per day)
    const { data: existing } = await anonClient.from('attendance').select('id').eq('activity_id', activity.id).eq('participant_id', participant.id).eq('session_label', sessionLabel);
    if (existing?.length) { setError('You have already checked in for today. You can only check in once per day.'); setSubmitting(false); return; }

    // Record attendance
    const { error: err } = await anonClient.from('attendance').insert({
      activity_id: activity.id, participant_id: participant.id, session_label: sessionLabel, status: 'present',
    });
    if (err) { setError(err.message); setSubmitting(false); return; }

    setCheckedName(participant.name);
    setDone(true);
    setSubmitting(false);
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', fontSize: 16, color: '#0F1B2B',
    border: '1.5px solid #E0E4E9', borderRadius: 6, background: '#FFFFFF', outline: 'none',
  };

  if (loading) return <Shell><p style={{ textAlign: 'center', color: '#7A8699' }}>Loading...</p></Shell>;
  if (error && !activity) return <Shell><p style={{ textAlign: 'center', color: '#C0362C' }}>{error}</p></Shell>;

  // Activity hasn't started yet
  if (isBeforeActivity(activity)) return (
    <Shell>
      <div style={{
        background: '#FFFFFF', border: '1px solid #E0E4E9', borderRadius: 12,
        boxShadow: '0 1px 2px rgba(0,43,84,0.06), 0 4px 16px rgba(0,43,84,0.06)',
        padding: '32px 28px', textAlign: 'center',
      }}>
        <div style={{ fontFamily: "'Merriweather', serif", fontSize: 20, fontWeight: 700, color: '#002B54' }}>
          {activity.title}
        </div>
        <p style={{ fontSize: 14, color: '#5B6B80', marginTop: 12, lineHeight: 1.6 }}>
          This activity hasn't started yet. Check-in opens on{' '}
          <strong>{new Date(activity.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.
        </p>
      </div>
    </Shell>
  );

  // Activity has ended
  if (isAfterActivity(activity)) return (
    <Shell>
      <div style={{
        background: '#FFFFFF', border: '1px solid #E0E4E9', borderRadius: 12,
        boxShadow: '0 1px 2px rgba(0,43,84,0.06), 0 4px 16px rgba(0,43,84,0.06)',
        padding: '32px 28px', textAlign: 'center',
      }}>
        <div style={{ fontFamily: "'Merriweather', serif", fontSize: 20, fontWeight: 700, color: '#002B54' }}>
          {activity.title}
        </div>
        <p style={{ fontSize: 14, color: '#5B6B80', marginTop: 12, lineHeight: 1.6 }}>
          This activity has ended. Check-in is no longer available.
        </p>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <div style={{
        background: '#FFFFFF', border: '1px solid #E0E4E9', borderRadius: 12,
        boxShadow: '0 1px 2px rgba(0,43,84,0.06), 0 4px 16px rgba(0,43,84,0.06)',
        padding: '26px 28px',
      }}>
        {!done ? (
          <>
            <div style={{ fontFamily: "'Merriweather', serif", fontSize: 20, fontWeight: 700, color: '#002B54' }}>
              {activity.title}
            </div>
            <div style={{ fontSize: 13, color: '#5B6B80', marginTop: 6 }}>
              {fmtRange(activity)} &middot; {activity.venue}
            </div>

            {/* Auto-detected day badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 999, marginTop: 14,
              background: '#E9EDF2', fontSize: 13, fontWeight: 600, color: '#002B54',
            }}>
              {sessionLabel}
              <span style={{ fontWeight: 400, color: '#5B6B80' }}>&middot; {todayStr()}</span>
            </div>

            <p style={{ fontSize: 13, color: '#5B6B80', marginTop: 14, lineHeight: 1.6 }}>
              Confirm your attendance with your registered email. You can only check in once per day.
            </p>
            <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
              <input type="email" required value={email} onChange={e => { setEmail(e.target.value); setError(null); }}
                placeholder="Your registered email" style={inputStyle} />
              {error && <p style={{ color: '#C0362C', fontSize: 13, marginTop: 8 }}>{error}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="submit" disabled={submitting} style={{
                  padding: '10px 24px', fontSize: 14, fontWeight: 600,
                  background: '#FAB72D', color: '#002B54', border: 'none', borderRadius: 8, cursor: 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}>{submitting ? 'Recording...' : 'Check in'}</button>
              </div>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 999, background: '#E4F3E9', color: '#2E7D4F',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700,
            }}>{'\u2713'}</div>
            <div style={{ fontFamily: "'Merriweather', serif", fontSize: 21, fontWeight: 700, marginTop: 14, color: '#002B54' }}>
              Attendance recorded
            </div>
            <p style={{ fontSize: 13, color: '#5B6B80', marginTop: 8, lineHeight: 1.6 }}>
              {checkedName} &mdash; {activity.title}<br />
              {sessionLabel} &middot; {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
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
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Attendance Check-in</div>
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 64px' }}>{children}</div>
      <div style={{ textAlign: 'center', padding: 16, fontSize: 11, color: '#7A8699', borderTop: '1px solid #E0E4E9' }}>
        Powered by LexAMS &middot; LexoStudio
      </div>
    </div>
  );
}
