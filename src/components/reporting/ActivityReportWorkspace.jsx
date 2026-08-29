import { useCallback, useMemo, useState, useEffect } from 'react';
import { AlertCircle, BookOpenCheck, CheckCircle2, FilePlus2, FileText, LayoutTemplate, Pencil, Plus, Printer, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import { REPORT_SECTION_TYPES, REPORT_SOURCE_TYPES, reportSourceLabel } from '../../../shared/reporting.js';
import { getActivityReportPreview } from '../../lib/activityReportPreviewDemo';
import { isReportingPreviewDemo } from '../../lib/reportPreviewDemo';
import { printActivityReport } from '../../lib/printActivityReport';
import ReportDocument from './ReportDocument';
import ReportSectionEditor from './ReportSectionEditor';
import ReportTemplateManager from './ReportTemplateManager';
import './activity-reporting.css';

function dateValue(value) { return value ? String(value).slice(0, 10) : ''; }

function DialogShell({ title, kicker, description, onClose, children, footer }) {
  return <div className="activity-report-modal-backdrop"><section className="activity-report-modal" role="dialog" aria-modal="true" aria-labelledby="activity-report-dialog-title"><header><div><span>{kicker}</span><h3 id="activity-report-dialog-title">{title}</h3>{description && <p>{description}</p>}</div><button onClick={onClose} aria-label="Close"><X size={18}/></button></header><div className="activity-report-modal-body">{children}</div><footer>{footer}</footer></section></div>;
}

function CreateReportDialog({ data, initialTemplateId, saving, onClose, onCreate }) {
  const defaultTemplate = data.templates.find(template => String(template.id) === String(initialTemplateId)) || data.templates[0];
  const [form, setForm] = useState({ template_id: defaultTemplate?.id || '', title: `${data.activity.title} — Report`, reporting_period_start: dateValue(data.activity.start_date), reporting_period_end: dateValue(data.activity.end_date) });
  const selected = data.templates.find(template => String(template.id) === String(form.template_id));
  return <DialogShell title="Start an activity report" kicker="Living report" description="Choose a reusable structure, then complete it progressively from verified activity records." onClose={onClose} footer={<><span/><div><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={() => onCreate(form)} disabled={saving || !form.title.trim() || !form.template_id}><FilePlus2 size={14}/>{saving ? 'Creating…' : 'Create report'}</button></div></>}>
    <div className="activity-report-form-grid"><label className="wide"><span>Report title</span><input autoFocus value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}/></label><label className="wide"><span>Template</span><select value={form.template_id} onChange={event => setForm({ ...form, template_id: event.target.value })}>{data.templates.map(template => <option key={template.id} value={template.id}>{template.name}{template.is_builtin ? ' · Built-in' : ' · Organisation'}</option>)}</select></label><label><span>Period starts</span><input type="date" value={form.reporting_period_start} onChange={event => setForm({ ...form, reporting_period_start: event.target.value })}/></label><label><span>Period ends</span><input type="date" min={form.reporting_period_start} value={form.reporting_period_end} onChange={event => setForm({ ...form, reporting_period_end: event.target.value })}/></label></div>{selected && <div className="activity-report-template-preview"><strong>{selected.name}</strong><p>{selected.description}</p><div>{selected.sections.map(section => <span key={section.id}>{section.title}</span>)}</div></div>}
  </DialogShell>;
}

function ReportDetailsDialog({ report, saving, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({ id: report.id, title: report.title, status: report.status, reporting_period_start: dateValue(report.reporting_period_start), reporting_period_end: dateValue(report.reporting_period_end) });
  return <DialogShell title="Report details" kicker="Activity report" description="Update the report identity, period and review status." onClose={onClose} footer={<><button className="danger-text" onClick={onDelete} disabled={saving}><Trash2 size={14}/>Delete report</button><div><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={() => onSave(form)} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : 'Save details'}</button></div></>}>
    <div className="activity-report-form-grid"><label className="wide"><span>Report title</span><input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}/></label><label><span>Status</span><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="in_review">In review</option><option value="approved">Approved</option></select></label><label><span>Period starts</span><input type="date" value={form.reporting_period_start} onChange={event => setForm({ ...form, reporting_period_start: event.target.value })}/></label><label><span>Period ends</span><input type="date" min={form.reporting_period_start} value={form.reporting_period_end} onChange={event => setForm({ ...form, reporting_period_end: event.target.value })}/></label></div>
  </DialogShell>;
}

