import { useMemo, useState } from 'react';
import { Copy, FilePlus2, GripVertical, LockKeyhole, Plus, Save, Trash2, X } from 'lucide-react';
import { REPORT_SECTION_TYPES, REPORT_SOURCE_TYPES, REPORT_VISUALIZATIONS, reportSourceLabel } from '../../../shared/reporting.js';

function blankSection(position = 10) {
  return { title: 'New section', section_type: 'manual', source_type: null, instructions: '', starter_text: '', visualization: 'none', is_required: true, position };
}

function cloneTemplate(template) {
  return {
    id: template?.id || null,
    name: template?.name || 'New report template',
    description: template?.description || '',
    is_builtin: Boolean(template?.is_builtin),
    sections: (template?.sections?.length ? template.sections : [blankSection()]).map(section => ({ ...section })),
  };
}

export default function ReportTemplateManager({ data, saving, onClose, onMutate, onUpgrade }) {
  const initial = data.templates.find(template => !template.is_builtin) || data.templates[0];
  const [selectedId, setSelectedId] = useState(initial?.id || 'new');
  const [draft, setDraft] = useState(() => cloneTemplate(initial));
  const selected = useMemo(() => data.templates.find(template => String(template.id) === String(selectedId)), [data.templates, selectedId]);
  const commercialEnabled = Boolean(data.commercial?.entitlements?.customReportTemplates);
  const editable = data.permissions.canManageTemplates && commercialEnabled && !draft.is_builtin;

  function choose(template) {
    setSelectedId(template.id);
    setDraft(cloneTemplate(template));
  }

  function startNew() {
    setSelectedId('new');
    setDraft(cloneTemplate(null));
  }

  function setSection(index, patch) {
    setDraft(current => ({ ...current, sections: current.sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section) }));
  }

  function move(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.sections.length) return;
    setDraft(current => {
      const sections = [...current.sections];
      [sections[index], sections[nextIndex]] = [sections[nextIndex], sections[index]];
      return { ...current, sections };
    });
  }

  async function save() {
    const result = await onMutate('save_template', { template: draft }, draft.id ? 'Template updated.' : 'Template created.');
    if (result?.templateId) {
      setSelectedId(result.templateId);
      setDraft(current => ({ ...current, id: result.templateId, is_builtin: false }));
    }
  }

  async function duplicate() {
    const name = `Copy of ${selected.name}`.slice(0, 120);
    const result = await onMutate('duplicate_template', { templateId: selected.id, name }, 'Template copied to your organisation.');
    if (result?.templateId) {
      setSelectedId(result.templateId);
      setDraft({ ...cloneTemplate(selected), id: result.templateId, name, is_builtin: false });
    }
  }

  async function remove() {
    if (!selected || selected.is_builtin || !window.confirm(`Delete “${selected.name}”? Existing reports will remain available.`)) return;
    const result = await onMutate('delete_template', { templateId: selected.id }, 'Template deleted.');
    if (result) {
      const fallback = data.templates.find(template => template.id !== selected.id);
      setSelectedId(fallback?.id || 'new');
      setDraft(cloneTemplate(fallback));
    }
  }

  return <div className="activity-report-modal-backdrop">
    <section className="activity-report-modal activity-report-template-modal" role="dialog" aria-modal="true" aria-labelledby="report-template-manager-title">
      <header><div><span>Organisation reporting</span><h3 id="report-template-manager-title">Report template library</h3><p>Reuse a consistent report structure across activities. Built-in templates can be copied before customisation.</p></div><button onClick={onClose} aria-label="Close"><X size={18}/></button></header>
      {data.permissions.readOnlyPreview && <div className="activity-report-preview-note">Template management is visible for review in this read-only deploy preview.</div>}
      {!commercialEnabled && <div className="activity-report-pro-note"><LockKeyhole size={16}/><span>Your existing organisation templates remain readable. Pro is required to create, copy, edit or delete templates.</span><button className="secondary pro-locked" onClick={() => onUpgrade('custom-report-templates')}>View Pro</button></div>}
      <div className="activity-report-template-layout">
        <aside><div className="activity-report-template-side-head"><strong>Templates</strong>{data.permissions.canManageTemplates && (commercialEnabled ? <button onClick={startNew}><FilePlus2 size={14}/>New</button> : <button className="pro-locked" onClick={() => onUpgrade('custom-report-templates')}><LockKeyhole size={13}/>Pro</button>)}</div>{data.templates.map(template => <button key={template.id} className={String(selectedId) === String(template.id) ? 'active' : ''} onClick={() => choose(template)}><span>{template.name}</span><small>{template.is_builtin ? 'Built-in starter' : 'Organisation template'} · {template.sections.length} sections</small></button>)}</aside>
        <div className="activity-report-template-editor">
          <div className="activity-report-template-fields"><label><span>Template name</span><input value={draft.name} disabled={!editable} onChange={event => setDraft({ ...draft, name: event.target.value })}/></label><label><span>Description</span><textarea value={draft.description} disabled={!editable} onChange={event => setDraft({ ...draft, description: event.target.value })}/></label></div>
          <div className="activity-report-template-section-head"><div><strong>Report sections</strong><small>Order, source and instructions are copied into each new activity report.</small></div>{editable && <button onClick={() => setDraft(current => ({ ...current, sections: [...current.sections, blankSection((current.sections.length + 1) * 10)] }))}><Plus size={14}/>Add section</button>}</div>
          <div className="activity-report-template-sections">{draft.sections.map((section, index) => <article key={section.id || `new-${index}`}>
            <div className="activity-report-section-order"><GripVertical size={15}/><strong>{String(index + 1).padStart(2, '0')}</strong><button disabled={!editable || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${section.title} up`}>↑</button><button disabled={!editable || index === draft.sections.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${section.title} down`}>↓</button></div>
            <div className="activity-report-template-section-fields"><label className="wide"><span>Section title</span><input value={section.title} disabled={!editable} onChange={event => setSection(index, { title: event.target.value })}/></label><label><span>Type</span><select value={section.section_type} disabled={!editable} onChange={event => { const type = event.target.value; setSection(index, { section_type: type, source_type: type === 'manual' ? null : (section.source_type || 'activity_details'), visualization: type === 'manual' ? 'none' : section.visualization === 'none' ? 'auto' : section.visualization }); }}>{REPORT_SECTION_TYPES.map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label><label><span>Data source</span><select value={section.source_type || ''} disabled={!editable || section.section_type === 'manual'} onChange={event => setSection(index, { source_type: event.target.value })}><option value="">No source</option>{REPORT_SOURCE_TYPES.map(type => <option key={type} value={type}>{reportSourceLabel(type)}</option>)}</select></label><label><span>Visual</span><select value={section.visualization} disabled={!editable || section.section_type === 'manual'} onChange={event => setSection(index, { visualization: event.target.value })}>{REPORT_VISUALIZATIONS.map(type => <option key={type} value={type}>{type}</option>)}</select></label><label className="wide"><span>Instructions</span><textarea value={section.instructions} disabled={!editable} onChange={event => setSection(index, { instructions: event.target.value })}/></label><label className="wide"><span>Starter text</span><textarea value={section.starter_text} disabled={!editable} onChange={event => setSection(index, { starter_text: event.target.value })}/></label><label className="activity-report-required"><input type="checkbox" checked={section.is_required} disabled={!editable} onChange={event => setSection(index, { is_required: event.target.checked })}/><span>Required section</span></label></div>
            {editable && draft.sections.length > 1 && <button className="danger" onClick={() => setDraft(current => ({ ...current, sections: current.sections.filter((_, sectionIndex) => sectionIndex !== index) }))} aria-label={`Delete ${section.title}`}><Trash2 size={14}/></button>}
          </article>)}</div>
        </div>
      </div>
      <footer><div>{selected?.is_builtin && data.permissions.canManageTemplates && (commercialEnabled ? <button className="secondary" onClick={duplicate} disabled={saving}><Copy size={14}/>Copy to organisation</button> : <button className="secondary pro-locked" onClick={() => onUpgrade('custom-report-templates')}><LockKeyhole size={14}/>Copy · Pro</button>)}{selected && !selected.is_builtin && data.permissions.canManageTemplates && commercialEnabled && <button className="danger-text" onClick={remove} disabled={saving}><Trash2 size={14}/>Delete template</button>}</div><div><button className="secondary" onClick={onClose}>Close</button>{editable && <button className="primary" onClick={save} disabled={saving || !draft.name.trim() || !draft.sections.length}><Save size={14}/>{saving ? 'Saving…' : 'Save template'}</button>}</div></footer>
    </section>
  </div>;
}
