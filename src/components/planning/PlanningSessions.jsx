import { useMemo, useState } from 'react';
import { CalendarDays, Clock3, Edit3, MapPin, Plus, UserRound, X } from 'lucide-react';

const statusOptions = [['draft', 'Draft'], ['ready', 'Ready'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']];
function dateValue(value) { return value ? String(value).slice(0, 10) : ''; }
function timeValue(value) { return value ? String(value).slice(0, 5) : ''; }

function SessionDialog({ initial, activity, members, saving, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    id: initial?.id || null,
    title: initial?.title || '',
    session_date: dateValue(initial?.session_date) || dateValue(activity.start_date),
    starts_at: timeValue(initial?.starts_at),
    ends_at: timeValue(initial?.ends_at),
    venue: initial?.venue || activity.venue || '',
    description: initial?.description || '',
    learning_objectives: initial?.learning_objectives || '',
    planning_status: initial?.planning_status || 'draft',
    facilitator_ids: initial?.facilitators?.map(person => String(person.user_id)) || [],
    lead_facilitator_id: String(initial?.facilitators?.find(person => person.is_lead)?.user_id || ''),
  }));

  function toggleFacilitator(memberId) {
    const id = String(memberId);
    const selected = form.facilitator_ids.includes(id);
    const facilitatorIds = selected ? form.facilitator_ids.filter(value => value !== id) : [...form.facilitator_ids, id];
    setForm({ ...form, facilitator_ids: facilitatorIds, lead_facilitator_id: selected && form.lead_facilitator_id === id ? (facilitatorIds[0] || '') : (form.lead_facilitator_id || id) });
  }

  return <div className="planning-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !saving && onClose()}>
    <section className="planning-modal planning-modal-large" role="dialog" aria-modal="true" aria-labelledby="planning-session-title">
      <header><div><span className="planning-kicker">Session plan</span><h4 id="planning-session-title">{initial ? 'Edit session plan' : 'Add a session'}</h4></div><button className="planning-icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></header>
      <div className="planning-form-grid">
        <label className="wide"><span>Session title</span><input autoFocus value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Opening and participant orientation"/></label>
        <label><span>Date</span><input type="date" min={dateValue(activity.start_date)} max={dateValue(activity.end_date)} value={form.session_date} onChange={event => setForm({ ...form, session_date: event.target.value })}/></label>
        <label><span>Planning status</span><select value={form.planning_status} onChange={event => setForm({ ...form, planning_status: event.target.value })}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Starts</span><input type="time" value={form.starts_at} onChange={event => setForm({ ...form, starts_at: event.target.value })}/></label>
        <label><span>Ends</span><input type="time" value={form.ends_at} onChange={event => setForm({ ...form, ends_at: event.target.value })}/></label>
        <label className="wide"><span>Venue or room</span><input value={form.venue} onChange={event => setForm({ ...form, venue: event.target.value })} placeholder="Main training room"/></label>
        <label className="wide"><span>Session outline</span><textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Describe the content, flow and preparation required."/></label>
        <label className="wide"><span>Learning objectives</span><textarea value={form.learning_objectives} onChange={event => setForm({ ...form, learning_objectives: event.target.value })} placeholder="What should participants be able to do after this session?"/></label>
      </div>
      <div className="planning-assignment-editor"><div><strong>Facilitators</strong><small>Select the delivery team and identify one lead.</small></div><div className="planning-member-checks">{members.map(member => {
        const checked = form.facilitator_ids.includes(String(member.id));
        return <div key={member.id} className={checked ? 'selected' : ''}><label><input type="checkbox" checked={checked} onChange={() => toggleFacilitator(member.id)}/><span><strong>{member.name}</strong><small>{member.role.replaceAll('_', ' ')}</small></span></label>{checked && <label className="planning-lead-radio"><input type="radio" name="leadFacilitator" checked={form.lead_facilitator_id === String(member.id)} onChange={() => setForm({ ...form, lead_facilitator_id: String(member.id) })}/>Lead</label>}</div>;
      })}</div></div>
      <footer><button className="planning-secondary-button" onClick={onClose} disabled={saving}>Cancel</button><button className="planning-primary-button" onClick={() => onSave(form)} disabled={saving || !form.title.trim() || !form.session_date}>{saving ? 'Saving…' : 'Save session plan'}</button></footer>
    </section>
  </div>;
}

