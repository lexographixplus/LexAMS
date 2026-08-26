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
  const [reference, setReference] = useState('');
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
        body: JSON.stringify({ reference, pin, source: isKiosk ? 'kiosk' : 'self' }),
      });
      setDone(body);
    } catch (e2) { setError(e2.message); }
    finally { setSubmitting(false); }
  }

  function reset() {
    setReference('');
    setPin('');
    setError('');
    setDone(null);
  }

  if (loading) return <PublicExperienceLayout eyebrow={isKiosk ? 'Kiosk check-in' : 'Attendance'} title="Loading check-in…" narrow />;
  if (!data) return <PublicExperienceLayout eyebrow={isKiosk ? 'Kiosk check-in' : 'Attendance'} title="Check-in unavailable" narrow><PublicNotice tone="error">{error || 'This check-in link is unavailable.'}</PublicNotice></PublicExperienceLayout>;

  const { activity, session, pin_required: pinRequired } = data;
  const time = [fmtTime(session.starts_at), fmtTime(session.ends_at)].filter(Boolean).join('–');
  return (
    <PublicExperienceLayout
      eyebrow={isKiosk ? 'Venue kiosk check-in' : 'Session check-in'}
      title={activity.title}
      description={`${session.title} · ${fmtDate(session.session_date)}${time ? ` · ${time}` : ''}${activity.venue ? ` · ${activity.venue}` : ''}`}
      organizationName={activity.organization_name}
      organizationLogo={activity.organization_logo}
      narrow
    >
      <PublicCard style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#002B54', fontWeight: 800, fontSize: 17 }}>{session.title}</div>
            <div style={{ color: '#687587', fontSize: 13, marginTop: 5 }}>{fmtDate(session.session_date)}{time ? ` · ${time}` : ''}</div>
          </div>
          <span style={{ padding: '6px 10px', borderRadius: 999, flexShrink: 0, background: session.checkin_open ? '#EAF6EE' : '#F3F4F6', color: session.checkin_open ? '#24633D' : '#687587', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{session.checkin_open ? 'Check-in open' : session.status}</span>
        </div>
        {!session.checkin_open && <PublicNotice tone="error">{session.checkin_message || 'Check-in is not currently open.'}</PublicNotice>}
      </PublicCard>

      <PublicCard>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, margin: '0 auto 12px', borderRadius: 999, display: 'grid', placeItems: 'center', background: '#EAF6EE', color: '#24633D', fontSize: 25, fontWeight: 900 }}>✓</div>
            <h3>{done.state === 'already' ? 'Already checked in' : 'Attendance recorded'}</h3>
            <p style={{ color: '#687587' }}>{done.name} · {done.session}</p>
            <PublicNotice tone="success">Status: <strong style={{ textTransform: 'capitalize' }}>{done.status}</strong>{done.status === 'late' ? ` · Recorded after the ${session.grace_minutes || 0}-minute grace period` : ''}</PublicNotice>
            <div className="lex-public-actions" style={{ justifyContent: 'center' }}><button className="lex-public-button ghost" onClick={reset}>{isKiosk ? 'Check in next participant' : 'Check in another participant'}</button></div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3>{isKiosk ? 'Scan or enter participant pass' : 'Confirm your attendance'}</h3>
            <p style={{ color: '#687587', lineHeight: 1.65 }}>{isKiosk ? 'Scan a LexAMS participant pass with a connected QR scanner, or enter the registration reference.' : 'Use the registration reference from your confirmation email. Email address alone is not accepted for self check-in.'}</p>
            <label className="lex-public-label" htmlFor="checkin-reference">Registration reference or pass code</label>
            <input id="checkin-reference" className="lex-public-input" autoFocus={isKiosk} required value={reference} onChange={e => setReference(e.target.value)} placeholder={isKiosk ? 'PASS:… or REG-…' : 'REG-XXXXXXXXXX'} autoCapitalize="characters" autoComplete="off" />
            {pinRequired && (
              <label style={{ display: 'block', marginTop: 14 }}>
                <span className="lex-public-label">Session PIN</span>
                <input className="lex-public-input" inputMode="numeric" pattern="[0-9]*" required value={pin} onChange={e => setPin(e.target.value)} placeholder="Enter the PIN shown at the venue" autoComplete="one-time-code" />
              </label>
            )}
            {error && <PublicNotice tone="error">{error}</PublicNotice>}
            <div className="lex-public-actions"><button className="lex-public-button" disabled={submitting || !session.checkin_open}>{submitting ? 'Recording…' : 'Check in'}</button></div>
          </form>
        )}
      </PublicCard>
    </PublicExperienceLayout>
  );
}
