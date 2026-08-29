import { useMemo, useState } from 'react';
import { BookOpenText, CalendarRange, Edit3, ExternalLink, FileCheck2, Plus, Trash2, X } from 'lucide-react';
import { canEditJournalEntry, calculateJournalSummary } from '../../../shared/planning.js';

const EMPTY_ENTRY = {
  entry_mode: 'daily', entry_date: '', period_end: '', progress_summary: '', achievements: '', challenges: '',
  observations_lessons: '', actions_follow_up: '', follow_up_status: 'not_required', evidence_url: '', include_in_report: true,
  session_ids: [], task_ids: [],
};

function dateValue(value) { return value ? String(value).slice(0, 10) : ''; }

function addDays(value, days) {
  const date = new Date(`${dateValue(value)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function endOfWeek(value, activityEnd) {
  const calculated = addDays(value, 6);
  return calculated && calculated > dateValue(activityEnd) ? dateValue(activityEnd) : calculated;
}

function defaultEntryDate(activity) {
  const today = new Date().toISOString().slice(0, 10);
  const start = dateValue(activity.start_date);
  const end = dateValue(activity.end_date || activity.start_date);
  if (today < start) return start;
  if (today > end) return end;
  return today;
}

function prettyDate(value, options = {}) {
  const date = new Date(`${dateValue(value)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Date not set' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', ...options });
}

function ToggleList({ title, hint, values, selected, onChange }) {
  function toggle(id) {
    const key = String(id);
    onChange(selected.includes(key) ? selected.filter(value => value !== key) : [...selected, key]);
  }
  return <section className="planning-link-picker"><div><strong>{title}</strong><small>{hint}</small></div><div>{values.map(value => <label key={value.id} className={selected.includes(String(value.id)) ? 'selected' : ''}><input type="checkbox" checked={selected.includes(String(value.id))} onChange={() => toggle(value.id)}/><span><strong>{value.title}</strong><small>{value.session_date ? prettyDate(value.session_date, { year: undefined }) : value.status?.replace('_', ' ')}</small></span></label>)}</div></section>;
}