function AddSectionDialog({ saving, onClose, onAdd }) {
  const [form, setForm] = useState({ title: 'New report section', section_type: 'manual', source_type: null, instructions: '', starter_text: '', visualization: 'none', is_required: false });
  return <DialogShell title="Add a report section" kicker="Report structure" description="Add a manual, linked, generated or hybrid section to this report only." onClose={onClose} footer={<><span/><div><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={() => onAdd(form)} disabled={saving || !form.title.trim()}><Plus size={14}/>Add section</button></div></>}>
    <div className="activity-report-form-grid"><label className="wide"><span>Section title</span><input autoFocus value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}/></label><label><span>Section type</span><select value={form.section_type} onChange={event => { const type = event.target.value; setForm({ ...form, section_type: type, source_type: type === 'manual' ? null : (form.source_type || 'activity_details'), visualization: type === 'manual' ? 'none' : 'auto' }); }}>{REPORT_SECTION_TYPES.map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label><label><span>Data source</span><select value={form.source_type || ''} disabled={form.section_type === 'manual'} onChange={event => setForm({ ...form, source_type: event.target.value })}><option value="">No source</option>{REPORT_SOURCE_TYPES.map(type => <option value={type} key={type}>{reportSourceLabel(type)}</option>)}</select></label><label className="wide"><span>Instructions</span><textarea value={form.instructions} onChange={event => setForm({ ...form, instructions: event.target.value })}/></label><label className="wide activity-report-check"><input type="checkbox" checked={form.is_required} onChange={event => setForm({ ...form, is_required: event.target.checked })}/><span>Required for report completion</span></label></div>
  </DialogShell>;
}

