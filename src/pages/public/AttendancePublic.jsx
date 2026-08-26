import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PublicExperienceLayout, { PublicCard, PublicNotice } from '../../components/PublicExperienceLayout';

async function checkinApi(token, options = {}) {
  const response = await fetch(`/api/public-checkin/${encodeURIComponent(token)}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Check-in could not be processed.');
  return body;
}

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

export default function AttendancePublic() {
  const { token } = useParams();
  const isKiosk = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'kiosk';
  const [data, setData] = useState(null);
  const [identity, setIdentity] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkinApi(token)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const body = await checkinApi(token, {
        method: 'POST',
        body: JSON.stringify({ identity, reference: identity, pin, source: isKiosk ? 'kiosk' : 'self' }),
      });
      setDone(body);
    } catch (e2) { setError(e2.message); }
    finally { setSubmitting(false); }
  }

  function reset() {
    setIdentity('');
    setPin('');
    setError('');
    setDone(null);
  }

  if (loading) return <PublicExperienceLayout eyebrow={isKiosk ? 'Kiosk check-in' : 'Attendance'} title="Loading check-in…" narrow />;
  if (!data) return <PublicExperienceLayout eyebrow={isKiosk ? 'Kiosk check-in' : 'Attendance'} title="Check-in unavailable" narrow><PublicNotice tone="error">{error || 'This check-in link is unavailable.'}</PublicNotice></PublicExperienceLayout>;

  const activityWide = data.mode === 'activity';
  const activity = data.activity;
  const day = data.day;
  const session = data.session;
  const pinRequired = Boolean(data.pin_required);
  const checkinOpen = activityWide ? Boolean(day?.checkin_open) : Boolean(session?.checkin_open);
  const message = activityWide ? day?.checkin_message : session?.checkin_message;
  const activityWindow = activityWide
    ? [fmtTime(day?.window_start), fmtTime(day?.window_end)].filter(Boolean).join('–')
    : '';
  const sessionTime = !activityWide
    ? [fmtTime(session?.starts_at), fmtTime(session?.ends_at)].filter(Boolean).join('–')
    : '';

  const description = activityWide
    ? `${fmtDate(day?.date)} · Day ${day?.day_number || 1}${activity.venue ? ` · ${activity.venue}` : ''}`
    : `${session?.title || 'Session'} · ${fmtDate(session?.session_date)}${sessionTime ? ` · ${sessionTime}` : ''}${activity.venue ? ` · ${activity.venue}` : ''}`;

  const inputLabel = activityWide
    ? (isKiosk ? 'Name, email, registration reference or pass' : 'Full name or registered email')
    : 'Registration reference or pass code';
  const inputPlaceholder = activityWide
    ? (isKiosk ? 'Name, email, REG-… or PASS:…' : 'Enter your full name or email')
    : 'REG-XXXXXXXXXX';

  return (
    <PublicExperienceLayout
      eyebrow={isKiosk ? 'Venue kiosk check-in' : activityWide ? 'Activity check-in' : 'Session check-in'}
      title={activity.title}
      description={description}
      organizationName={activity.organization_name}
      organizationLogo={activity.organization_logo}
      narrow
    >
      <PublicCard style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#002B54', fontWeight: 800, fontSize: 17 }}>
              {activityWide ? `Day ${day?.day_number || 1} check-in` : session?.title}
            </div>
            <div style={{ color: '#687587', fontSize: 13, marginTop: 5 }}>
              {activityWide ? fmtDate(day?.date) : fmtDate(session?.session_date)}
              {activityWide && activityWindow ? ` · ${activityWindow}` : ''}
              {!activityWide && sessionTime ? ` · ${sessionTime}` : ''}
            </div>
            {activityWide && <div style={{ color: '#8A96A5', fontSize: 11, marginTop: 5 }}>Same activity QR every day · timezone {day?.timezone || 'UTC'}</div>}
          </div>
          <span style={{ padding: '6px 10px', borderRadius: 999, flexShrink: 0, background: checkinOpen ? '#EAF6EE' : '#F3F4F6', color: checkinOpen ? '#24633D' : '#687587', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{checkinOpen ? 'Check-in open' : 'Closed'}</span>
        </div>
        {activityWide && <PublicNotice>LexAMS automatically records attendance for today only. A participant can check in once per calendar day.</PublicNotice>}
        {!checkinOpen && <PublicNotice tone="error">{message || 'Check-in is not currently open.'}</PublicNotice>}
      </PublicCard>

      <PublicCard>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, margin: '0 auto 12px', borderRadius: 999, display: 'grid', placeItems: 'center', background: '#EAF6EE', color: '#24633D', fontSize: 25, fontWeight: 900 }}>✓</div>
            <h3>{done.state === 'already' ? (activityWide ? 'Already checked in today' : 'Already checked in') : 'Attendance recorded'}</h3>
            <p style={{ color: '#687587' }}>{done.name}{activityWide ? ` · ${fmtDate(done.day || day?.date)}` : ` · ${done.session}`}</p>
            <PublicNotice tone="success">Status: <strong style={{ textTransform: 'capitalize' }}>{done.status}</strong>{!activityWide && done.status === 'late' ? ` · Recorded after the ${session?.grace_minutes || 0}-minute grace period` : ''}</PublicNotice>
            <div className="lex-public-actions" style={{ justifyContent: 'center' }}><button className="lex-public-button ghost" onClick={reset}>{isKiosk ? 'Check in next participant' : 'Check in another participant'}</button></div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3>{activityWide ? 'Check in for today' : isKiosk ? 'Scan or enter participant pass' : 'Confirm your attendance'}</h3>
            <p style={{ color: '#687587', lineHeight: 1.65 }}>
              {activityWide
                ? 'Enter the full name or email address used for registration. If more than one participant has the same name, LexAMS will ask for the registered email instead.'
                : isKiosk
                  ? 'Scan a LexAMS participant pass with a connected QR scanner, or enter the registration reference.'
                  : 'Use the registration reference from your confirmation email or your participant pass.'}
            </p>
            <label className="lex-public-label" htmlFor="checkin-identity">{inputLabel}</label>
            <input id="checkin-identity" className="lex-public-input" autoFocus={isKiosk} required value={identity} onChange={e => setIdentity(e.target.value)} placeholder={inputPlaceholder} autoComplete={activityWide ? 'email' : 'off'} />
            {pinRequired && (
              <label style={{ display: 'block', marginTop: 14 }}>
                <span className="lex-public-label">Session PIN</span>
                <input className="lex-public-input" inputMode="numeric" pattern="[0-9]*" required value={pin} onChange={e => setPin(e.target.value)} placeholder="Enter the PIN shown at the venue" autoComplete="one-time-code" />
              </label>
            )}
            {error && <PublicNotice tone="error">{error}</PublicNotice>}
            <div className="lex-public-actions"><button className="lex-public-button" disabled={submitting || !checkinOpen}>{submitting ? 'Recording…' : 'Check in'}</button></div>
          </form>
        )}
      </PublicCard>
    </PublicExperienceLayout>
  );
}
