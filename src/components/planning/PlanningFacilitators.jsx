import { useState } from 'react';
import { Edit3, Mail, Plus, UserRound, Users, X } from 'lucide-react';

function FacilitatorDialog({ initial, saving, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    id: initial?.id || null,
    name: initial?.name || '',
    role: initial?.role || 'Facilitator',
    email: initial?.email || '',
  }));

  return <div className="planning-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !saving && onClose()}>
    <section className="planning-modal" role="dialog" aria-modal="true" aria-labelledby="planning-facilitator-title">
      <header><div><span className="planning-kicker">Facilitator directory</span><h4 id="planning-facilitator-title">{initial ? 'Edit facilitator' : 'Add facilitator'}</h4><p>Facilitators do not need a LexAMS login. Their email connects them to session records and assignments.</p></div><button className="planning-icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></header>
      <div className="planning-form-grid">
        <label className="wide"><span>Name</span><input autoFocus value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Awa Ceesay"/></label>
        <label><span>Role</span><input value={form.role} onChange={event => setForm({ ...form, role: event.target.value })} placeholder="Lead facilitator"/></label>
        <label><span>Email</span><input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="awa@example.org"/></label>
      </div>
      <footer><button className="planning-secondary-button" onClick={onClose} disabled={saving}>Cancel</button><button className="planning-primary-button" onClick={() => onSave(form)} disabled={saving || !form.name.trim() || !form.email.trim()}>{saving ? 'Saving…' : 'Save facilitator'}</button></footer>
    </section>
  </div>;
}

export default function PlanningFacilitators({ data, saving, onMutate, onOpenSessions }) {
  const [dialog, setDialog] = useState(null);
  const canManage = data.permissions.canManagePlanning;

  async function save(form) {
    const ok = await onMutate('save_facilitator', { facilitator: form }, form.id ? 'Facilitator updated.' : 'Facilitator added.');
    if (ok) setDialog(null);
  }

  return <div className="planning-section-stack">
    <div className="planning-toolbar"><div><h4>Facilitators</h4><p>Maintain the facilitator directory used when creating sessions and importing schedules.</p></div><div className="planning-toolbar-actions"><button className="planning-secondary-button" onClick={onOpenSessions}>View sessions</button>{canManage && <button className="planning-primary-button" onClick={() => setDialog({})}><Plus size={15}/>Add facilitator</button>}</div></div>
    {data.facilitators.length ? <section className="planning-facilitator-directory">
      <div className="planning-facilitator-row planning-facilitator-head"><span>Name</span><span>Role</span><span>Email</span><span>Sessions</span><span>Actions</span></div>
      {data.facilitators.map(facilitator => {
        const assignedSessions = data.sessions.filter(session => String(session.facilitator_id || '') === String(facilitator.id));
        return <article className="planning-facilitator-row" key={facilitator.id}>
          <span className="planning-facilitator-name"><i><UserRound size={15}/></i><strong>{facilitator.name}</strong></span>
          <span data-label="Role">{facilitator.role}</span>
          <span data-label="Email"><a href={`mailto:${facilitator.email}`}><Mail size={13}/>{facilitator.email}</a></span>
          <span data-label="Sessions">{assignedSessions.length}</span>
          <span className="planning-row-actions">{canManage && <button onClick={() => setDialog(facilitator)} aria-label={`Edit ${facilitator.name}`}><Edit3 size={14}/></button>}</span>
        </article>;
      })}
    </section> : <div className="planning-empty"><Users size={26}/><strong>No facilitators yet</strong><p>Add the people who deliver sessions. Their details can then be selected in the session form or matched during CSV import.</p>{canManage && <button className="planning-primary-button" onClick={() => setDialog({})}><Plus size={15}/>Add first facilitator</button>}</div>}
    {dialog && <FacilitatorDialog initial={dialog.id ? dialog : null} saving={saving} onClose={() => setDialog(null)} onSave={save}/>}
  </div>;
}
