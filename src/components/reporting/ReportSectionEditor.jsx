import { useState } from 'react';
import { AlertTriangle, Check, Database, LockKeyhole, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react';
import { reportSourceLabel } from '../../../shared/reporting.js';
import ReportSourceView from './ReportSourceView';

function stateLabel(section) {
  if (section.source_changed) return 'Source changed';
  if (section.content_state === 'approved') return 'Approved';
  if (section.content_state === 'user_edited') return 'User edited';
  if (section.content_state === 'generated') return 'Generated draft';
  if (section.section_type === 'linked' && section.has_source_data) return 'Live data';
  return 'Not complete';
}

function SourceComparison({ section }) {
  const before = section.source_snapshot?.summary || {};
  const current = section.source_payload?.summary || {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(current)])];
  const changed = keys.filter(key => JSON.stringify(before[key]) !== JSON.stringify(current[key]));
  return <details className="activity-report-source-comparison"><summary>Review detected changes</summary>{changed.length ? <dl>{changed.map(key => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd><span>{before[key] ?? 'Not recorded'}</span><b>→</b><strong>{current[key] ?? 'Not recorded'}</strong></dd></div>)}</dl> : <p>The detailed source records changed even though the headline summary stayed the same.</p>}</details>;
}

export default function ReportSectionEditor({ section, report, permissions, saving, onMutate, onMove, onSelectAfterDelete }) {
  const [draft, setDraft] = useState(() => ({ title: section.title, content_text: section.content_text || '', instructions: section.instructions || '' }));
  const editable = permissions.canEditReports && !permissions.readOnlyPreview;
  const locked = section.content_state === 'approved';
  const canWrite = editable && !locked && section.section_type !== 'linked';

  async function save() {
    await onMutate('save_section', { section: { id: section.id, ...draft } }, 'Report section saved.');
  }

  async function generate() {
    const protectedWriting = ['user_edited', 'approved'].includes(section.content_state);
    if (protectedWriting && !window.confirm('Replace the current protected writing with a refreshed evidence-based draft?')) return;
    await onMutate('generate_section', { sectionId: section.id, confirmReplace: protectedWriting }, section.source_changed ? 'Narrative refreshed from current records.' : 'Evidence-based draft generated.');
  }

  async function remove() {
    if (!window.confirm(`Delete “${section.title}” from this report?`)) return;
    const result = await onMutate('delete_report_section', { sectionId: section.id }, 'Report section removed.');
    if (result) onSelectAfterDelete();
  }

  return <section className="activity-report-editor-card">
    <header><div><span className={`activity-report-state state-${section.source_changed ? 'stale' : section.content_state}`}>{stateLabel(section)}</span><h4>{section.title}</h4><p>{section.section_type.replaceAll('_', ' ')} section{section.source_type ? ` · ${reportSourceLabel(section.source_type)}` : ''}{section.is_required ? ' · Required' : ' · Optional'}</p></div><div className="activity-report-editor-order"><button disabled={!editable} onClick={() => onMove(-1)} aria-label={`Move ${section.title} up`}>↑</button><button disabled={!editable} onClick={() => onMove(1)} aria-label={`Move ${section.title} down`}>↓</button></div></header>

    {section.source_changed && <div className="activity-report-stale-banner"><AlertTriangle size={19}/><div><strong>Source data changed since this narrative was prepared</strong><p>Your current writing has been preserved. Review the change, then refresh the draft or keep the existing text.</p><SourceComparison section={section}/><div>{editable && <><button className="primary" onClick={generate} disabled={saving}><RefreshCw size={14}/>Refresh narrative</button><button className="secondary" onClick={() => onMutate('acknowledge_source', { sectionId: section.id }, 'Existing narrative retained and source change acknowledged.')} disabled={saving}>Keep existing</button></>}</div></div></div>}

    <div className="activity-report-editor-fields"><label><span>Section title</span><input value={draft.title} disabled={!editable || locked} onChange={event => setDraft({ ...draft, title: event.target.value })}/></label><label><span>Author guidance</span><textarea value={draft.instructions} disabled={!editable || locked} onChange={event => setDraft({ ...draft, instructions: event.target.value })}/></label>{section.section_type !== 'linked' && <label className="narrative"><span>Report narrative</span><textarea value={draft.content_text} disabled={!canWrite} placeholder="Write this section or generate a grounded first draft from the linked records." onChange={event => setDraft({ ...draft, content_text: event.target.value })}/><small>{draft.content_text.length.toLocaleString()} characters · Changes are saved explicitly so approved writing stays protected.</small></label>}</div>

    {section.source_type && <div className="activity-report-live-source"><div className="activity-report-live-source-head"><div><Database size={15}/><strong>Linked evidence</strong><span>{section.source_payload?.label}</span></div>{section.source_payload?.hash && <code>{section.source_payload.hash}</code>}</div><ReportSourceView source={section.source_payload} visualization={section.visualization}/></div>}

    <footer><div>{editable && <button className="danger-text" onClick={remove} disabled={saving || report.sections.length <= 1}><Trash2 size={14}/>Remove section</button>}</div><div>{editable && section.content_state === 'approved' && <button className="secondary" onClick={() => onMutate('set_section_approval', { sectionId: section.id, approved: false }, 'Section unlocked for editing.')} disabled={saving}><LockKeyhole size={14}/>Unlock</button>}{editable && ['generated', 'hybrid'].includes(section.section_type) && !section.source_changed && <button className="secondary" onClick={generate} disabled={saving || !section.has_source_data}><Sparkles size={14}/>{section.content_text ? 'Regenerate' : 'Generate draft'}</button>}{canWrite && <button className="primary" onClick={save} disabled={saving || !draft.title.trim()}><Save size={14}/>Save section</button>}{editable && section.content_state !== 'approved' && (section.section_type === 'linked' ? section.has_source_data : Boolean(draft.content_text.trim())) && <button className="approve" onClick={() => onMutate('set_section_approval', { sectionId: section.id, approved: true }, 'Section approved and protected.')} disabled={saving}><Check size={14}/>Approve</button>}</div></footer>
  </section>;
}