function SessionCard({ session, canManage, canUpdateStatus, saving, onEdit, onStatus }) {
  const lead = session.facilitators?.find(person => person.is_lead) || session.facilitators?.[0];
  return <article className="planning-session-card">
    <div className="planning-session-date"><strong>{new Date(`${dateValue(session.session_date)}T00:00:00`).toLocaleDateString(undefined, { day: '2-digit' })}</strong><span>{new Date(`${dateValue(session.session_date)}T00:00:00`).toLocaleDateString(undefined, { month: 'short' })}</span></div>
    <div className="planning-session-body"><div className="planning-session-top"><span className={`planning-status status-${session.planning_status}`}>{session.planning_status}</span>{canManage && <button className="planning-icon-button" onClick={onEdit} aria-label={`Edit ${session.title}`}><Edit3 size={14}/></button>}</div><h5>{session.title}</h5>{session.description && <p>{session.description}</p>}
      <div className="planning-session-meta"><span><Clock3 size={13}/>{timeValue(session.starts_at) || 'Time not set'}{session.ends_at ? `–${timeValue(session.ends_at)}` : ''}</span><span><MapPin size={13}/>{session.venue || 'Venue not set'}</span><span><UserRound size={13}/>{lead?.name || 'No lead facilitator'}</span></div>
      {session.facilitators?.length > 1 && <div className="planning-person-chips">{session.facilitators.map(person => <span key={person.user_id}>{person.name}{person.is_lead ? ' · Lead' : ''}</span>)}</div>}
      {session.learning_objectives && <details><summary>Learning objectives</summary><p>{session.learning_objectives}</p></details>}
      {canUpdateStatus && <label className="planning-status-select compact"><span>Preparation</span><select value={session.planning_status} disabled={saving} onChange={event => onStatus(event.target.value)}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
    </div>
  </article>;
}

export default function PlanningSessions({ data, saving, onMutate }) {
  const [dialog, setDialog] = useState(null);
  const [filter, setFilter] = useState('all');
  const canManage = data.permissions.canManagePlanning;
  const visible = useMemo(() => filter === 'all' ? data.sessions : data.sessions.filter(session => session.planning_status === filter), [data.sessions, filter]);

  async function save(form) {
    const ok = await onMutate('save_session', { session: form }, form.id ? 'Session plan updated.' : 'Session added to the plan.');
    if (ok) setDialog(null);
  }

  return <div className="planning-section-stack">
    <div className="planning-toolbar"><div><h4>Session plans</h4><p>Prepare delivery details and facilitator responsibilities without changing attendance records.</p></div><div className="planning-toolbar-actions"><select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filter session status"><option value="all">All planning states</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{canManage && <button className="planning-primary-button" onClick={() => setDialog({})}><Plus size={15}/>Add session</button>}</div></div>
    {visible.length ? <div className="planning-session-list">{visible.map(session => {
      const assigned = session.facilitators?.some(person => String(person.user_id) === String(data.permissions.currentUserId));
      return <SessionCard key={session.id} session={session} saving={saving} canManage={canManage} canUpdateStatus={canManage || (assigned && data.permissions.canUpdateAssignedTasks)} onEdit={() => setDialog(session)} onStatus={status => onMutate('set_session_planning_status', { sessionId: session.id, status }, 'Session preparation status updated.')}/>;
    })}</div> : <div className="planning-empty"><CalendarDays size={26}/><strong>No sessions match this filter</strong><p>{data.sessions.length ? 'Choose another planning state.' : 'Add the first session plan for this activity.'}</p>{canManage && !data.sessions.length && <button className="planning-primary-button" onClick={() => setDialog({})}><Plus size={15}/>Add first session</button>}</div>}
    {dialog && <SessionDialog initial={dialog.id ? dialog : null} activity={data.activity} members={data.members} saving={saving} onClose={() => setDialog(null)} onSave={save}/>}
  </div>;
}