export default function ActivityReportWorkspace({ activity }) {
  const preview = isReportingPreviewDemo();
  const [data, setData] = useState(() => preview ? getActivityReportPreview(activity) : null);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [view, setView] = useState('write');
  const [dialog, setDialog] = useState(null);

  const load = useCallback(() => fetch(`/api/activity-reports/${activity.id}`, { credentials: 'include' })
    .then(async response => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not load the activity report workspace.');
      setData(body);
      return body;
    })
    .catch(loadError => {
      setError(loadError.message);
      return null;
    })
    .finally(() => setLoading(false)), [activity.id]);

  useEffect(() => { if (!preview) load(); }, [load, preview]);

  async function mutate(action, payload, successMessage) {
    if (data?.permissions.readOnlyPreview) return null;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/activity-reports/${activity.id}`, {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not complete the reporting action.');
      if (successMessage) { setMessage(successMessage); window.setTimeout(() => setMessage(''), 2800); }
      await load();
      return body;
    } catch (mutationError) {
      setError(mutationError.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  const report = useMemo(() => data?.reports.find(item => String(item.id) === String(selectedReportId)) || data?.reports[0] || null, [data?.reports, selectedReportId]);
  const section = useMemo(() => report?.sections.find(item => String(item.id) === String(selectedSectionId)) || report?.sections[0] || null, [report, selectedSectionId]);
  const staleCount = report?.sections.filter(item => item.source_changed).length || 0;
  const approvedCount = report?.sections.filter(item => item.content_state === 'approved').length || 0;

  async function createReport(form) {
    const result = await mutate('create_report', { report: form }, 'Activity report created.');
    if (result?.reportId) { setSelectedReportId(result.reportId); setSelectedSectionId(null); setDialog(null); }
  }

  async function moveSection(direction) {
    const index = report.sections.findIndex(item => item.id === section.id);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= report.sections.length) return;
    const ids = report.sections.map(item => item.id);
    [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
    const result = await mutate('reorder_sections', { reportId: report.id, sectionIds: ids }, 'Report sections reordered.');
    if (result) setSelectedSectionId(section.id);
  }

  if (loading) return <div className="activity-report-loading"><RefreshCw size={20}/>Loading living report…</div>;
  if (!data) return <div className="activity-report-error"><AlertCircle size={22}/><strong>Reporting workspace unavailable</strong><p>{error || 'Try again shortly.'}</p><button onClick={() => { setLoading(true); setError(''); load(); }}>Retry</button></div>;

  return <div className="activity-report-workspace">
    <section className="activity-report-hero"><div><span><BookOpenCheck size={14}/>Phase 2C–2E · Living report</span><h3>Build the report while the activity happens</h3><p>Combine editorial writing with verified sessions, participants, attendance, budget, journal, learning and certificate records—without silently overwriting approved work.</p></div>{report && <div className="activity-report-progress"><strong>{report.completion.percent}%</strong><span>report complete</span><div><i style={{ width: `${report.completion.percent}%` }}/></div></div>}</section>
    {data.permissions.readOnlyPreview && <div className="activity-report-preview-note"><strong>Preview mode:</strong> this is a synthetic, read-only report showing linked data, generated narrative and source-change review.</div>}
    {message && <div className="activity-report-message success">{message}</div>}
    {error && <div className="activity-report-message error">{error}</div>}

    {!report ? <section className="activity-report-empty"><FileText size={31}/><h4>Start the living report</h4><p>Choose a reusable template now. Linked sections will fill from activity records as delivery progresses.</p><div className="activity-report-empty-templates">{data.templates.slice(0, 3).map(template => <article key={template.id}><LayoutTemplate size={18}/><strong>{template.name}</strong><span>{template.sections.length} sections</span><p>{template.description}</p>{data.permissions.canCreateReports && <button onClick={() => setDialog({ type: 'create', templateId: template.id })}>Use template</button>}</article>)}</div></section> : <>
      <section className="activity-report-toolbar"><div className="activity-report-switcher"><label><span>Activity report</span><select value={report.id} onChange={event => { setSelectedReportId(event.target.value); setSelectedSectionId(null); }}>{data.reports.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><span className={`activity-report-status status-${report.status}`}>{report.status.replaceAll('_', ' ')}</span></div><div className="activity-report-actions"><div className="activity-report-view-toggle" role="group" aria-label="Report view"><button className={view === 'write' ? 'active' : ''} onClick={() => setView('write')}>Write</button><button className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')}>Preview</button></div>{(data.permissions.canManageTemplates || data.permissions.readOnlyPreview) && <button onClick={() => setDialog({ type: 'templates' })}><LayoutTemplate size={14}/>Templates</button>}{data.permissions.canCreateReports && <button onClick={() => setDialog({ type: 'create' })}><FilePlus2 size={14}/>New report</button>}{data.permissions.canEditReports && <button onClick={() => setDialog({ type: 'details' })}><Pencil size={14}/>Details</button>}<button className="primary" onClick={() => printActivityReport(report.title)}><Printer size={14}/>Print / PDF</button></div></section>

      <div className="activity-report-metrics"><article><FileText size={17}/><span><strong>{report.completion.completed}/{report.completion.total}</strong> sections complete</span></article><article><CheckCircle2 size={17}/><span><strong>{approvedCount}</strong> approved sections</span></article><article className={staleCount ? 'warning' : ''}><RefreshCw size={17}/><span><strong>{staleCount}</strong> source change{staleCount === 1 ? '' : 's'}</span></article><article><Sparkles size={17}/><span><strong>{report.sections.filter(item => item.content_state === 'generated').length}</strong> generated drafts</span></article></div>

      {view === 'write' && <div className="activity-report-write-layout"><aside className="activity-report-outline"><header><div><strong>Report outline</strong><small>{report.completion.requiredIncomplete} required section{report.completion.requiredIncomplete === 1 ? '' : 's'} remaining</small></div>{data.permissions.canEditReports && <button onClick={() => setDialog({ type: 'add-section' })} aria-label="Add report section"><Plus size={15}/></button>}</header><nav aria-label="Report sections">{report.sections.map((item, index) => <button key={item.id} className={section?.id === item.id ? 'active' : ''} onClick={() => setSelectedSectionId(item.id)}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><small>{item.source_changed ? 'Source changed' : item.content_state === 'approved' ? 'Approved' : item.section_type === 'linked' && item.has_source_data ? 'Live data' : item.content_state.replaceAll('_', ' ')}</small></div><i className={item.source_changed ? 'stale' : item.content_state === 'approved' || (item.section_type === 'linked' && item.has_source_data) ? 'complete' : ''}/></button>)}</nav></aside>{section && <ReportSectionEditor key={`${section.id}:${section.updated_at}:${section.content_state}:${section.source_hash || ''}`} section={section} report={report} permissions={data.permissions} saving={saving} onMutate={mutate} onMove={moveSection} onSelectAfterDelete={() => setSelectedSectionId(report.sections.find(item => item.id !== section.id)?.id || null)}/>}</div>}
      <div className={view === 'preview' ? 'activity-report-document-host' : 'activity-report-document-host activity-report-document-offscreen'}><ReportDocument report={report} activity={data.activity} organization={data.organization}/></div>
    </>}

    {dialog?.type === 'templates' && <ReportTemplateManager data={data} saving={saving} onClose={() => setDialog(null)} onMutate={mutate}/>}
    {dialog?.type === 'create' && <CreateReportDialog data={data} initialTemplateId={dialog.templateId} saving={saving} onClose={() => setDialog(null)} onCreate={createReport}/>}
    {dialog?.type === 'details' && <ReportDetailsDialog report={report} saving={saving} onClose={() => setDialog(null)} onSave={async form => { const result = await mutate('save_report', { report: form }, 'Report details updated.'); if (result) setDialog(null); }} onDelete={async () => { if (!window.confirm(`Delete “${report.title}” and all of its sections?`)) return; const result = await mutate('delete_report', { reportId: report.id }, 'Report deleted.'); if (result) { setSelectedReportId(null); setSelectedSectionId(null); setDialog(null); } }}/>}
    {dialog?.type === 'add-section' && <AddSectionDialog saving={saving} onClose={() => setDialog(null)} onAdd={async form => { const result = await mutate('add_report_section', { reportId: report.id, section: form }, 'Report section added.'); if (result?.section?.id) { setSelectedSectionId(result.section.id); setDialog(null); } }}/>}
  </div>;
}
