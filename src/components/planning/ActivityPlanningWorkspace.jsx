import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BookOpenText, CalendarDays, CheckCircle2, ClipboardList, LayoutDashboard, LockKeyhole, RefreshCw, Sparkles, Users, WalletCards } from 'lucide-react';
import { calculateBudgetSummary, calculateJournalSummary, calculatePlanningSummary } from '../../../shared/planning.js';
import { isReportingPreviewDemo } from '../../lib/reportPreviewDemo';
import { getPlanningPreview } from '../../lib/planningPreviewDemo';
import PlanningTasks from './PlanningTasks';
import PlanningSessions from './PlanningSessions';
import PlanningBudget from './PlanningBudget';
import PlanningJournal from './PlanningJournal';
import './activity-planning.css';

const VIEWS = [
  ['summary', 'Plan summary', LayoutDashboard],
  ['tasks', 'Tasks', ClipboardList],
  ['sessions', 'Sessions', CalendarDays],
  ['facilitators', 'Facilitators', Users],
  ['budget', 'Budget', WalletCards],
  ['journal', 'Journal', BookOpenText],
];

async function request(activityId, options = {}) {
  const response = await fetch(`/api/activity-planning/${encodeURIComponent(activityId)}`, {
    credentials: 'include',
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The planning workspace could not be loaded.');
  return body;
}

function Metric({ label, value, detail, tone = 'navy' }) {
  return <article className={`planning-metric planning-metric-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function formatMoney(value, currency) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function PlanSummary({ data, summary, budgetSummary, journalSummary, onOpen }) {
  const overdue = data.tasks.filter(task => task.status !== 'done' && task.due_date && String(task.due_date).slice(0, 10) < new Date().toISOString().slice(0, 10));
  const unassigned = data.sessions.filter(session => !session.facilitators?.length);
  const draftSessions = data.sessions.filter(session => session.planning_status === 'draft');
  const nextTasks = data.tasks.filter(task => task.status !== 'done').sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'))).slice(0, 4);
  const currency = data.activity.budget_currency || 'GMD';
  const latestUpdate = journalSummary.latestEntry;
  return <div className="planning-summary-grid">
    <section className="planning-card planning-readiness-card">
      <div className="planning-card-heading"><div><span className="planning-kicker">Preparation status</span><h4>{summary.planningProgressPercent}% ready</h4></div><Sparkles size={22}/></div>
      <div className="planning-progress" aria-label={`${summary.planningProgressPercent}% planning readiness`}><span style={{ width: `${summary.planningProgressPercent}%` }}/></div>
      <div className="planning-readiness-parts">
        <div><span>Tasks</span><strong>{summary.taskCompletionPercent}%</strong></div>
        <div><span>Sessions ready</span><strong>{summary.sessionReadinessPercent}%</strong></div>
        <div><span>Facilitator cover</span><strong>{summary.facilitatorCoveragePercent}%</strong></div>
      </div>
    </section>
    <section className="planning-card">
      <div className="planning-card-heading"><div><span className="planning-kicker">Needs attention</span><h4>Planning checks</h4></div><AlertTriangle size={20}/></div>
      <div className="planning-attention-list">
        <button onClick={() => onOpen('tasks')}><span className={overdue.length ? 'attention-dot danger' : 'attention-dot good'}/><span><strong>{overdue.length} overdue task{overdue.length === 1 ? '' : 's'}</strong><small>{overdue.length ? 'Review deadlines and ownership.' : 'No task deadlines are overdue.'}</small></span></button>
        <button onClick={() => onOpen('sessions')}><span className={unassigned.length ? 'attention-dot warning' : 'attention-dot good'}/><span><strong>{unassigned.length} unassigned session{unassigned.length === 1 ? '' : 's'}</strong><small>{unassigned.length ? 'Add at least one facilitator.' : 'Every session has facilitator cover.'}</small></span></button>
        <button onClick={() => onOpen('sessions')}><span className={draftSessions.length ? 'attention-dot warning' : 'attention-dot good'}/><span><strong>{draftSessions.length} draft session{draftSessions.length === 1 ? '' : 's'}</strong><small>{draftSessions.length ? 'Complete the remaining session plans.' : 'All session plans are ready or delivered.'}</small></span></button>
        <button onClick={() => onOpen('journal')}><span className={journalSummary.openFollowUps ? 'attention-dot warning' : 'attention-dot good'}/><span><strong>{journalSummary.openFollowUps} open follow-up{journalSummary.openFollowUps === 1 ? '' : 's'}</strong><small>{journalSummary.openFollowUps ? 'Review actions recorded during implementation.' : 'No journal follow-ups are outstanding.'}</small></span></button>
      </div>
    </section>
    <section className="planning-card planning-budget-pulse">
      <div className="planning-card-heading"><div><span className="planning-kicker">Budget pulse</span><h4>{budgetSummary.itemCount ? `${budgetSummary.usedPercent ?? 0}% used` : 'Budget not started'}</h4></div><button className="planning-text-button" onClick={() => onOpen('budget')}>Open budget</button></div>
      <div className="planning-budget-pulse-values"><div><span>Planned</span><strong>{formatMoney(budgetSummary.planned, currency)}</strong></div><div><span>Actual</span><strong>{formatMoney(budgetSummary.actual, currency)}</strong></div><div className={budgetSummary.variance < 0 ? 'danger' : ''}><span>{budgetSummary.variance < 0 ? 'Over' : 'Remaining'}</span><strong>{formatMoney(Math.abs(budgetSummary.variance), currency)}</strong></div></div>
    </section>
    <section className="planning-card planning-latest-update">
      <div className="planning-card-heading"><div><span className="planning-kicker">Latest implementation update</span><h4>{latestUpdate ? new Date(`${String(latestUpdate.entry_date).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No journal entry yet'}</h4></div><button className="planning-text-button" onClick={() => onOpen('journal')}>Open journal</button></div>
      <p>{latestUpdate?.progress_summary || 'Capture a daily or weekly update once implementation starts.'}</p>
      {journalSummary.openFollowUps > 0 && <span className="planning-follow-up-inline">{journalSummary.openFollowUps} action{journalSummary.openFollowUps === 1 ? '' : 's'} need follow-up</span>}
    </section>
    <section className="planning-card planning-wide-card">
      <div className="planning-card-heading"><div><span className="planning-kicker">Next work</span><h4>Upcoming planning tasks</h4></div><button className="planning-text-button" onClick={() => onOpen('tasks')}>View all</button></div>
      {nextTasks.length ? <div className="planning-next-list">{nextTasks.map(task => <div key={task.id}><span className={`planning-priority priority-${task.priority}`}/><div><strong>{task.title}</strong><small>{task.assignee_name || 'Unassigned'}{task.due_date ? ` · Due ${new Date(`${String(task.due_date).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}</small></div><span className={`planning-status status-${task.status}`}>{task.status.replace('_', ' ')}</span></div>)}</div> : <div className="planning-empty-inline"><CheckCircle2 size={18}/>All planning tasks are complete.</div>}
    </section>
  </div>;
}

function FacilitatorOverview({ sessions, members, onOpen }) {
  const rows = members.map(member => ({
    ...member,
    sessions: sessions.filter(session => session.facilitators?.some(person => String(person.user_id) === String(member.id))),
  })).filter(member => member.sessions.length || member.role === 'facilitator');
  return <section className="planning-card planning-facilitator-overview">
    <div className="planning-card-heading"><div><span className="planning-kicker">Delivery team</span><h4>Facilitator workload</h4></div><button className="planning-secondary-button" onClick={() => onOpen('sessions')}>Manage assignments</button></div>
    {rows.length ? <div className="planning-facilitator-list">{rows.map(member => <article key={member.id}>
      <div className="planning-avatar">{member.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()}</div>
      <div><strong>{member.name}</strong><small>{member.role.replaceAll('_', ' ')}</small></div>
      <span>{member.sessions.length} session{member.sessions.length === 1 ? '' : 's'}</span>
      <div className="planning-facilitator-sessions">{member.sessions.map(session => <small key={session.id}>{session.title}</small>)}</div>
    </article>)}</div> : <div className="planning-empty"><Users size={24}/><strong>No facilitator assignments yet</strong><p>Invite facilitators to the team, then assign them from a session plan.</p></div>}
  </section>;
}

export default function ActivityPlanningWorkspace({ activity }) {
  const preview = isReportingPreviewDemo();
  const navigate = useNavigate();
  const [view, setView] = useState('summary');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const next = preview ? getPlanningPreview(activity) : await request(activity.id);
      setData(next); setError('');
    } catch (loadError) { setError(loadError.message); }
    finally { if (!silent) setLoading(false); }
  }, [activity, preview]);

  useEffect(() => {
    let active = true;
    const pending = preview ? Promise.resolve(getPlanningPreview(activity)) : request(activity.id);
    pending.then(next => {
      if (!active) return;
      setData(next); setError('');
    }).catch(loadError => {
      if (active) setError(loadError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [activity, preview]);

  async function mutate(action, payload, message) {
    if (preview) { setNotice('This deploy preview is read-only. Planning changes are available in an authenticated workspace.'); return false; }
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await request(activity.id, { method: 'POST', body: JSON.stringify({ action, ...payload }) });
      await load(true); setNotice(message || 'Planning updated.'); return result || true;
    } catch (mutationError) { setError(mutationError.message); return false; }
    finally { setSaving(false); }
  }

  const summary = useMemo(() => calculatePlanningSummary(data || {}), [data]);
  const budgetSummary = useMemo(() => calculateBudgetSummary(data?.budgetItems || []), [data?.budgetItems]);
  const journalSummary = useMemo(() => calculateJournalSummary(data?.journalEntries || []), [data?.journalEntries]);
  if (loading) return <section className="planning-shell planning-loading">Loading the activity plan…</section>;
  if (!data) return <section className="planning-shell"><div className="planning-message error">{error || 'Planning is unavailable.'}<button onClick={() => load()}><RefreshCw size={14}/>Try again</button></div></section>;

  return <section className="planning-shell">
    <header className="planning-hero">
      <div><span className="planning-kicker">Phase 2B · Training operations</span><h3>Plan, deliver and document in one place</h3><p>Keep tasks, weekly sessions, facilitators, budget and implementation evidence connected to this activity.</p></div>
      <div className="planning-hero-progress"><strong>{summary.planningProgressPercent}%</strong><span>planning readiness</span></div>
    </header>
    {preview && <div className="planning-message neutral">Preview data is synthetic and read-only. It demonstrates the complete planning experience without changing production records.</div>}
    {data.commercial?.plan === 'free' && <div className="planning-message neutral planning-commercial-note"><LockKeyhole size={17}/><span><strong>Free planning is fully available.</strong> Add tasks, sessions, weekly schedules, budgets and journal updates manually. Upgrade when you need bulk session and facilitator CSV import.</span><button onClick={() => navigate('/app/checkout?feature=session-import')}>View Pro</button></div>}
    {error && <div className="planning-message error">{error}</div>}
    {notice && <div className="planning-message success">{notice}</div>}
    <div className="planning-metrics planning-metrics-four">
      <Metric label="Tasks complete" value={`${summary.completedTasks}/${summary.totalTasks}`} detail={`${summary.overdueTasks} overdue`} tone={summary.overdueTasks ? 'danger' : 'navy'}/>
      <Metric label="Sessions ready" value={`${summary.readySessions}/${summary.totalSessions}`} detail={`${data.sessions.filter(session => session.planning_status === 'draft').length} still in draft`} tone="gold"/>
      <Metric label="Budget used" value={budgetSummary.usedPercent === null ? '—' : `${budgetSummary.usedPercent}%`} detail={budgetSummary.itemCount ? `${formatMoney(budgetSummary.actual, data.activity.budget_currency || 'GMD')} spent` : 'No budget items'} tone={budgetSummary.variance < 0 ? 'danger' : 'green'}/>
      <Metric label="Journal updates" value={journalSummary.entryCount} detail={`${journalSummary.openFollowUps} open follow-up${journalSummary.openFollowUps === 1 ? '' : 's'}`} tone={journalSummary.openFollowUps ? 'warning' : 'navy'}/>
    </div>
    <nav className="planning-tabs" aria-label="Planning sections">{VIEWS.map(([id, label, Icon]) => <button key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}><Icon size={15}/>{label}</button>)}</nav>
    {view === 'summary' && <PlanSummary data={data} summary={summary} budgetSummary={budgetSummary} journalSummary={journalSummary} onOpen={setView}/>}
    {view === 'tasks' && <PlanningTasks data={data} saving={saving} onMutate={mutate}/>}
    {view === 'sessions' && <PlanningSessions data={data} saving={saving} onMutate={mutate} onUpgrade={() => navigate('/app/checkout?feature=session-import')}/>}
    {view === 'facilitators' && <FacilitatorOverview sessions={data.sessions} members={data.members} onOpen={setView}/>}
    {view === 'budget' && <PlanningBudget data={data} saving={saving} onMutate={mutate}/>}
    {view === 'journal' && <PlanningJournal data={data} saving={saving} onMutate={mutate}/>}
  </section>;
}