function JournalDialog({ initial, activity, sessions, tasks, saving, onClose, onSave }) {
  const [form, setForm] = useState(() => initial ? {
    ...EMPTY_ENTRY,
    ...initial,
    entry_date: dateValue(initial.entry_date),
    period_end: dateValue(initial.period_end),
    session_ids: initial.linked_sessions?.map(session => String(session.id)) || [],
    task_ids: initial.linked_tasks?.map(task => String(task.id)) || [],
  } : { ...EMPTY_ENTRY, entry_date: defaultEntryDate(activity) });

  function setMode(mode) {
    setForm(current => ({
      ...current,
      entry_mode: mode,
      period_end: mode === 'weekly' ? (current.period_end || endOfWeek(current.entry_date, activity.end_date)) : '',
    }));
  }

  return <div className="planning-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !saving && onClose()}>
    <section className="planning-modal planning-modal-large" role="dialog" aria-modal="true" aria-labelledby="planning-journal-title">
      <header><div><span className="planning-kicker">Implementation journal</span><h4 id="planning-journal-title">{initial ? 'Edit implementation update' : 'Record an implementation update'}</h4><p>Capture the facts now so the final report starts with real delivery evidence.</p></div><button className="planning-icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></header>
      <div className="planning-journal-mode" role="group" aria-label="Entry period"><button className={form.entry_mode === 'daily' ? 'active' : ''} onClick={() => setMode('daily')}>Daily update</button><button className={form.entry_mode === 'weekly' ? 'active' : ''} onClick={() => setMode('weekly')}>Weekly update</button></div>
      <div className="planning-form-grid planning-journal-form">
        <label><span>{form.entry_mode === 'weekly' ? 'Week starts' : 'Entry date'}</span><input type="date" min={dateValue(activity.start_date)} max={dateValue(activity.end_date)} value={form.entry_date} onChange={event => setForm({ ...form, entry_date: event.target.value, period_end: form.entry_mode === 'weekly' ? endOfWeek(event.target.value, activity.end_date) : '' })}/></label>
        {form.entry_mode === 'weekly' ? <label><span>Week ends</span><input type="date" min={form.entry_date} max={dateValue(activity.end_date)} value={form.period_end} onChange={event => setForm({ ...form, period_end: event.target.value })}/></label> : <label><span>Follow-up status</span><select value={form.follow_up_status} onChange={event => setForm({ ...form, follow_up_status: event.target.value })}><option value="not_required">No follow-up required</option><option value="open">Follow-up open</option><option value="resolved">Follow-up resolved</option></select></label>}
        {form.entry_mode === 'weekly' && <label className="wide"><span>Follow-up status</span><select value={form.follow_up_status} onChange={event => setForm({ ...form, follow_up_status: event.target.value })}><option value="not_required">No follow-up required</option><option value="open">Follow-up open</option><option value="resolved">Follow-up resolved</option></select></label>}
        <label className="wide"><span>Progress summary *</span><textarea autoFocus value={form.progress_summary} onChange={event => setForm({ ...form, progress_summary: event.target.value })} placeholder="What was delivered or progressed during this period?"/></label>
        <label className="wide"><span>Achievements</span><textarea value={form.achievements} onChange={event => setForm({ ...form, achievements: event.target.value })} placeholder="Results, milestones or positive outcomes."/></label>
        <label className="wide"><span>Challenges</span><textarea value={form.challenges} onChange={event => setForm({ ...form, challenges: event.target.value })} placeholder="Issues, constraints or risks that affected delivery."/></label>
        <label className="wide"><span>Observations & lessons</span><textarea value={form.observations_lessons} onChange={event => setForm({ ...form, observations_lessons: event.target.value })} placeholder="What did the team learn or observe?"/></label>
        <label className="wide"><span>Actions & follow-up</span><textarea value={form.actions_follow_up} onChange={event => setForm({ ...form, actions_follow_up: event.target.value, follow_up_status: event.target.value.trim() && form.follow_up_status === 'not_required' ? 'open' : form.follow_up_status })} placeholder="Next action, owner or decision required."/></label>
        <label className="wide"><span>Evidence link</span><input type="url" value={form.evidence_url} onChange={event => setForm({ ...form, evidence_url: event.target.value })} placeholder="https://drive.example.org/photos-or-notes"/></label>
      </div>
      <div className="planning-journal-links"><ToggleList title="Linked sessions" hint="Connect this update to delivery records." values={sessions} selected={form.session_ids} onChange={session_ids => setForm({ ...form, session_ids })}/><ToggleList title="Linked tasks" hint="Show the implementation work behind this update." values={tasks} selected={form.task_ids} onChange={task_ids => setForm({ ...form, task_ids })}/></div>
      <label className="planning-report-toggle"><input type="checkbox" checked={form.include_in_report} onChange={event => setForm({ ...form, include_in_report: event.target.checked })}/><span><strong>Include in narrative reporting</strong><small>Mark this update as a source for the activity’s future report.</small></span></label>
      <footer><button className="planning-secondary-button" onClick={onClose} disabled={saving}>Cancel</button><button className="planning-primary-button" onClick={() => onSave(form)} disabled={saving || !form.progress_summary.trim() || !form.entry_date || (form.entry_mode === 'weekly' && !form.period_end)}>{saving ? 'Saving…' : 'Save implementation update'}</button></footer>
    </section>
  </div>;
}

function NarrativeBlock({ label, value, tone = '' }) {
  return value ? <div className={`planning-journal-block ${tone}`}><strong>{label}</strong><p>{value}</p></div> : null;
}

