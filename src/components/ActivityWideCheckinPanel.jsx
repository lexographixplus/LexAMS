import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock3, Copy, Edit3, Printer, QrCode as QrIcon, X } from 'lucide-react';
import QrCode from './QrCode';

const inputStyle = {
  width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '9px 11px',
  border: '1px solid var(--border-default)', borderRadius: 9,
  background: 'var(--surface-card)', color: 'var(--text-primary)', font: 'inherit', outline: 'none',
};

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
          <div><div className="lexdaily-kicker">Daily attendance rules</div><h3 id="daily-checkin-settings-title">Activity check-in settings</h3></div>
          <button className="lexdaily-icon" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>
        <label className="lexdaily-toggle">
          <input type="checkbox" checked={form.daily_checkin_enabled} onChange={e => setForm({ ...form, daily_checkin_enabled: e.target.checked })} />
          <span><strong>Enable activity-wide check-in</strong><small>The same link and QR remain valid for the full activity duration.</small></span>
        </label>
        <div className="lexdaily-form-grid">
          <label><span>Daily window opens</span><input style={inputStyle} type="time" value={form.daily_checkin_window_start} onChange={e => setForm({ ...form, daily_checkin_window_start: e.target.value })} /></label>
          <label><span>Daily window closes</span><input style={inputStyle} type="time" value={form.daily_checkin_window_end} onChange={e => setForm({ ...form, daily_checkin_window_end: e.target.value })} /></label>
          <label className="wide"><span>Timezone</span><input style={inputStyle} value={form.daily_checkin_timezone} onChange={e => setForm({ ...form, daily_checkin_timezone: e.target.value })} placeholder="Africa/Banjul" /></label>
        </div>
        <div className="lexdaily-rule-note">
          <strong>Built-in rules</strong>
          <span>Participants cannot choose a date, cannot check in before the activity starts, and cannot check in more than once on the same day.</span>
        </div>
        {error && <div className="lexdaily-error">{error}</div>}
        <div className="lexdaily-modal-actions"><button className="lexdaily-secondary" onClick={onClose} disabled={saving}>Cancel</button><button className="lexdaily-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save check-in window'}</button></div>
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
      <style>{`
        .lexdaily-shell{max-width:1240px;margin:0 auto 18px;border:1px solid var(--border-default);border-radius:18px;background:var(--surface-card);box-shadow:0 12px 30px rgba(0,43,84,.055);overflow:hidden}.lexdaily-loading{padding:20px;color:var(--text-secondary);font-size:13px}.lexdaily-main{display:grid;grid-template-columns:1fr auto;gap:22px;align-items:center;padding:18px 20px}.lexdaily-kicker{font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;color:var(--color-navy-700)}.lexdaily-title{margin:4px 0 0;font-family:var(--font-display);font-size:20px;color:var(--color-navy-900)}.lexdaily-copy{margin:6px 0 0;max-width:720px;color:var(--text-secondary);font-size:12px;line-height:1.55}.lexdaily-rules{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.lexdaily-chip{display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border-radius:999px;background:var(--surface-muted);color:var(--text-secondary);font-size:12px;font-weight:700}.lexdaily-chip.live{background:#EAF6EE;color:#24633D}.lexdaily-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.lexdaily-primary,.lexdaily-secondary,.lexdaily-icon{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:0 12px;border-radius:9px;font-size:12px;font-weight:750;cursor:pointer}.lexdaily-primary{border:0;background:var(--color-gold-500);color:var(--color-navy-900)}.lexdaily-secondary{border:1px solid var(--border-default);background:var(--surface-card);color:var(--color-navy-700)}.lexdaily-icon{width:38px;padding:0;border:1px solid var(--border-default);background:transparent;color:var(--color-navy-700)}.lexdaily-linkbar{display:flex;align-items:center;gap:9px;padding:12px 20px;border-top:1px solid var(--border-default);background:var(--surface-muted)}.lexdaily-linkbar code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-secondary)}.lexdaily-linkbar strong{font-size:12px;color:var(--color-navy-900)}.lexdaily-error{padding:11px 13px;background:#FBEAEA;color:#A42C27;font-size:12px}.lexdaily-backdrop{position:fixed;inset:0;z-index:650;background:rgba(0,43,84,.42);display:grid;place-items:center;padding:20px;overflow-y:auto}.lexdaily-modal{width:min(620px,100%);background:var(--surface-card);border-radius:16px;padding:22px;box-shadow:0 28px 80px rgba(0,43,84,.24)}.lexdaily-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.lexdaily-modal-head h3{margin:3px 0 0;font-family:var(--font-display);font-size:21px}.lexdaily-toggle{display:flex;gap:9px;padding:12px;border:1px solid var(--border-default);border-radius:10px;margin-top:17px}.lexdaily-toggle input{margin-top:2px}.lexdaily-toggle strong,.lexdaily-toggle small{display:block}.lexdaily-toggle strong{font-size:12px}.lexdaily-toggle small{font-size:12px;color:var(--text-tertiary);margin-top:3px;line-height:1.45}.lexdaily-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.lexdaily-form-grid label>span{display:block;font-size:12px;color:var(--text-tertiary);font-weight:800;margin-bottom:5px}.lexdaily-form-grid .wide{grid-column:1/-1}.lexdaily-rule-note{margin-top:14px;padding:12px;border-radius:10px;background:#EEF3F8;color:#31516F}.lexdaily-rule-note strong,.lexdaily-rule-note span{display:block}.lexdaily-rule-note strong{font-size:12px}.lexdaily-rule-note span{font-size:12px;line-height:1.5;margin-top:3px}.lexdaily-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.lexdaily-poster{position:relative;width:min(520px,100%);background:white;border-radius:16px;padding:34px;text-align:center;color:#122033;box-shadow:0 28px 80px rgba(0,43,84,.24)}.lexdaily-poster-close{position:absolute;right:13px;top:13px;border:0;background:#EEF3F8;border-radius:8px;width:34px;height:34px;display:grid;place-items:center;color:#002B54}.lexdaily-poster h2{font-family:Georgia,serif;font-size:29px;color:#002B54;margin:8px 0}.lexdaily-poster p{color:#687587;line-height:1.55}.lexdaily-poster-qr{display:grid;place-items:center;margin:22px 0}.lexdaily-poster-rules{font-size:12px;line-height:1.6;font-weight:700;color:#31516F;background:#EEF3F8;border-radius:10px;padding:10px}.lexdaily-url{font-size:12px;color:#8A96A5;overflow-wrap:anywhere;margin:12px 0 18px}.lexdaily-toast{position:fixed;right:20px;bottom:20px;z-index:800;background:#002B54;color:white;padding:10px 14px;border-radius:9px;font-size:12px;font-weight:700;box-shadow:0 10px 28px rgba(0,43,84,.25)}@media(max-width:760px){.lexdaily-main{grid-template-columns:1fr}.lexdaily-actions{justify-content:flex-start}.lexdaily-form-grid{grid-template-columns:1fr}.lexdaily-form-grid .wide{grid-column:auto}.lexdaily-linkbar{align-items:flex-start;flex-wrap:wrap}.lexdaily-linkbar code{flex-basis:100%}}@media print{body *{visibility:hidden!important}.lexdaily-poster,.lexdaily-poster *{visibility:visible!important}.lexdaily-backdrop{position:absolute;inset:0;background:white;padding:0}.lexdaily-poster{position:absolute;left:50%;top:20px;transform:translateX(-50%);box-shadow:none;width:520px;max-width:calc(100% - 40px)}.lexdaily-no-print,.lexdaily-poster-close{display:none!important}}
      `}</style>
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
