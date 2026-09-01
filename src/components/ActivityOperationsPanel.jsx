import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Clock3, Copy, Edit3, Link2, Plus, Printer, QrCode as QrIcon, RotateCcw, Search, Settings2, UserCheck, WifiOff, X } from 'lucide-react';
import QrCode from './QrCode';

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
  return <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, padding: '0 8px', borderRadius: 999, background: palette[0], color: palette[1], fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{status}</span>;
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
        <div className="lexops-modal-head">
          <div><div className="lexops-kicker">Activity session</div><h3>{initial ? 'Edit session' : 'Add session'}</h3></div>
          <button className="lexops-icon" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>
        <div className="lexops-form-grid">
          <label className="wide"><span>Session title</span><input className="lx-field" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Morning workshop" /></label>
          <label><span>Date</span><input className="lx-field" type="date" value={form.session_date} onChange={e => setForm({ ...form, session_date: e.target.value })} /></label>
          <label><span>Grace period (minutes)</span><input className="lx-field" type="number" min="0" max="240" value={form.grace_minutes} onChange={e => setForm({ ...form, grace_minutes: e.target.value })} /></label>
          <label><span>Starts</span><input className="lx-field" type="time" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></label>
          <label><span>Ends</span><input className="lx-field" type="time" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></label>
          <label><span>Optional check-in PIN</span><input className="lx-field" inputMode="numeric" pattern="[0-9]*" value={form.checkin_pin} onChange={e => setForm({ ...form, checkin_pin: e.target.value })} placeholder="4–8 digits" /></label>
          <div />
          <label><span>Window opens</span><input className="lx-field" type="datetime-local" value={form.checkin_open_at} onChange={e => setForm({ ...form, checkin_open_at: e.target.value })} /></label>
          <label><span>Window closes</span><input className="lx-field" type="datetime-local" value={form.checkin_close_at} onChange={e => setForm({ ...form, checkin_close_at: e.target.value })} /></label>
        </div>
        <div className="lexops-modal-actions">
          <button className="lexops-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="lexops-primary" onClick={() => onSave(form)} disabled={saving || !form.title || !form.session_date}>{saving ? 'Saving…' : 'Save session'}</button>
        </div>
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
        <div className="lexops-modal-head">
          <div><div className="lexops-kicker">Registration controls</div><h3>Registration settings</h3></div>
          <button className="lexops-icon" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>
        <div className="lexops-settings-grid">
          <label className="lexops-toggle"><input type="checkbox" checked={form.reg_open} onChange={e => setForm({ ...form, reg_open: e.target.checked })} /><span><strong>Registration open</strong><small>Master switch for the public form.</small></span></label>
          <label className="lexops-toggle"><input type="checkbox" checked={form.waitlist_enabled} onChange={e => setForm({ ...form, waitlist_enabled: e.target.checked })} /><span><strong>Enable waitlist</strong><small>Use when capacity is reached.</small></span></label>
          <label className="lexops-toggle"><input type="checkbox" checked={form.registration_approval_required} onChange={e => setForm({ ...form, registration_approval_required: e.target.checked })} /><span><strong>Require approval</strong><small>New registrations remain pending.</small></span></label>
          <label className="lexops-toggle"><input type="checkbox" checked={form.registration_confirmation_email} onChange={e => setForm({ ...form, registration_confirmation_email: e.target.checked })} /><span><strong>Email confirmations</strong><small>Send branded registration messages.</small></span></label>
        </div>
        <div className="lexops-form-grid">
          <label><span>Capacity</span><input className="lx-field" type="number" min="1" value={form.registration_capacity} onChange={e => setForm({ ...form, registration_capacity: e.target.value })} placeholder="Unlimited" /></label>
          <div />
          <label><span>Registration opens</span><input className="lx-field" type="datetime-local" value={form.registration_opens_at} onChange={e => setForm({ ...form, registration_opens_at: e.target.value })} /></label>
          <label><span>Registration closes</span><input className="lx-field" type="datetime-local" value={form.registration_closes_at} onChange={e => setForm({ ...form, registration_closes_at: e.target.value })} /></label>
          <label className="wide"><span>Confirmation message</span><textarea className="lx-field" rows={4} value={form.registration_confirmation_message} onChange={e => setForm({ ...form, registration_confirmation_message: e.target.value })} placeholder="Optional instructions shown in the confirmation email." /></label>
        </div>

        <div className="lexops-custom-head"><div><strong>Custom registration fields</strong><small>Up to 20 additional questions.</small></div><button className="lexops-secondary" onClick={addField}><Plus size={14} /> Add field</button></div>
        <div className="lexops-custom-list">
          {form.registration_custom_fields.map((field, index) => (
            <div className="lexops-custom-row" key={field.id || index}>
              <input className="lx-field" value={field.label || ''} onChange={e => updateField(index, { label: e.target.value })} placeholder="Question label" />
              <select className="lx-field" value={field.type || 'text'} onChange={e => updateField(index, { type: e.target.value })}><option value="text">Short text</option><option value="textarea">Long text</option><option value="select">Select</option><option value="checkbox">Checkbox</option></select>
              <label className="lexops-inline-check"><input type="checkbox" checked={Boolean(field.required)} onChange={e => updateField(index, { required: e.target.checked })} /> Required</label>
              <button className="lexops-icon" onClick={() => removeField(index)} aria-label="Remove field"><X size={16} /></button>
              {field.type === 'select' && <input className="lx-field wide" value={(field.options || []).join(', ')} onChange={e => updateField(index, { options: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })} placeholder="Options separated by commas" />}
            </div>
          ))}
          {!form.registration_custom_fields.length && <div className="lexops-empty-small">No custom fields. The standard name, email, phone, organisation and category fields remain available.</div>}
        </div>
        <div className="lexops-modal-actions">
          <button className="lexops-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="lexops-primary" onClick={() => onSave(form)} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
        </div>
      </section>
    </div>
  );
}

