import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock3, Copy, Edit3, Printer, QrCode as QrIcon, X } from 'lucide-react';
import QrCode from './QrCode';

function timeValue(value) { return value ? String(value).slice(0, 5) : ''; }

async function api(activityId, options = {}) {
  const response = await fetch(`/api/activity-checkin-settings/${encodeURIComponent(activityId)}`, {
    credentials: 'include',
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Could not load activity check-in settings.');
  return body;
}

function SettingsDialog({ activity, onClose, onSaved }) {
  const [form, setForm] = useState({
    daily_checkin_enabled: activity.daily_checkin_enabled !== false,
    daily_checkin_window_start: timeValue(activity.daily_checkin_window_start),
    daily_checkin_window_end: timeValue(activity.daily_checkin_window_end),
    daily_checkin_timezone: activity.daily_checkin_timezone || 'UTC',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    try {
      const result = await api(activity.id, {
        method: 'POST',
        body: JSON.stringify({ action: 'update', settings: form }),
      });
      onSaved(result.activity);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="lexdaily-backdrop" onMouseDown={e => e.target === e.currentTarget && !saving && onClose()}>
      <section className="lexdaily-modal" role="dialog" aria-modal="true" aria-labelledby="daily-checkin-settings-title">
        <div className="lexdaily-modal-head">
          <div>
            <div className="lexdaily-kicker">Daily attendance rules</div>
            <h3 id="daily-checkin-settings-title">Activity check-in settings</h3>
          </div>
          <button className="lexdaily-icon" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>
        <label className="lexdaily-toggle">
          <input type="checkbox" checked={form.daily_checkin_enabled} onChange={e => setForm({ ...form, daily_checkin_enabled: e.target.checked })} />
          <span><strong>Enable activity-wide check-in</strong><small>The same link and QR remain valid for the full activity duration.</small></span>
        </label>
        <div className="lexdaily-form-grid">
          <label><span>Daily window opens</span><input className="lx-field" type="time" value={form.daily_checkin_window_start} onChange={e => setForm({ ...form, daily_checkin_window_start: e.target.value })} /></label>
          <label><span>Daily window closes</span><input className="lx-field" type="time" value={form.daily_checkin_window_end} onChange={e => setForm({ ...form, daily_checkin_window_end: e.target.value })} /></label>
          <label className="wide"><span>Timezone</span><input className="lx-field" value={form.daily_checkin_timezone} onChange={e => setForm({ ...form, daily_checkin_timezone: e.target.value })} placeholder="Africa/Banjul" /></label>
        </div>
        <div className="lexdaily-rule-note">
          <strong>Built-in rules</strong>
          <span>Participants cannot choose a date, cannot check in before the activity starts, and cannot check in more than once on the same day.</span>
        </div>
        {error && <div className="lexdaily-error">{error}</div>}
        <div className="lexdaily-modal-actions">
          <button className="lexdaily-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="lexdaily-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save check-in window'}</button>
        </div>
      </section>
    </div>
  );
}

function Poster({ activity, link, onClose }) {
  return (
    <div className="lexdaily-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <section className="lexdaily-poster" role="dialog" aria-modal="true" aria-label="Activity check-in QR poster">
        <button className="lexdaily-poster-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="lexdaily-kicker">Activity check-in</div>
        <h2>{activity.title}</h2>
        <p>Scan this same QR on each activity day, then enter your registered name or email.</p>
        <div className="lexdaily-poster-qr"><QrCode value={link} size={260} label={`${activity.title} activity check-in QR`} /></div>
        <div className="lexdaily-poster-rules">Today only · One check-in per participant per day · Daily window enforced automatically</div>
        <div className="lexdaily-url">{link}</div>
        <button className="lexdaily-primary lexdaily-no-print" onClick={() => window.print()}><Printer size={15} /> Print poster</button>
      </section>
    </div>
  );
}

export default function ActivityWideCheckinPanel() {
  const { id } = useParams();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const result = await api(id);
      setActivity(result.activity);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, [id]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  }

  function copyLink(link) {
    navigator.clipboard?.writeText(link).then(() => notify('Activity check-in link copied')).catch(() => notify('Copy failed'));
  }

  if (loading) return <section className="lexdaily-shell lexdaily-loading">Loading activity-wide check-in…</section>;
  if (!activity) return <section className="lexdaily-shell"><div className="lexdaily-error">{error || 'Activity-wide check-in unavailable.'}</div></section>;

  const link = `${window.location.origin}/checkin/${activity.att_token}`;
  const start = timeValue(activity.daily_checkin_window_start);
  const end = timeValue(activity.daily_checkin_window_end);
  const windowLabel = start || end ? `${start || '00:00'}–${end || '23:59'}` : 'All day';

  return (
    <section className="lexdaily-shell">
      <div className="lexdaily-main">
        <div>
          <div className="lexdaily-kicker">Primary check-in method</div>
          <h2 className="lexdaily-title">One QR for the whole activity</h2>
          <p className="lexdaily-copy">Share or print this QR once. On each activity day, LexAMS automatically uses today's date, accepts a registered name or email, and rejects a second check-in for the same participant that day.</p>
          <div className="lexdaily-rules">
            <span className={`lexdaily-chip ${activity.daily_checkin_enabled ? 'live' : ''}`}>{activity.daily_checkin_enabled ? 'Enabled' : 'Disabled'}</span>
            <span className="lexdaily-chip"><Clock3 size={12} /> {windowLabel}</span>
            <span className="lexdaily-chip">{activity.daily_checkin_timezone || 'UTC'}</span>
            <span className="lexdaily-chip">Today only</span>
            <span className="lexdaily-chip">Once per day</span>
          </div>
        </div>
        <div className="lexdaily-actions">
          <button className="lexdaily-secondary" onClick={() => copyLink(link)}><Copy size={14} /> Copy link</button>
          <button className="lexdaily-primary" onClick={() => setPosterOpen(true)}><QrIcon size={14} /> QR / poster</button>
          <button className="lexdaily-secondary" onClick={() => setSettingsOpen(true)}><Edit3 size={14} /> Edit window</button>
        </div>
      </div>
      <div className="lexdaily-linkbar"><strong>Permanent check-in link</strong><code>{link}</code><button className="lexdaily-icon" onClick={() => copyLink(link)} title="Copy"><Copy size={13} /></button></div>
      {error && <div className="lexdaily-error">{error}</div>}
      {settingsOpen && <SettingsDialog activity={activity} onClose={() => setSettingsOpen(false)} onSaved={updated => { setActivity(updated); setSettingsOpen(false); notify('Activity check-in window updated'); }} />}
      {posterOpen && <Poster activity={activity} link={link} onClose={() => setPosterOpen(false)} />}
      {toast && <div className="lexdaily-toast">{toast}</div>}
    </section>
  );
}