export default function PlanningJournal({ data, saving, onMutate }) {
  const [dialog, setDialog] = useState(null);
  const [filter, setFilter] = useState('all');
  const summary = useMemo(() => calculateJournalSummary(data.journalEntries), [data.journalEntries]);
  const visible = useMemo(() => data.journalEntries.filter(entry => {
    if (filter === 'report') return entry.include_in_report;
    if (filter === 'follow_up') return entry.follow_up_status === 'open';
    return filter === 'all' || entry.entry_mode === filter;
  }), [data.journalEntries, filter]);

  async function save(entry) {
    const response = await onMutate('save_journal_entry', { entry: dialog?.id ? { ...entry, id: dialog.id } : entry }, dialog?.id ? 'Implementation update revised.' : 'Implementation update recorded.');
    if (response) setDialog(null);
  }

  async function remove(entry) {
    if (!window.confirm('Delete this implementation update?')) return;
    await onMutate('delete_journal_entry', { entryId: entry.id }, 'Implementation update deleted.');
  }

  return <div className="planning-section-stack">
    <div className="planning-toolbar"><div><h4>Implementation journal</h4><p>Record daily or weekly delivery evidence while context is fresh and keep it ready for reporting.</p></div><div className="planning-toolbar-actions"><select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filter journal entries"><option value="all">All updates</option><option value="daily">Daily updates</option><option value="weekly">Weekly updates</option><option value="follow_up">Open follow-ups</option><option value="report">Report sources</option></select>{data.permissions.canCreateJournal && <button className="planning-primary-button" onClick={() => setDialog({})}><Plus size={15}/>Add update</button>}</div></div>
    <div className="planning-journal-summary"><div><BookOpenText size={18}/><span><strong>{summary.entryCount}</strong> implementation update{summary.entryCount === 1 ? '' : 's'}</span></div><div><CalendarRange size={18}/><span><strong>{summary.openFollowUps}</strong> open follow-up{summary.openFollowUps === 1 ? '' : 's'}</span></div><div><FileCheck2 size={18}/><span><strong>{summary.reportRelevantCount}</strong> marked for reporting</span></div></div>
    {visible.length ? <div className="planning-journal-timeline">{visible.map(entry => {
      const canEdit = data.permissions.canCreateJournal && canEditJournalEntry({ role: data.permissions.role, userId: data.permissions.currentUserId, entry });
      return <article key={entry.id} className="planning-journal-entry"><div className="planning-journal-marker"><span/><i/></div><div className="planning-journal-card"><header><div><span className="planning-kicker">{entry.entry_mode === 'weekly' ? `Weekly update · ${prettyDate(entry.entry_date, { year: undefined })}–${prettyDate(entry.period_end)}` : prettyDate(entry.entry_date)}</span><h5>{entry.progress_summary}</h5><small>Recorded by {entry.author_name || 'Team member'}</small></div><div className="planning-journal-actions">{entry.include_in_report && <span className="planning-report-badge"><FileCheck2 size={12}/>Report source</span>}{entry.follow_up_status === 'open' && <span className="planning-follow-up-badge">Follow-up open</span>}{canEdit && <button onClick={() => setDialog(entry)} aria-label="Edit implementation update"><Edit3 size={14}/></button>}{canEdit && <button className="danger" onClick={() => remove(entry)} aria-label="Delete implementation update"><Trash2 size={14}/></button>}</div></header><div className="planning-journal-content"><NarrativeBlock label="Achievements" value={entry.achievements} tone="success"/><NarrativeBlock label="Challenges" value={entry.challenges} tone="warning"/><NarrativeBlock label="Observations & lessons" value={entry.observations_lessons}/><NarrativeBlock label="Actions & follow-up" value={entry.actions_follow_up} tone={entry.follow_up_status === 'open' ? 'action' : ''}/></div>{(entry.linked_sessions?.length || entry.linked_tasks?.length || entry.evidence_url) ? <footer><div>{entry.linked_sessions?.map(session => <span key={`s-${session.id}`}>{session.title}</span>)}{entry.linked_tasks?.map(task => <span key={`t-${task.id}`}>{task.title}</span>)}</div>{entry.evidence_url && <a href={entry.evidence_url} target="_blank" rel="noreferrer"><ExternalLink size={13}/>Open evidence</a>}</footer> : null}</div></article>;
    })}</div> : <div className="planning-empty"><BookOpenText size={27}/><strong>{data.journalEntries.length ? 'No updates match this filter' : 'The implementation story starts here'}</strong><p>{data.journalEntries.length ? 'Choose another journal view.' : 'Add a short daily or weekly update after delivery begins. Those notes will become evidence for the final report.'}</p>{data.permissions.canCreateJournal && !data.journalEntries.length && <button className="planning-primary-button" onClick={() => setDialog({})}><Plus size={15}/>Record first update</button>}</div>}
    {dialog && <JournalDialog initial={dialog.id ? dialog : null} activity={data.activity} sessions={data.sessions} tasks={data.tasks} saving={saving} onClose={() => setDialog(null)} onSave={save}/>}
  </div>;
}