export default function ActivityOperationsPanel({ mode = 'all' }) {
  const { id } = useParams();
  const showRegistration = mode === 'all' || mode === 'registration';
  const showAttendance = mode === 'all' || mode === 'attendance';
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

  if (loading) return <section className="lexops-shell lexops-loading">Loading {showRegistration && !showAttendance ? 'registration management' : showAttendance && !showRegistration ? 'attendance operations' : 'activity operations'}…</section>;
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

  const summaryItems = showRegistration && !showAttendance
    ? [['Confirmed', confirmed.length], ['Pending', pending.length], ['Waitlist', waitlisted.length], ['Capacity', capacity ? `${capacityUsed}/${capacity}` : '∞']]
    : showAttendance && !showRegistration
      ? [['Sessions', sessions.length], ['Present', stats.present], ['Late', stats.late], ['Absent', stats.absent], ['Not checked', stats.unmarked]]
      : [['Confirmed', confirmed.length], ['Pending', pending.length], ['Waitlist', waitlisted.length], ['Capacity', capacity ? `${capacityUsed}/${capacity}` : '∞'], ['Sessions', sessions.length]];

  return (
    <section className={`lexops-shell lexops-shell-${mode}`}>
      <header className="lexops-head">
        <div>
          <div className="lexops-kicker">{showRegistration && !showAttendance ? 'Registration operations' : showAttendance && !showRegistration ? 'Session attendance' : 'Activity operations'}</div>
          <h2>{showRegistration && !showAttendance ? 'Registration management' : showAttendance && !showRegistration ? 'Check-in operations' : 'Live activity operations'}</h2>
        </div>
        <div className="lexops-head-actions">
          {showAttendance && queue.length > 0 && <button className="lexops-queue" onClick={flushQueue}><WifiOff size={13} /> {queue.length} queued · sync</button>}
          {showRegistration && <>
            <button className="lexops-secondary" onClick={() => copy(registrationLink, 'Registration link')}><Copy size={14} /> Registration link</button>
            <button className="lexops-secondary" onClick={() => setPoster({ kicker: 'Activity registration', title: activity.title, subtitle: 'Scan to register for this activity.', value: registrationLink })}><QrIcon size={14} /> Registration QR</button>
            <button className="lexops-secondary" onClick={() => setSettingsOpen(true)}><Settings2 size={14} /> Settings</button>
          </>}
        </div>
      </header>

      <div className="lexops-summary">
        {summaryItems.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>

      {error && <div className="lexops-error">{error}</div>}

      <div className="lexops-body">
        {showAttendance && <section className="lexops-section">
          <div className="lexops-section-head">
            <div><h3>Session timeline</h3><p>Open only the session currently checking in.</p></div>
            <button className="lexops-primary" onClick={() => setSessionDialog({ mode: 'new' })}><Plus size={14} /> Add session</button>
          </div>
          <div className="lexops-sessions">
            {sessions.map(session => <button key={session.id} className={`lexops-session-card ${String(session.id) === String(selectedSessionId) ? 'active' : ''}`} onClick={() => setSelectedSessionId(session.id)}><div className="lexops-session-title">{session.title}</div><div className="lexops-session-meta">{formatSessionDate(session.session_date)}{session.starts_at ? ` · ${timeValue(session.starts_at)}` : ''}{session.ends_at ? `–${timeValue(session.ends_at)}` : ''}</div><div className="lexops-session-foot"><StatusBadge status={session.status} /><Edit3 size={13} color="var(--text-tertiary)" onClick={e => { e.stopPropagation(); setSessionDialog({ mode: 'edit', session }); }} /></div></button>)}
            {!sessions.length && <div className="lexops-empty-small">No sessions yet. Add the first delivery/check-in session.</div>}
          </div>
        </section>}

        {showAttendance && selectedSession && <section className="lexops-section">
          <div className="lexops-section-head">
            <div><h3>{selectedSession.title} · check-in desk</h3><p>{stats.present} present · {stats.late} late · {stats.absent} absent · {stats.unmarked} not checked in</p></div>
            <div className="lexops-head-actions">
              {selectedSession.status !== 'open'
                ? <button className="lexops-primary" onClick={() => mutate('set_session_state', { sessionId: selectedSession.id, state: 'open' }, 'Check-in opened')}><UserCheck size={14} /> Open check-in</button>
                : <button className="lexops-secondary" onClick={() => mutate('set_session_state', { sessionId: selectedSession.id, state: 'closed' }, 'Check-in closed')}><Clock3 size={14} /> Close check-in</button>}
              <button className="lexops-secondary" onClick={() => mutate('mark_remaining_absent', { sessionId: selectedSession.id }, 'Remaining participants marked absent')}>Mark remaining absent</button>
            </div>
          </div>
          <div className="lexops-live-grid">
            <div className="lexops-live-left">
              <div className="lexops-tools">
                <div className="lexops-search"><Search size={14} /><input className="lx-field" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, organisation or registration reference" /></div>
                <select className="lx-field" value={attendanceFilter} onChange={e => setAttendanceFilter(e.target.value)}><option value="all">All confirmed</option><option value="not_checked">Not checked in</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option></select>
              </div>
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
                <div className="lexops-linkbox"><Link2 size={12} /><span>{checkinLink}</span><button className="lexops-icon" onClick={() => copy(checkinLink, 'Check-in link')}><Copy size={12} /></button></div>
                {selectedSession.checkin_pin && <div className="lexops-pin"><span>Session PIN</span><strong>{selectedSession.checkin_pin}</strong></div>}
                <div className="lexops-side-actions"><button className="lexops-secondary" onClick={() => setPoster({ kicker: 'Session check-in', title: `${activity.title} · ${selectedSession.title}`, subtitle: 'Scan to check in for this session.', value: checkinLink, pin: selectedSession.checkin_pin })}><Printer size={13} /> Poster</button><button className="lexops-secondary" onClick={() => window.open(`${checkinLink}?mode=kiosk`, '_blank', 'noopener,noreferrer')}><QrIcon size={13} /> Kiosk</button></div>
              </div>
              <div className="lexops-scan"><label>SCAN PASS / ENTER REFERENCE</label><input ref={scanRef} className="lx-field" placeholder="PASS:… or REG-…" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); processScan(e.currentTarget.value); } }} /><div className="lx-activity-legacy-note">Works with USB/Bluetooth QR scanners that type the scanned value, or manual registration references.</div></div>
            </aside>
          </div>
        </section>}

        {showRegistration && <section className="lexops-section">
          <div className="lexops-section-head">
            <div><h3>Registration queue</h3><p>Approve pending registrations, manage the waitlist, and review confirmed records.</p></div>
            <div className="lexops-reg-tabs">{[['confirmed', confirmed.length], ['pending', pending.length], ['waitlisted', waitlisted.length], ['cancelled', cancelled.length]].map(([key, count]) => <button key={key} className={`lexops-secondary ${registrationFilter === key ? 'active' : ''}`} onClick={() => setRegistrationFilter(key)}>{key} {count}</button>)}</div>
          </div>
          <div className="lexops-reg-list">
            {registrationRows.map(reg => <div className="lexops-reg-row" key={reg.id}><div><div className="lexops-person-name">{reg.name}</div><div className="lexops-person-meta">{reg.email}{reg.org ? ` · ${reg.org}` : ''}</div></div><div className="lexops-person-meta">{reg.reference_code}</div><StatusBadge status={reg.status} /><div className="lexops-reg-actions">{reg.status !== 'confirmed' && reg.status !== 'cancelled' && <button className="lexops-primary" onClick={() => mutate('set_registration_status', { registrationId: reg.id, status: 'confirmed' }, 'Registration confirmed')}><Check size={13} /> Confirm</button>}{reg.status !== 'cancelled' && <button className="lexops-secondary" onClick={() => mutate('set_registration_status', { registrationId: reg.id, status: 'cancelled' }, 'Registration cancelled')}>Cancel</button>}{reg.status === 'cancelled' && <button className="lexops-secondary" onClick={() => mutate('set_registration_status', { registrationId: reg.id, status: 'confirmed' }, 'Registration restored')}>Restore</button>}</div></div>)}
            {!registrationRows.length && <div className="lexops-empty-small">No {registrationFilter} registrations.</div>}
          </div>
        </section>}
      </div>

      {showAttendance && sessionDialog && <SessionDialog initial={sessionDialog.session} defaultDate={dateValue(activity.start_date)} onClose={() => setSessionDialog(null)} onSave={saveSession} saving={saving} />}
      {showRegistration && settingsOpen && <SettingsDialog activity={activity} onClose={() => setSettingsOpen(false)} onSave={saveSettings} saving={saving} />}
      <Poster poster={poster} onClose={() => setPoster(null)} />
      {toast && <div className="lexops-toast">{toast}</div>}
    </section>
  );
}
