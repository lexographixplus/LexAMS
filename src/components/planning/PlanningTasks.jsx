import { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Circle, Clock3, Edit3, Plus, Trash2, UserRound, X } from 'lucide-react';

const emptyTask = { title: '', description: '', stage: 'pre', assignee_user_id: '', due_date: '', priority: 'medium', status: 'todo' };
const stages = [['pre', 'Before training'], ['during', 'During training'], ['post', 'After training']];
const statuses = [['todo', 'To do'], ['in_progress', 'In progress'], ['blocked', 'Blocked'], ['done', 'Done']];

function dateValue(value) { return value ? String(value).slice(0, 10) : ''; }

function TaskDialog({ initial, members, saving, onClose, onSave }) {
  const [form, setForm] = useState(() => initial ? {
    ...emptyTask, ...initial, due_date: dateValue(initial.due_date), assignee_user_id: initial.assignee_user_id || '',
  } : { ...emptyTask });
  return <div className="planning-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !saving && onClose()}>
    <section className="planning-modal" role="dialog" aria-modal="true" aria-labelledby="planning-task-title">
      <header><div><span className="planning-kicker">Planning task</span><h4 id="planning-task-title">{initial ? 'Edit task' : 'Add a task'}</h4></div><button className="planning-icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></header>
      <div className="planning-form-grid">
        <label className="wide"><span>Task title</span><input autoFocus value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Confirm training materials"/></label>
        <label className="wide"><span>Description</span><textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Add the detail someone needs to complete this task."/></label>
        <label><span>Stage</span><select value={form.stage} onChange={event => setForm({ ...form, stage: event.target.value })}>{stages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Priority</span><select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
        <label><span>Assignee</span><select value={form.assignee_user_id} onChange={event => setForm({ ...form, assignee_user_id: event.target.value })}><option value="">Unassigned</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
        <label><span>Due date</span><input type="date" value={form.due_date} onChange={event => setForm({ ...form, due_date: event.target.value })}/></label>
        <label><span>Status</span><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <footer><button className="planning-secondary-button" onClick={onClose} disabled={saving}>Cancel</button><button className="planning-primary-button" onClick={() => onSave(form)} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : 'Save task'}</button></footer>
    </section>
  </div>;
}

function TaskCard({ task, canManage, canUpdateStatus, saving, onEdit, onStatus, onDelete }) {
  const overdue = task.status !== 'done' && task.due_date && dateValue(task.due_date) < new Date().toISOString().slice(0, 10);
  return <article className={`planning-task-card ${task.status === 'done' ? 'complete' : ''}`}>
    <div className="planning-task-top"><span className={`planning-priority priority-${task.priority}`}>{task.priority}</span><div className="planning-task-actions">{canManage && <button onClick={onEdit} aria-label={`Edit ${task.title}`}><Edit3 size={14}/></button>}{canManage && <button onClick={onDelete} aria-label={`Delete ${task.title}`} className="danger"><Trash2 size={14}/></button>}</div></div>
    <h5>{task.title}</h5>
    {task.description && <p>{task.description}</p>}
    <div className="planning-task-meta">
      <span><UserRound size={13}/>{task.assignee_name || 'Unassigned'}</span>
      <span className={overdue ? 'overdue' : ''}><Calendar size={13}/>{task.due_date ? new Date(`${dateValue(task.due_date)}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No deadline'}</span>
    </div>
    <label className="planning-status-select"><span>Status</span><select value={task.status} disabled={saving || !canUpdateStatus} onChange={event => onStatus(event.target.value)}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
  </article>;
}

export default function PlanningTasks({ data, saving, onMutate }) {
  const [dialog, setDialog] = useState(null);
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const canManage = data.permissions.canManagePlanning;
  const visible = useMemo(() => data.tasks.filter(task => {
    if (stageFilter !== 'all' && task.stage !== stageFilter) return false;
    if (statusFilter === 'active' && task.status === 'done') return false;
    if (statusFilter !== 'all' && statusFilter !== 'active' && task.status !== statusFilter) return false;
    return true;
  }), [data.tasks, stageFilter, statusFilter]);

  async function save(form) {
    const action = dialog?.id ? 'update_task' : 'create_task';
    const payload = dialog?.id ? { taskId: dialog.id, updates: form } : { task: form };
    const ok = await onMutate(action, payload, dialog?.id ? 'Task updated.' : 'Task added to the plan.');
    if (ok) setDialog(null);
  }

  async function remove(task) {
    if (!window.confirm(`Delete “${task.title}”? This cannot be undone.`)) return;
    await onMutate('delete_task', { taskId: task.id }, 'Task deleted.');
  }

  return <div className="planning-section-stack">
    <div className="planning-toolbar"><div><h4>Activity tasks</h4><p>Organise preparation, delivery and follow-up work by stage.</p></div><div className="planning-toolbar-actions"><select aria-label="Filter task stage" value={stageFilter} onChange={event => setStageFilter(event.target.value)}><option value="all">All stages</option>{stages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Filter task status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="active">Active tasks</option><option value="all">All statuses</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{canManage && <button className="planning-primary-button" onClick={() => setDialog({})}><Plus size={15}/>Add task</button>}</div></div>
    {visible.length ? <div className="planning-task-stages">{stages.map(([stage, label]) => {
      const stageTasks = visible.filter(task => task.stage === stage);
      if (!stageTasks.length) return null;
      return <section key={stage}><header><span>{stage === 'pre' ? <Clock3 size={15}/> : stage === 'during' ? <Circle size={15}/> : <CheckCircle2 size={15}/>}</span><h5>{label}</h5><small>{stageTasks.length}</small></header><div className="planning-task-grid">{stageTasks.map(task => {
        const ownTask = data.permissions.canUpdateAssignedTasks && String(task.assignee_user_id) === String(data.permissions.currentUserId);
        return <TaskCard key={task.id} task={task} canManage={canManage} canUpdateStatus={canManage || ownTask} saving={saving} onEdit={() => setDialog(task)} onDelete={() => remove(task)} onStatus={status => onMutate('update_task', { taskId: task.id, updates: { status } }, 'Task status updated.')}/>;
      })}</div></section>;
    })}</div> : <div className="planning-empty"><ClipboardListIcon/><strong>No tasks match these filters</strong><p>{data.tasks.length ? 'Change the filters to see the rest of the plan.' : 'Add the first preparation task when this activity needs more structure.'}</p>{canManage && !data.tasks.length && <button className="planning-primary-button" onClick={() => setDialog({})}><Plus size={15}/>Add first task</button>}</div>}
    {dialog && <TaskDialog initial={dialog.id ? dialog : null} members={data.members} saving={saving} onClose={() => setDialog(null)} onSave={save}/>}
  </div>;
}

function ClipboardListIcon() { return <span className="planning-empty-icon"><Circle size={10}/><Circle size={10}/><Circle size={10}/></span>; }
