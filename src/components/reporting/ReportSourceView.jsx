import { AlertCircle, BarChart3, Database, Table2 } from 'lucide-react';

function number(value, maximumFractionDigits = 2) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString(undefined, { maximumFractionDigits }) : '—';
}

function money(value, currency) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${currency || ''} ${parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })}`.trim() : '—';
}

function titleCase(value) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function metricsFor(source) {
  const summary = source?.summary || {};
  if (source?.type === 'activity_details') return [
    ['Activity', summary.title], ['Type', summary.type], ['Status', summary.status], ['Venue', summary.venue || 'Not recorded'],
  ];
  if (source?.type === 'combined') return [
    ['Participants', number(summary.participants, 0)], ['Attendance', summary.attendanceRate == null ? 'Not recorded' : `${summary.attendanceRate}%`],
    ['Sessions delivered', `${number(summary.deliveredSessions, 0)}/${number(summary.sessions, 0)}`], ['Journal updates', number(summary.journalEntries, 0)],
  ];
  if (source?.type === 'tasks') return [['Tasks', summary.total], ['Completed', summary.completed], ['Overdue', summary.overdue]];
  if (source?.type === 'sessions') return [['Sessions', summary.total], ['Delivered', summary.delivered], ['Ready', summary.ready]];
  if (source?.type === 'facilitators') return [['Facilitators', summary.total], ['Assignments', summary.assignments]];
  if (source?.type === 'participants') return [['Participants', summary.total], ['Organisations', summary.organizations]];
  if (source?.type === 'attendance') return [['Attendance rate', summary.rate == null ? 'Not recorded' : `${summary.rate}%`], ['Present', summary.present], ['Late', summary.late], ['Absent', summary.absent]];
  if (source?.type === 'budget') return [['Planned', money(summary.planned, summary.currency)], ['Actual', money(summary.actual, summary.currency)], ['Variance', money(summary.variance, summary.currency)], ['Budget used', summary.percentUsed == null ? 'Not available' : `${summary.percentUsed}%`]];
  if (source?.type === 'journal') return [['Updates', summary.total], ['Report sources', summary.reportRelevant], ['Open follow-ups', summary.openFollowUps]];
  if (source?.type === 'surveys') return [['Surveys', summary.surveys], ['Responses', summary.responses], ['Average rating', summary.averageRating == null ? 'Not available' : `${number(summary.averageRating)}/5`]];
  if (source?.type === 'assessments') return [['Assessments', summary.assessments], ['Submissions', summary.submissions], ['Average score', summary.averageScore == null ? 'Not available' : `${number(summary.averageScore)}%`], ['Pass rate', summary.passRate == null ? 'Not available' : `${number(summary.passRate)}%`]];
  if (source?.type === 'certificates') return [['Certificates issued', summary.total]];
  return Object.entries(summary).slice(0, 4).map(([key, value]) => [titleCase(key), value]);
}

function tableFor(source) {
  const records = source?.records || [];
  if (source?.type === 'sessions') return { columns: ['Date', 'Session', 'Status', 'Facilitators'], rows: records.map(item => [item.date || '—', item.title, titleCase(item.status), item.facilitators?.join(', ') || 'Unassigned']) };
  if (source?.type === 'participants') return { columns: ['Participant', 'Organisation', 'Category'], rows: records.map(item => [item.name, item.organization || '—', item.category]) };
  if (source?.type === 'budget') return { columns: ['Item', 'Category', 'Planned', 'Actual'], rows: records.map(item => [item.item, item.category, money(item.planned, source.summary?.currency), money(item.actual, source.summary?.currency)]) };
  if (source?.type === 'tasks') return { columns: ['Task', 'Stage', 'Status', 'Due'], rows: records.map(item => [item.title, titleCase(item.stage), titleCase(item.status), item.dueDate || '—']) };
  if (source?.type === 'journal') return { columns: ['Date', 'Progress', 'Follow-up'], rows: records.map(item => [item.date, item.progress, titleCase(item.followUpStatus)]) };
  if (source?.type === 'surveys') return { columns: ['Survey', 'Status', 'Responses'], rows: records.map(item => [item.title, titleCase(item.status), item.responses ?? item.responseCount ?? 0]) };
  if (source?.type === 'assessments') return { columns: ['Assessment', 'Submissions', 'Average', 'Pass rate'], rows: records.map(item => [item.title, item.submissions ?? item.submissionCount ?? 0, item.averageScore == null ? '—' : `${number(item.averageScore)}%`, item.passRate == null ? '—' : `${number(item.passRate)}%`]) };
  if (source?.type === 'facilitators') return { columns: ['Facilitator', 'Session assignments'], rows: records.map(item => [item.name, item.sessions]) };
  if (source?.type === 'attendance') return { columns: ['Session', 'Status', 'Records'], rows: records.map(item => [item.session, titleCase(item.status), item.count]) };
  return { columns: [], rows: [] };
}

function SourceMetrics({ source }) {
  return <div className="activity-report-source-metrics">{metricsFor(source).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value ?? '—'}</strong></div>)}</div>;
}

function SourceBars({ source }) {
  const rows = (source.breakdown || []).filter(item => Number.isFinite(Number(item.value)));
  const max = Math.max(1, ...rows.map(item => Number(item.value)));
  if (!rows.length) return <SourceMetrics source={source}/>;
  return <div className="activity-report-source-bars" aria-label={`${source.label} chart`}><div className="activity-report-source-heading"><BarChart3 size={15}/><strong>{source.label}</strong></div>{rows.map(item => {
    const width = Math.max(2, (Number(item.value) / max) * 100);
    return <div className="activity-report-source-bar" key={item.label}><div><span>{titleCase(item.label)}</span><strong>{number(item.value)}</strong></div><div role="img" aria-label={`${titleCase(item.label)}: ${number(item.value)}`}><span style={{ width: `${width}%` }}/></div></div>;
  })}</div>;
}

function SourceTable({ source }) {
  const table = tableFor(source);
  if (!table.rows.length) return <SourceMetrics source={source}/>;
  return <div className="activity-report-source-table-wrap"><div className="activity-report-source-heading"><Table2 size={15}/><strong>{source.label} records</strong></div><table><thead><tr>{table.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{table.rows.slice(0, 20).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>{table.rows.length > 20 && <small>Showing 20 of {table.rows.length} records.</small>}</div>;
}

function JournalEvidence({ source }) {
  return <div className="activity-report-journal-evidence"><SourceMetrics source={source}/>{source.records?.slice(0, 5).map(record => <article key={record.id}><span>{record.date}{record.periodEnd ? `–${record.periodEnd}` : ''}</span><strong>{record.progress}</strong>{record.achievements && <p><b>Achievement:</b> {record.achievements}</p>}{record.challenges && <p><b>Challenge:</b> {record.challenges}</p>}{record.lessons && <p><b>Lesson:</b> {record.lessons}</p>}</article>)}</div>;
}

export default function ReportSourceView({ source, visualization = 'auto' }) {
  if (!source?.available) return <div className="activity-report-source-empty"><AlertCircle size={18}/><div><strong>No verified {source?.label?.toLowerCase() || 'source data'} yet</strong><p>Add or complete the source records, then return to this section.</p></div></div>;
  let view = visualization;
  if (view === 'auto') {
    if (['sessions', 'tasks', 'facilitators'].includes(source.type)) view = 'table';
    else if (['participants', 'attendance', 'budget', 'surveys', 'assessments', 'certificates'].includes(source.type)) view = 'bars';
    else view = 'summary';
  }
  if (view === 'none') return null;
  if (source.type === 'journal' && view === 'summary') return <JournalEvidence source={source}/>;
  if (view === 'bars') return <><SourceMetrics source={source}/><SourceBars source={source}/></>;
  if (view === 'table') return <><SourceMetrics source={source}/><SourceTable source={source}/></>;
  return <div className="activity-report-source-summary"><div className="activity-report-source-heading"><Database size={15}/><strong>Live {source.label.toLowerCase()}</strong></div><SourceMetrics source={source}/>{source.type === 'activity_details' && source.summary?.description && <p>{source.summary.description}</p>}</div>;
}
