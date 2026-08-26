import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Clipboard, Clock3, Copy, Edit3, Link2, Plus, Printer, QrCode as QrIcon, RotateCcw, Search, Settings2, UserCheck, Users, WifiOff, X } from 'lucide-react';
import QrCode from './QrCode';

const inputStyle = {
  width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '9px 11px',
  border: '1px solid var(--border-default)', borderRadius: 9,
  background: 'var(--surface-card)', color: 'var(--text-primary)', font: 'inherit', outline: 'none',
};

function dateValue(value) { return value ? String(value).slice(0, 10) : ''; }
function timeValue(value) { return value ? String(value).slice(0, 5) : ''; }
function dtLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatSessionDate(value) {
  if (!value) return '';
  const d = new Date(`${dateValue(value)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dateValue(value) : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

async function api(activityId, options = {}) {
  const response = await fetch(`/api/activity-operations/${encodeURIComponent(activityId)}`, {
    credentials: 'include',
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Activity operation failed.');
  return body;
}

function StatusBadge({ status }) {
  const palette = status === 'open' || status === 'confirmed' || status === 'present'
    ? ['#EAF6EE', '#24633D']
    : status === 'late' || status === 'waitlisted' || status === 'pending'
      ? ['#FFF6DF', '#8A5A00']
      : status === 'closed' || status === 'absent' || status === 'cancelled'
        ? ['#FBEAEA', '#A42C27']
        : ['#EEF3F8', '#31516F'];
  return <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, padding: '0 8px', borderRadius: 999, background: palette[0], color: palette[1], fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{status}</span>;
}

function Poster({ poster, onClose }) {
  if (!poster) return null;
  return (
    <div className="lexops-poster-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <section className="lexops-poster" role="dialog" aria-modal="true" aria-label="Printable QR poster">
        <button className="lexops-poster-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="lexops-print-kicker">{poster.kicker}</div>
        <h2>{poster.title}</h2>
        <p>{poster.subtitle}</p>
        <div className="lexops-poster-qr"><QrCode value={poster.value} size={260} label={`${poster.kicker} QR code`} /></div>
        {poster.pin && <div className="lexops-poster-pin"><span>Check-in PIN</span><strong>{poster.pin}</strong></div>}
        <div className="lexops-poster-url">{poster.value}</div>
        <button className="lexops-primary lexops-no-print" onClick={() => window.print()}><Printer size={15} /> Print poster</button>
      </section>
    </div>
  );
}

function SessionDialog({ initial, defaultDate, onClose, onSave, saving }) {
  const [form, setForm] = useState(() => ({
    id: initial?.id || null,
    title: initial?.title || '',
    session_date: dateValue(initial?.session_date) || defaultDate || '',
    starts_at: timeValue(initial?.starts_at),
    ends_at: timeValue(initial?.ends_at),
    checkin_pin: initial?.checkin_pin || '',
    grace_minutes: initial?.grace_minutes ?? 15,
    checkin_open_at: dtLocal(initial?.checkin_open_at),
    checkin_close_at: dtLocal(initial?.checkin_close_at),
  }));
  return (
    <div className="lexops-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && !saving && onClose()}>
      <section className="lexops-modal" role="dialog" aria-modal="true">
        <div className="lexops-modal-head"><div><div className="lexops-kicker">Activity session</div><h3>{initial ? 'Edit session' : 'Add session'}</h3></div><button className="lexops-icon" onClick={onClose}><X size={17} /></button></div>
        <div className="lexops-form-grid">
          <label className="wide"><span>Session title</span><input style={inputStyle} required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Morning workshop" /></label>
          <label><span>Date</span><input style={inputStyle} type="date" value={form.session_date} onChange={e => setForm({ ...form, session_date: e.target.value })} /></label>
          <label><span>Grace period (minutes)</span><input style={inputStyle} type="number" min="0" max="240" value={form.grace_minutes} onChange={e => setForm({ ...form, grace_minutes: e.target.value })} /></label>
          <label><span>Starts</span><input style={inputStyle} type="time" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></label>
          <label><span>Ends</span><input style={inputStyle} type="time" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></label>
          <label><span>Optional check-in PIN</span><input style={inputStyle} inputMode="numeric" pattern="[0-9]*" value={form.checkin_pin} onChange={e => setForm({ ...form, checkin_pin: e.target.value })} placeholder="4–8 digits" /></label>
          <div />
          <label><span>Window opens</span><input style={inputStyle} type="datetime-local" value={form.checkin_open_at} onChange={e => setForm({ ...form, checkin_open_at: e.target.value })} /></label>
          <label><span>Window closes</span><input style={inputStyle} type="datetime-local" value={form.checkin_close_at} onChange={e => setForm({ ...form, checkin_close_at: e.target.value })} /></label>
        </div>
        <div className="lexops-modal-actions"><button className="lexops-secondary" onClick={onClose} disabled={saving}>Cancel</button><button className="lexops-primary" onClick={() => onSave(form)} disabled={saving || !form.title || !form.session_date}>{saving ? 'Saving…' : 'Save session'}</button></div>
      </section>
    </div>
  );
}

function SettingsDialog({ activity, onClose, onSave, saving }) {
  const [form, setForm] = useState(() => ({
    reg_open: activity.reg_open !== false,
    registration_capacity: activity.registration_capacity ?? '',
    waitlist_enabled: Boolean(activity.waitlist_enabled),
    registration_opens_at: dtLocal(activity.registration_opens_at),
    registration_closes_at: dtLocal(activity.registration_closes_at),
    registration_approval_required: Boolean(activity.registration_approval_required),
    registration_confirmation_email: activity.registration_confirmation_email !== false,
    registration_confirmation_message: activity.registration_confirmation_message || '',
    registration_custom_fields: Array.isArray(activity.registration_custom_fields) ? activity.registration_custom_fields : [],
  }));

  function addField() {
    setForm(prev => ({ ...prev, registration_custom_fields: [...prev.registration_custom_fields, { id: `field_${Date.now()}`, label: '', type: 'text', required: false, options: [] }] }));
  }
  function updateField(index, patch) {
    setForm(prev => ({ ...prev, registration_custom_fields: prev.registration_custom_fields.map((field, i) => i === index ? { ...field, ...patch } : field) }));
  }
  function removeField(index) {
    setForm(prev => ({ ...prev, registration_custom_fields: prev.registration_custom_fields.filter((_, i) => i !== index) }));
  }

  return (
    <div className="lexops-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && !saving && onClose()}>
      <section className="lexops-modal lexops-modal-large" role="dialog" aria-modal="true">
        <div className="lexops-modal-head"><div><div className="lexops-kicker">Registration controls</div><h3>Registration settings</h3></div><button className="lexops-icon" onClick={onClose}><X size={17} /></button></div>
        <div className="lexops-settings-grid">
          <label className="lexops-toggle"><input type="checkbox" checked={form.reg_open} onChange={e => setForm({ ...form, reg_open: e.target.checked })} /><span><strong>Registration open</strong><small>Master switch for the public form.</small></span></label>
          <label className="lexops-toggle"><input type="checkbox" checked={form.waitlist_enabled} onChange={e => setForm({ ...form, waitlist_enabled: e.target.checked })} /><span><strong>Enable waitlist</strong><small>Use when capacity is reached.</small></span></label>
          <label className="lexops-toggle"><input type="checkbox" checked={form.registration_approval_required} onChange={e => setForm({ ...form, registration_approval_required: e.target.checked })} /><span><strong>Require approval</strong><small>New registrations remain pending.</small></span></label>
          <label className="lexops-toggle"><input type="checkbox" checked={form.registration_confirmation_email} onChange={e => setForm({ ...form, registration_confirmation_email: e.target.checked })} /><span><strong>Email confirmations</strong><small>Send branded registration messages.</small></span></label>
        </div>
        <div className="lexops-form-grid" style={{ marginTop: 18 }}>
          <label><span>Capacity</span><input style={inputStyle} type="number" min="1" value={form.registration_capacity} onChange={e => setForm({ ...form, registration_capacity: e.target.value })} placeholder="Unlimited" /></label>
          <div />
          <label><span>Registration opens</span><input style={inputStyle} type="datetime-local" value={form.registration_opens_at} onChange={e => setForm({ ...form, registration_opens_at: e.target.value })} /></label>
          <label><span>Registration closes</span><input style={inputStyle} type="datetime-local" value={form.registration_closes_at} onChange={e => setForm({ ...form, registration_closes_at: e.target.value })} /></label>
          <label className="wide"><span>Confirmation message</span><textarea style={{ ...inputStyle, minHeight: 92, resize: 'vertical' }} value={form.registration_confirmation_message} onChange={e => setForm({ ...form, registration_confirmation_message: e.target.value })} placeholder="Optional instructions shown in the confirmation email." /></label>
        </div>

        <div className="lexops-custom-head"><div><strong>Custom registration fields</strong><small>Up to 20 additional questions.</small></div><button className="lexops-secondary" onClick={addField}><Plus size={14} /> Add field</button></div>
        <div className="lexops-custom-list">
          {form.registration_custom_fields.map((field, index) => (
            <div className="lexops-custom-row" key={field.id || index}>
              <input style={inputStyle} value={field.label || ''} onChange={e => updateField(index, { label: e.target.value })} placeholder="Question label" />
              <select style={inputStyle} value={field.type || 'text'} onChange={e => updateField(index, { type: e.target.value })}><option value="text">Short text</option><option value="textarea">Long text</option><option value="select">Select</option><option value="checkbox">Checkbox</option></select>
              <label className="lexops-inline-check"><input type="checkbox" checked={Boolean(field.required)} onChange={e => updateField(index, { required: e.target.checked })} /> Required</label>
              <button className="lexops-icon" onClick={() => removeField(index)} aria-label="Remove field"><X size={16} /></button>
              {field.type === 'select' && <input className="wide" style={inputStyle} value={(field.options || []).join(', ')} onChange={e => updateField(index, { options: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })} placeholder="Options separated by commas" />}
            </div>
          ))}
          {!form.registration_custom_fields.length && <div className="lexops-empty-small">No custom fields. The standard name, email, phone, organisation and category fields remain available.</div>}
        </div>
        <div className="lexops-modal-actions"><button className="lexops-secondary" onClick={onClose} disabled={saving}>Cancel</button><button className="lexops-primary" onClick={() => onSave(form)} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button></div>
      </section>
    </div>
  );
}

export default function ActivityOperationsPanel() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [query, setQuery] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState('all');
  const [registrationFilter, setRegistrationFilter] = useState('confirmed');
  const [sessionDialog, setSessionDialog] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [poster, setPoster] = useState(null);
  const [saving, setSaving] = useState(false);
  const [queue, setQueue] = useState([]);
  const scanRef = useRef(null);

  const queueKey = `lexams-checkin-queue:${id}`;
  const registrationLink = data ? `${window.location.origin}/register/${data.activity.reg_token}` : '';

  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    try {
      const next = await api(id);
      setData(next);
      setSelectedSessionId(current => current && next.sessions.some(session => String(session.id) === String(current)) ? current : next.sessions.find(session => session.status === 'open')?.id || next.sessions[0]?.id || null);
      setError('');
    } catch (e) { setError(e.message); }
    finally { if (!silent) setLoading(false); }
  }

  useEffect(() => { refresh(); }, [id]);
  useEffect(() => {
    try { setQueue(JSON.parse(localStorage.getItem(queueKey) || '[]')); } catch { setQueue([]); }
  }, [queueKey]);
  useEffect(() => { localStorage.setItem(queueKey, JSON.stringify(queue)); }, [queue, queueKey]);
  useEffect(() => {
    const onOnline = () => flushQueue();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  });

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }

  async function mutate(action, payload = {}, message = '') {
    setSaving(true);
    try {
      await api(id, { method: 'POST', body: JSON.stringify({ action, ...payload }) });
      await refresh(true);
      if (message) notify(message);
      return true;
    } catch (e) { setError(e.message); return false; }
    finally { setSaving(false); }
  }

  async function saveSession(form) {
    const action = form.id ? 'update_session' : 'create_session';
    const ok = await mutate(action, { session: form }, form.id ? 'Session updated' : 'Session created');
    if (ok) setSessionDialog(null);
  }

  async function saveSettings(settings) {
    const ok = await mutate('update_registration_settings', { settings }, 'Registration settings updated');
    if (ok) setSettingsOpen(false);
  }

  async function setAttendance(participantId, status) {
    const payload = { action: 'staff_attendance', sessionId: selectedSessionId, participantId, status };
    try {
      await api(id, { method: 'POST', body: JSON.stringify(payload) });
      await refresh(true);
      notify(`Attendance marked ${status}`);
    } catch (e) {
      if (!navigator.onLine || /fetch|network|load/i.test(e.message || '')) {
        const item = { id: `${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString(), payload };
        setQueue(prev => [...prev, item]);
        notify('Offline: attendance queued');
      } else setError(e.message);
    }
  }

  async function flushQueue() {
    if (!queue.length || !navigator.onLine) return;
    const remaining = [];
    let sent = 0;
    for (const item of queue) {
      try { await api(id, { method: 'POST', body: JSON.stringify(item.payload) }); sent += 1; }
      catch { remaining.push(item); }
    }
    setQueue(remaining);
    if (sent) { await refresh(true); notify(`${sent} queued check-in${sent === 1 ? '' : 's'} synced`); }
  }

  function copy(text, label) {
    navigator.clipboard?.writeText(text).then(() => notify(`${label} copied`)).catch(() => notify('Copy failed'));
  }

  if (loading) return <section className="lexops-shell lexops-loading">Loading registration & check-in operations…</section>;
  if (!data) return <section className="lexops-shell"><div className="lexops-error">{error || 'Operations workspace unavailable.'}</div></section>;

  const { activity, sessions, registrations, attendance } = data;
  const selectedSession = sessions.find(session => String(session.id) === String(selectedSessionId)) || null;
  const checkinLink = selectedSession ? `${window.location.origin}/checkin/${selectedSession.checkin_token}` : '';
  const confirmed = registrations.filter(reg => reg.status === 'confirmed');
  const pending = registrations.filter(reg => reg.status === 'pending');
  const waitlisted = registrations.filter(reg => reg.status === 'waitlisted');
  const cancelled = registrations.filter(reg => reg.status === 'cancelled');
  const sessionAttendance = selectedSession ? attendance.filter(rec => String(rec.session_id) === String(selectedSession.id) || rec.session_label === selectedSession.title) : [];
  const statusFor = participantId => sessionAttendance.find(rec => String(rec.participant_id) === String(participantId))?.status || 'unmarked';
  const stats = {
    present: confirmed.filter(reg => statusFor(reg.participant_id) === 'present').length,
    late: confirmed.filter(reg => statusFor(reg.participant_id) === 'late').length,
    absent: confirmed.filter(reg => statusFor(reg.participant_id) === 'absent').length,
  };
  stats.unmarked = Math.max(0, confirmed.length - stats.present - stats.late - stats.absent);

  const visibleParticipants = confirmed.filter(reg => {
    const text = `${reg.name} ${reg.email} ${reg.org || ''} ${reg.reference_code}`.toLowerCase();
    if (query && !text.includes(query.toLowerCase())) return false;
    const status = statusFor(reg.participant_id);
    if (attendanceFilter === 'not_checked' && status !== 'unmarked') return false;
    if (!['all', 'not_checked'].includes(attendanceFilter) && status !== attendanceFilter) return false;
    return true;
  });

  const registrationRows = registrationFilter === 'pending' ? pending : registrationFilter === 'waitlisted' ? waitlisted : registrationFilter === 'cancelled' ? cancelled : confirmed;
  const capacity = Number(activity.registration_capacity || 0);
  const capacityUsed = confirmed.length + pending.length;

  function processScan(value) {
    const raw = String(value || '').trim();
    if (!raw || !selectedSession) return;
    const pass = raw.toLowerCase().startsWith('pass:') ? raw.slice(5).trim() : raw;
    const match = confirmed.find(reg => String(reg.pass_token).toLowerCase() === pass.toLowerCase() || String(reg.reference_code).toLowerCase() === raw.toLowerCase());
    if (!match) { notify('No confirmed registration matches that pass'); return; }
    setAttendance(match.participant_id, 'present');
    if (scanRef.current) scanRef.current.value = '';
  }

  return (
    <section className="lexops-shell">
      <style>{`
        .lexops-shell{max-width:1240px;margin:0 auto 22px;border:1px solid var(--border-default);border-radius:18px;background:var(--surface-card);box-shadow:0 14px 36px rgba(0,43,84,.06);overflow:hidden}.lexops-loading{padding:24px;color:var(--text-secondary);font-size:13px}.lexops-head{padding:18px 20px;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;background:linear-gradient(135deg,#002B54,#0E4C8F);color:white;border-bottom:4px solid #FAB72D}.lexops-head h2{margin:2px 0 0;font-family:var(--font-display);font-size:21px}.lexops-kicker{font-size:10px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;opacity:.72}.lexops-head-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.lexops-head button{border-color:rgba(255,255,255,.28)!important;color:white!important;background:rgba(255,255,255,.08)!important}.lexops-primary,.lexops-secondary,.lexops-icon{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:0 12px;border-radius:9px;font-size:12px;font-weight:750;cursor:pointer}.lexops-primary{border:0;background:var(--color-gold-500);color:var(--color-navy-900)}.lexops-secondary{border:1px solid var(--border-default);background:var(--surface-card);color:var(--color-navy-700)}.lexops-icon{width:38px;padding:0;border:1px solid var(--border-default);background:transparent;color:var(--color-navy-700)}.lexops-summary{display:grid;grid-template-columns:repeat(5,1fr);border-bottom:1px solid var(--border-default)}.lexops-summary>div{padding:14px 16px;border-right:1px solid var(--border-default)}.lexops-summary>div:last-child{border-right:0}.lexops-summary span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);font-weight:800}.lexops-summary strong{display:block;margin-top:5px;font-family:var(--font-display);font-size:20px;color:var(--color-navy-900)}.lexops-body{padding:18px;display:grid;gap:18px}.lexops-section{border:1px solid var(--border-default);border-radius:13px;overflow:hidden}.lexops-section-head{padding:13px 15px;display:flex;justify-content:space-between;gap:12px;align-items:center;border-bottom:1px solid var(--border-default);background:var(--surface-muted)}.lexops-section-head h3{font-size:13px;margin:0;color:var(--color-navy-900)}.lexops-section-head p{font-size:11px;margin:3px 0 0;color:var(--text-tertiary)}.lexops-sessions{display:flex;gap:9px;padding:12px;overflow-x:auto}.lexops-session-card{min-width:190px;text-align:left;padding:12px;border:1px solid var(--border-default);border-radius:10px;background:var(--surface-card);cursor:pointer}.lexops-session-card.active{border-color:var(--color-navy-700);box-shadow:0 0 0 2px rgba(14,76,143,.08)}.lexops-session-title{font-weight:800;font-size:12px;color:var(--text-primary)}.lexops-session-meta{font-size:10px;color:var(--text-tertiary);margin-top:5px}.lexops-session-foot{display:flex;justify-content:space-between;align-items:center;margin-top:10px}.lexops-live-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:16px;padding:15px}.lexops-live-left{min-width:0}.lexops-tools{display:grid;grid-template-columns:minmax(220px,1fr) 150px;gap:8px;margin-bottom:10px}.lexops-search{position:relative}.lexops-search svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text-tertiary)}.lexops-search input{padding-left:34px!important}.lexops-filter-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.lexops-filter-row button{border:1px solid var(--border-default);background:var(--surface-card);border-radius:999px;padding:6px 9px;font-size:10px;font-weight:750;color:var(--text-secondary);cursor:pointer}.lexops-filter-row button.active{background:var(--color-navy-900);color:white;border-color:var(--color-navy-900)}.lexops-roster{border:1px solid var(--border-default);border-radius:10px;overflow:hidden;max-height:430px;overflow-y:auto}.lexops-person{display:grid;grid-template-columns:minmax(180px,1.5fr) .8fr auto;gap:10px;align-items:center;padding:10px 11px;border-bottom:1px solid var(--border-default)}.lexops-person:last-child{border-bottom:0}.lexops-person-name{font-size:12px;font-weight:800}.lexops-person-meta{font-size:10px;color:var(--text-tertiary);margin-top:3px}.lexops-status-actions{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.lexops-status-actions button{border:1px solid var(--border-default);border-radius:7px;background:var(--surface-card);padding:5px 7px;font-size:9px;font-weight:800;cursor:pointer;color:var(--text-secondary)}.lexops-status-actions button.selected{background:var(--color-navy-900);border-color:var(--color-navy-900);color:white}.lexops-live-side{border-left:1px solid var(--border-default);padding-left:16px}.lexops-qr-wrap{display:grid;justify-items:center;gap:9px}.lexops-linkbox{display:flex;align-items:center;gap:7px;width:100%;border:1px solid var(--border-default);background:var(--surface-muted);border-radius:8px;padding:7px 8px;box-sizing:border-box}.lexops-linkbox span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;color:var(--text-tertiary)}.lexops-side-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;width:100%}.lexops-pin{padding:10px;border-radius:9px;background:#FFF6DF;text-align:center}.lexops-pin span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#8A5A00;font-weight:800}.lexops-pin strong{display:block;margin-top:3px;font-size:21px;color:#6B4300;letter-spacing:.08em}.lexops-scan{margin-top:12px}.lexops-scan label{display:block;font-size:10px;font-weight:800;color:var(--text-tertiary);margin-bottom:5px}.lexops-reg-tabs{display:flex;gap:6px}.lexops-reg-list{padding:0}.lexops-reg-row{display:grid;grid-template-columns:minmax(190px,1fr) 130px 110px auto;gap:12px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border-default)}.lexops-reg-row:last-child{border-bottom:0}.lexops-reg-actions{display:flex;gap:5px;justify-content:flex-end}.lexops-empty-small{padding:18px;color:var(--text-tertiary);font-size:11px;text-align:center}.lexops-error{padding:12px 14px;background:#FBEAEA;color:#A42C27;font-size:12px}.lexops-queue{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;background:#FFF6DF;color:#8A5A00;font-size:10px;font-weight:800;cursor:pointer;border:0}.lexops-modal-backdrop,.lexops-poster-backdrop{position:fixed;inset:0;z-index:500;background:rgba(0,43,84,.42);display:grid;place-items:center;padding:20px;overflow-y:auto}.lexops-modal{width:min(680px,100%);max-height:90vh;overflow:auto;background:var(--surface-card);border-radius:16px;box-shadow:0 28px 80px rgba(0,43,84,.24);padding:22px}.lexops-modal-large{width:min(820px,100%)}.lexops-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.lexops-modal-head h3{margin:3px 0 0;font-family:var(--font-display);font-size:21px}.lexops-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:17px}.lexops-form-grid label>span,.lexops-custom-row+span{display:block;font-size:10px;color:var(--text-tertiary);font-weight:800;margin-bottom:5px}.lexops-form-grid .wide{grid-column:1/-1}.lexops-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}.lexops-settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:17px}.lexops-toggle{display:flex;gap:9px;padding:11px;border:1px solid var(--border-default);border-radius:9px}.lexops-toggle input{margin-top:2px}.lexops-toggle strong,.lexops-toggle small{display:block}.lexops-toggle strong{font-size:11px}.lexops-toggle small{font-size:9px;color:var(--text-tertiary);margin-top:3px;line-height:1.4}.lexops-custom-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:20px}.lexops-custom-head strong,.lexops-custom-head small{display:block}.lexops-custom-head strong{font-size:12px}.lexops-custom-head small{font-size:9px;color:var(--text-tertiary);margin-top:2px}.lexops-custom-list{display:grid;gap:8px;margin-top:9px}.lexops-custom-row{display:grid;grid-template-columns:1.5fr .8fr auto auto;gap:7px;align-items:center}.lexops-custom-row .wide{grid-column:1/-1}.lexops-inline-check{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text-secondary)}.lexops-poster{position:relative;width:min(520px,100%);background:white;border-radius:16px;padding:34px;text-align:center;color:#122033;box-shadow:0 28px 80px rgba(0,43,84,.24)}.lexops-poster-close{position:absolute;right:13px;top:13px;border:0;background:#EEF3F8;border-radius:8px;width:34px;height:34px;display:grid;place-items:center;color:#002B54}.lexops-print-kicker{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#0E4C8F;font-weight:900}.lexops-poster h2{font-family:Georgia,serif;font-size:29px;color:#002B54;margin:8px 0}.lexops-poster p{color:#687587;line-height:1.55}.lexops-poster-qr{display:grid;place-items:center;margin:22px 0}.lexops-poster-pin{display:inline-block;background:#FFF6DF;padding:9px 18px;border-radius:10px;margin-bottom:12px}.lexops-poster-pin span{display:block;font-size:9px;text-transform:uppercase;color:#8A5A00;font-weight:800}.lexops-poster-pin strong{display:block;font-size:24px;color:#6B4300;letter-spacing:.1em}.lexops-poster-url{font-size:9px;color:#8A96A5;overflow-wrap:anywhere;margin:8px 0 18px}.lexops-toast{position:fixed;right:20px;bottom:20px;z-index:800;background:#002B54;color:white;padding:10px 14px;border-radius:9px;font-size:11px;font-weight:700;box-shadow:0 10px 28px rgba(0,43,84,.25)}@media(max-width:900px){.lexops-summary{grid-template-columns:repeat(3,1fr)}.lexops-live-grid{grid-template-columns:1fr}.lexops-live-side{border-left:0;border-top:1px solid var(--border-default);padding:16px 0 0}.lexops-reg-row{grid-template-columns:1fr 1fr}.lexops-reg-actions{justify-content:flex-start}}@media(max-width:620px){.lexops-head{flex-direction:column}.lexops-head-actions{justify-content:flex-start}.lexops-summary{grid-template-columns:1fr 1fr}.lexops-summary>div{border-bottom:1px solid var(--border-default)}.lexops-tools{grid-template-columns:1fr}.lexops-person{grid-template-columns:1fr}.lexops-status-actions{justify-content:flex-start}.lexops-reg-row{grid-template-columns:1fr}.lexops-form-grid,.lexops-settings-grid{grid-template-columns:1fr}.lexops-form-grid .wide{grid-column:auto}.lexops-custom-row{grid-template-columns:1fr}.lexops-custom-row .wide{grid-column:auto}}@media print{body *{visibility:hidden!important}.lexops-poster,.lexops-poster *{visibility:visible!important}.lexops-poster-backdrop{position:absolute;inset:0;background:white;padding:0}.lexops-poster{position:absolute;left:50%;top:20px;transform:translateX(-50%);box-shadow:none;width:520px;max-width:calc(100% - 40px)}.lexops-no-print,.lexops-poster-close{display:none!important}}
      `}</style>

      <header className="lexops-head">
        <div><div className="lexops-kicker">Registration & check-in V2</div><h2>Live activity operations</h2></div>
        <div className="lexops-head-actions">
          {queue.length > 0 && <button className="lexops-queue" onClick={flushQueue}><WifiOff size={13} /> {queue.length} queued · sync</button>}
          <button className="lexops-secondary" onClick={() => copy(registrationLink, 'Registration link')}><Copy size={14} /> Registration link</button>
          <button className="lexops-secondary" onClick={() => setPoster({ kicker: 'Activity registration', title: activity.title, subtitle: 'Scan to register for this activity.', value: registrationLink })}><QrIcon size={14} /> Registration QR</button>
          <button className="lexops-secondary" onClick={() => setSettingsOpen(true)}><Settings2 size={14} /> Settings</button>
        </div>
      </header>

      <div className="lexops-summary">
        <div><span>Confirmed</span><strong>{confirmed.length}</strong></div>
        <div><span>Pending</span><strong>{pending.length}</strong></div>
        <div><span>Waitlist</span><strong>{waitlisted.length}</strong></div>
        <div><span>Capacity</span><strong>{capacity ? `${capacityUsed}/${capacity}` : '∞'}</strong></div>
        <div><span>Sessions</span><strong>{sessions.length}</strong></div>
      </div>

      {error && <div className="lexops-error">{error}</div>}

      <div className="lexops-body">
        <section className="lexops-section">
          <div className="lexops-section-head"><div><h3>Session timeline</h3><p>Sessions are first-class attendance records; open only the session currently checking in.</p></div><button className="lexops-primary" onClick={() => setSessionDialog({ mode: 'new' })}><Plus size={14} /> Add session</button></div>
          <div className="lexops-sessions">
            {sessions.map(session => <button key={session.id} className={`lexops-session-card ${String(session.id) === String(selectedSessionId) ? 'active' : ''}`} onClick={() => setSelectedSessionId(session.id)}><div className="lexops-session-title">{session.title}</div><div className="lexops-session-meta">{formatSessionDate(session.session_date)}{session.starts_at ? ` · ${timeValue(session.starts_at)}` : ''}{session.ends_at ? `–${timeValue(session.ends_at)}` : ''}</div><div className="lexops-session-foot"><StatusBadge status={session.status} /><Edit3 size={13} color="var(--text-tertiary)" onClick={e => { e.stopPropagation(); setSessionDialog({ mode: 'edit', session }); }} /></div></button>)}
            {!sessions.length && <div className="lexops-empty-small">No sessions yet. Add the first delivery/check-in session.</div>}
          </div>
        </section>

        {selectedSession && (
          <section className="lexops-section">
            <div className="lexops-section-head"><div><h3>{selectedSession.title} · check-in desk</h3><p>{stats.present} present · {stats.late} late · {stats.absent} absent · {stats.unmarked} not checked in</p></div><div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{selectedSession.status !== 'open' ? <button className="lexops-primary" onClick={() => mutate('set_session_state', { sessionId: selectedSession.id, state: 'open' }, 'Check-in opened')}><UserCheck size={14} /> Open check-in</button> : <button className="lexops-secondary" onClick={() => mutate('set_session_state', { sessionId: selectedSession.id, state: 'closed' }, 'Check-in closed')}><Clock3 size={14} /> Close check-in</button>}<button className="lexops-secondary" onClick={() => mutate('mark_remaining_absent', { sessionId: selectedSession.id }, 'Remaining participants marked absent')}>Mark remaining absent</button></div></div>
            <div className="lexops-live-grid">
              <div className="lexops-live-left">
                <div className="lexops-tools"><div className="lexops-search"><Search size={14} /><input style={inputStyle} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, organisation or registration reference" /></div><select style={inputStyle} value={attendanceFilter} onChange={e => setAttendanceFilter(e.target.value)}><option value="all">All confirmed</option><option value="not_checked">Not checked in</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option></select></div>
                <div className="lexops-filter-row">{[['all', `All ${confirmed.length}`], ['not_checked', `Not checked ${stats.unmarked}`], ['present', `Present ${stats.present}`], ['late', `Late ${stats.late}`], ['absent', `Absent ${stats.absent}`]].map(([key, label]) => <button key={key} className={attendanceFilter === key ? 'active' : ''} onClick={() => setAttendanceFilter(key)}>{label}</button>)}</div>
                <div className="lexops-roster">
                  {visibleParticipants.map(reg => {
                    const status = statusFor(reg.participant_id);
                    return <div className="lexops-person" key={reg.id}><div><div className="lexops-person-name">{reg.name}</div><div className="lexops-person-meta">{reg.email}{reg.org ? ` · ${reg.org}` : ''} · {reg.reference_code}</div></div><div><StatusBadge status={status} /></div><div className="lexops-status-actions">{['present', 'late', 'absent'].map(s => <button key={s} className={status === s ? 'selected' : ''} onClick={() => setAttendance(reg.participant_id, s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}{status !== 'unmarked' && <button title="Undo attendance" onClick={() => mutate('undo_attendance', { sessionId: selectedSession.id, participantId: reg.participant_id }, 'Attendance undone')}><RotateCcw size={11} /></button>}</div></div>;
                  })}
                  {!visibleParticipants.length && <div className="lexops-empty-small">No participants match this view.</div>}
                </div>
              </div>
              <aside className="lexops-live-side">
                <div className="lexops-qr-wrap">
                  <QrCode value={checkinLink} size={176} label={`${selectedSession.title} check-in QR`} />
                  <StatusBadge status={selectedSession.status} />
                  <div className="lexops-linkbox"><Link2 size={12} /><span>{checkinLink}</span><button className="lexops-icon" style={{ width: 28, minHeight: 28, height: 28 }} onClick={() => copy(checkinLink, 'Check-in link')}><Copy size={12} /></button></div>
                  {selectedSession.checkin_pin && <div className="lexops-pin"><span>Session PIN</span><strong>{selectedSession.checkin_pin}</strong></div>}
                  <div className="lexops-side-actions"><button className="lexops-secondary" onClick={() => setPoster({ kicker: 'Session check-in', title: `${activity.title} · ${selectedSession.title}`, subtitle: 'Scan to check in for this session.', value: checkinLink, pin: selectedSession.checkin_pin })}><Printer size={13} /> Poster</button><button className="lexops-secondary" onClick={() => window.open(`${checkinLink}?mode=kiosk`, '_blank', 'noopener,noreferrer')}><QrIcon size={13} /> Kiosk</button></div>
                </div>
                <div className="lexops-scan"><label>SCAN PASS / ENTER REFERENCE</label><input ref={scanRef} style={inputStyle} placeholder="PASS:… or REG-…" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); processScan(e.currentTarget.value); } }} /><div style={{ fontSize: 9, lineHeight: 1.45, color: 'var(--text-tertiary)', marginTop: 5 }}>Works with USB/Bluetooth QR scanners that type the scanned value, or manual registration references.</div></div>
              </aside>
            </div>
          </section>
        )}

        <section className="lexops-section">
          <div className="lexops-section-head"><div><h3>Registration queue</h3><p>Approve pending registrations, manage the waitlist, and review confirmed records.</p></div><div className="lexops-reg-tabs">{[['confirmed', confirmed.length], ['pending', pending.length], ['waitlisted', waitlisted.length], ['cancelled', cancelled.length]].map(([key, count]) => <button key={key} className={`lexops-secondary ${registrationFilter === key ? 'active' : ''}`} onClick={() => setRegistrationFilter(key)}>{key} {count}</button>)}</div></div>
          <div className="lexops-reg-list">
            {registrationRows.map(reg => <div className="lexops-reg-row" key={reg.id}><div><div className="lexops-person-name">{reg.name}</div><div className="lexops-person-meta">{reg.email}{reg.org ? ` · ${reg.org}` : ''}</div></div><div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700 }}>{reg.reference_code}</div><StatusBadge status={reg.status} /><div className="lexops-reg-actions">{reg.status !== 'confirmed' && reg.status !== 'cancelled' && <button className="lexops-primary" onClick={() => mutate('set_registration_status', { registrationId: reg.id, status: 'confirmed' }, 'Registration confirmed')}><Check size={13} /> Confirm</button>}{reg.status !== 'cancelled' && <button className="lexops-secondary" onClick={() => mutate('set_registration_status', { registrationId: reg.id, status: 'cancelled' }, 'Registration cancelled')}>Cancel</button>}{reg.status === 'cancelled' && <button className="lexops-secondary" onClick={() => mutate('set_registration_status', { registrationId: reg.id, status: 'confirmed' }, 'Registration restored')}>Restore</button>}</div></div>)}
            {!registrationRows.length && <div className="lexops-empty-small">No {registrationFilter} registrations.</div>}
          </div>
        </section>
      </div>

      {sessionDialog && <SessionDialog initial={sessionDialog.session} defaultDate={dateValue(activity.start_date)} onClose={() => setSessionDialog(null)} onSave={saveSession} saving={saving} />}
      {settingsOpen && <SettingsDialog activity={activity} onClose={() => setSettingsOpen(false)} onSave={saveSettings} saving={saving} />}
      <Poster poster={poster} onClose={() => setPoster(null)} />
      {toast && <div className="lexops-toast">{toast}</div>}
    </section>
  );
}
