import { CheckCircle2, FileText } from 'lucide-react';
import ReportSourceView from './ReportSourceView';

function prettyDate(value) {
  if (!value) return 'Not set';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function Narrative({ text }) {
  const paragraphs = String(text || '').split(/\n{2,}/).map(item => item.trim()).filter(Boolean);
  return paragraphs.length ? <div className="activity-report-narrative">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div> : null;
}

export default function ReportDocument({ report, activity, organization }) {
  if (!report) return null;
  return <article className="activity-report-print-document">
    <header className="activity-report-cover">
      <div className="activity-report-brand">{organization?.logo_url ? <img src={organization.logo_url} alt=""/> : <span><FileText size={22}/></span>}<div><strong>{organization?.name || 'LexAMS organisation'}</strong><small>Training operations & reporting</small></div></div>
      <div className="activity-report-cover-title"><span>Activity report</span><h1>{report.title}</h1><p>{activity.title}</p></div>
      <dl>
        <div><dt>Reporting period</dt><dd>{prettyDate(report.reporting_period_start)} – {prettyDate(report.reporting_period_end)}</dd></div>
        <div><dt>Prepared by</dt><dd>{report.author_name || 'Organisation team'}</dd></div>
        <div><dt>Status</dt><dd>{String(report.status || 'draft').replaceAll('_', ' ')}</dd></div>
        <div><dt>Last updated</dt><dd>{prettyDate(report.updated_at)}</dd></div>
      </dl>
      <div className="activity-report-cover-progress"><span><b>{report.completion?.percent || 0}%</b> complete</span><div aria-label={`${report.completion?.percent || 0}% report completion`}><i style={{ width: `${report.completion?.percent || 0}%` }}/></div></div>
    </header>

    <div className="activity-report-document-body">{report.sections.map((section, index) => <section className="activity-report-document-section" key={section.id}>
      <header><span>{String(index + 1).padStart(2, '0')}</span><div><h2>{section.title}</h2><small>{section.section_type === 'linked' ? `Live ${section.source_payload?.label || 'LexAMS data'}` : section.content_state === 'approved' ? 'Approved narrative' : section.section_type.replaceAll('_', ' ')}</small></div>{section.content_state === 'approved' && <CheckCircle2 size={18} aria-label="Approved"/>}</header>
      {section.content_text ? <Narrative text={section.content_text}/> : section.section_type !== 'linked' && <p className="activity-report-document-placeholder">This section has not yet been completed.</p>}
      {['linked', 'hybrid'].includes(section.section_type) && <ReportSourceView source={section.source_payload} visualization={section.visualization}/>}
    </section>)}</div>
    <footer className="activity-report-document-footer"><span>{organization?.name || 'LexAMS organisation'}</span><span>Built from verified LexAMS activity records</span></footer>
  </article>;
}
