import { useEffect, useMemo, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { fmtDate, fmtRange } from '../lib/format';
import {
  Activity, AlertTriangle, Award, BarChart3, CheckCircle2, ClipboardList,
  Download, FileSpreadsheet, Filter, GraduationCap, LockKeyhole, Printer,
  RotateCcw, TrendingUp, Users,
} from 'lucide-react';

const reportTypes = [
  { key: 'portfolio', icon: BarChart3, title: 'Programme overview', desc: 'Cross-programme performance and engagement.' },
  { key: 'activities', icon: Activity, title: 'Activities', desc: 'Registration, attendance and certificate performance.' },
  { key: 'attendance', icon: ClipboardList, title: 'Attendance', desc: 'Session participation and attendance patterns.' },
  { key: 'participants', icon: Users, title: 'Participants', desc: 'Participant profile, categories and organisations.' },
  { key: 'surveys', icon: FileSpreadsheet, title: 'Survey analysis', desc: 'Feedback, ratings and question-level response analysis.' },
  { key: 'assessments', icon: GraduationCap, title: 'Learning analysis', desc: 'Scores, pass rates and pre/post learning change.' },
  { key: 'certificates', icon: Award, title: 'Certificates', desc: 'Certificate issuance and completion records.' },
];

const sections = [
  { key: 'overview', label: 'Overview' },
  { key: 'visuals', label: 'Visuals' },
  { key: 'records', label: 'Records' },
];

const emptyFilters = {
  activity: 'all', activityType: 'all', category: 'all', organization: 'all',
  from: '', to: '', survey: 'all', assessment: 'all',
};

function titleCase(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values) {
  const nums = values.map(number).filter(value => value !== null);
  return nums.length ? Math.round((nums.reduce((sum, value) => sum + value, 0) / nums.length) * 100) / 100 : null;
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 10000) / 100 : null;
}

function MetricCard({ label, value, note }) {
  return <article className="lex-report-metric"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>;
}

function HorizontalBars({ title, description, data, suffix = '', emptyText = 'No data available for this view.' }) {
  const max = Math.max(...data.map(item => Number(item.value) || 0), 0);
  return (
    <article className="lex-report-chart">
      <div className="lex-report-chart-title">{title}</div>
      {description && <p>{description}</p>}
      {data.length ? <div className="lex-report-bars">
        {data.map(item => {
          const value = Number(item.value) || 0;
          const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0;
          return <div className="lex-report-bar-row" key={item.key || item.label}>
            <div><span title={item.label}>{item.label}</span><strong>{value}{suffix}</strong></div>
            <div className="lex-report-track"><span style={{ width: `${width}%` }} /></div>
          </div>;
        })}
      </div> : <div className="lex-report-empty">{emptyText}</div>}
    </article>
  );
}

function NoticeList({ items, tone = 'info' }) {
  if (!items?.length) return null;
  return <div className={`lex-report-notices ${tone}`}>{items.map((item, index) => <div key={`${tone}-${index}`}><span>{tone === 'warning' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}</span><p>{item}</p></div>)}</div>;
}

function RecordTable({ columns, rows }) {
  if (!rows.length) return <div className="lex-report-empty large">No records match the current report and filters.</div>;
  return <div className="lex-report-table-scroll"><div style={{ minWidth: Math.max(760, columns.length * 150) }}>
    <div className="lex-report-table-head" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))` }}>{columns.map(column => <div key={column}>{column}</div>)}</div>
    {rows.map((row, rowIndex) => <div className="lex-report-table-row" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))` }} key={rowIndex}>{row.map((cell, cellIndex) => <div key={cellIndex}>{cell}</div>)}</div>)}
  </div></div>;
}

function downloadText(filename, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export default function ReportsV2() {
  const {
    activities, participants, registrations, attendance, certificates, surveys, assessments,
    loading, getAttendancePct, getActivity, getParticipant,
  } = useData();

  const [reportType, setReportType] = useState('portfolio');
  const [section, setSection] = useState('overview');
  const [filters, setFilters] = useState(emptyFilters);
  const [billing, setBilling] = useState(null);
  const [billingLoaded, setBillingLoaded] = useState(false);
  const [advanced, setAdvanced] = useState(null);
  const [advancedLoading, setAdvancedLoading] = useState(false);
  const [advancedError, setAdvancedError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/billing/plan', { credentials: 'include' })
      .then(response => response.ok ? response.json() : null)
      .then(value => { if (active) setBilling(value); })
      .finally(() => { if (active) setBillingLoaded(true); });
    return () => { active = false; };
  }, []);

  const isPro = billing?.subscription?.plan === 'pro';
  const csvAllowed = Boolean(billing?.entitlements?.csvExport);
  const isAdvancedType = reportType === 'surveys' || reportType === 'assessments';

  const activityTypes = useMemo(() => [...new Set(activities.map(item => item.type).filter(Boolean))].sort(), [activities]);
  const categories = useMemo(() => [...new Set(participants.map(item => item.category).filter(Boolean))].sort(), [participants]);
  const organizations = useMemo(() => [...new Set(participants.map(item => item.org).filter(Boolean))].sort(), [participants]);

  const scope = useMemo(() => {
    const from = filters.from ? new Date(`${filters.from}T00:00:00`) : null;
    const to = filters.to ? new Date(`${filters.to}T23:59:59`) : null;
    const filteredActivities = activities.filter(activity => {
      if (filters.activity !== 'all' && String(activity.id) !== filters.activity) return false;
      if (filters.activityType !== 'all' && activity.type !== filters.activityType) return false;
      const start = safeDate(activity.start_date);
      const end = safeDate(activity.end_date) || start;
      if (from && end && end < from) return false;
      if (to && start && start > to) return false;
      return true;
    });
    const activityIds = new Set(filteredActivities.map(item => String(item.id)));
    const baseParticipants = participants.filter(participant => {
      if (filters.category !== 'all' && participant.category !== filters.category) return false;
      if (filters.organization !== 'all' && (participant.org || '') !== filters.organization) return false;
      return true;
    });
    const baseIds = new Set(baseParticipants.map(item => String(item.id)));
    const candidateRegs = registrations.filter(reg => activityIds.has(String(reg.activity_id)) && baseIds.has(String(reg.participant_id)));
    const activityScoped = filters.activity !== 'all' || filters.activityType !== 'all' || Boolean(filters.from) || Boolean(filters.to);
    const engagedIds = new Set(candidateRegs.map(reg => String(reg.participant_id)));
    const filteredParticipants = baseParticipants.filter(item => !activityScoped || engagedIds.has(String(item.id)));
    const participantIds = new Set(filteredParticipants.map(item => String(item.id)));
    return {
      activities: filteredActivities,
      participants: filteredParticipants,
      registrations: registrations.filter(reg => activityIds.has(String(reg.activity_id)) && participantIds.has(String(reg.participant_id))),
      attendance: attendance.filter(row => activityIds.has(String(row.activity_id)) && participantIds.has(String(row.participant_id))),
      certificates: certificates.filter(row => activityIds.has(String(row.activity_id)) && participantIds.has(String(row.participant_id))),
      surveys: surveys.filter(row => !row.activity_id || activityIds.has(String(row.activity_id))),
      assessments: assessments.filter(row => !row.activity_id || activityIds.has(String(row.activity_id))),
    };
  }, [activities, participants, registrations, attendance, certificates, surveys, assessments, filters]);

  useEffect(() => {
    if (!isAdvancedType || !billingLoaded || !isPro) {
      setAdvanced(null);
      setAdvancedError('');
      return undefined;
    }
    const controller = new AbortController();
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value && value !== 'all') params.set(key, value); });
    setAdvancedLoading(true);
    setAdvancedError('');
    fetch(`/api/report-analytics?${params.toString()}`, { credentials: 'include', signal: controller.signal })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Could not load advanced analytics.');
        return body;
      })
      .then(body => setAdvanced(body))
      .catch(error => { if (error.name !== 'AbortError') setAdvancedError(error.message); })
      .finally(() => setAdvancedLoading(false));
    return () => controller.abort();
  }, [isAdvancedType, billingLoaded, isPro, filters]);

  const activityMetrics = useMemo(() => scope.activities.map(activity => {
    const regs = scope.registrations.filter(reg => String(reg.activity_id) === String(activity.id));
    const attendanceValues = regs.map(reg => getAttendancePct(activity.id, reg.participant_id)).filter(value => value !== null);
    return {
      id: activity.id, title: activity.title, type: activity.type,
      dates: fmtRange({ start: activity.start_date, end: activity.end_date }),
      registered: regs.length,
      attendance: average(attendanceValues),
      certificates: scope.certificates.filter(cert => String(cert.activity_id) === String(activity.id)).length,
    };
  }), [scope.activities, scope.registrations, scope.certificates, getAttendancePct]);

  const averageAttendance = useMemo(() => average(scope.registrations.map(reg => getAttendancePct(reg.activity_id, reg.participant_id)).filter(value => value !== null)), [scope.registrations, getAttendancePct]);

  const categoryBars = useMemo(() => {
    const counts = new Map();
    scope.participants.forEach(item => counts.set(item.category || 'Uncategorised', (counts.get(item.category || 'Uncategorised') || 0) + 1));
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [scope.participants]);

  const organizationBars = useMemo(() => {
    const counts = new Map();
    scope.participants.forEach(item => counts.set(item.org || 'Not specified', (counts.get(item.org || 'Not specified') || 0) + 1));
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [scope.participants]);

  const attendanceBars = useMemo(() => {
    const counts = new Map([['present', 0], ['late', 0], ['absent', 0]]);
    scope.attendance.forEach(row => counts.set(row.status, (counts.get(row.status) || 0) + 1));
    return [...counts.entries()].filter(([, value]) => value > 0).map(([label, value]) => ({ label: titleCase(label), value }));
  }, [scope.attendance]);

  const certificateBars = useMemo(() => activityMetrics.map(item => ({ label: item.title, value: item.certificates })).filter(item => item.value > 0).sort((a, b) => b.value - a.value), [activityMetrics]);

  const basicReport = useMemo(() => {
    if (reportType === 'attendance') return {
      title: 'Attendance report', columns: ['Activity', 'Participant', 'Session', 'Status'],
      rows: scope.attendance.map(row => [getActivity(row.activity_id)?.title || '', getParticipant(row.participant_id)?.name || '', row.session_label || '', titleCase(row.status)]),
    };
    if (reportType === 'participants') return {
      title: 'Participant report', columns: ['Name', 'Email', 'Phone', 'Organisation', 'Category', 'Activities', 'Attendance'],
      rows: scope.participants.map(participant => {
        const regs = scope.registrations.filter(reg => String(reg.participant_id) === String(participant.id));
        const att = average(regs.map(reg => getAttendancePct(reg.activity_id, participant.id)).filter(value => value !== null));
        return [participant.name, participant.email, participant.phone || '', participant.org || '', participant.category || '', regs.length, att === null ? 'Not recorded' : `${att}%`];
      }),
    };
    if (reportType === 'surveys') return {
      title: 'Survey report', columns: ['Survey', 'Activity', 'Status', 'Created'],
      rows: scope.surveys.filter(item => filters.survey === 'all' || String(item.id) === filters.survey).map(item => [item.title || 'Untitled survey', getActivity(item.activity_id)?.title || 'Standalone', titleCase(item.status), item.created_at ? fmtDate(item.created_at) : '']),
    };
    if (reportType === 'assessments') return {
      title: 'Assessment report', columns: ['Assessment', 'Activity', 'Type', 'Pass mark', 'Status'],
      rows: scope.assessments.filter(item => filters.assessment === 'all' || String(item.id) === filters.assessment).map(item => [item.title || 'Untitled assessment', getActivity(item.activity_id)?.title || 'Standalone', titleCase(item.assessment_type), `${item.passing_score ?? 70}%`, titleCase(item.status)]),
    };
    if (reportType === 'certificates') return {
      title: 'Certificate report', columns: ['Certificate no.', 'Participant', 'Activity', 'Type', 'Issued'],
      rows: scope.certificates.map(item => [item.cert_no, getParticipant(item.participant_id)?.name || '', getActivity(item.activity_id)?.title || '', titleCase(item.certificate_type || 'completion'), fmtDate(item.issued_date)]),
    };
    return {
      title: reportType === 'activities' ? 'Activity report' : 'Programme overview',
      columns: ['Activity', 'Type', 'Dates', 'Registered', 'Attendance', 'Certificates'],
      rows: activityMetrics.map(item => [item.title, item.type || '', item.dates, item.registered, item.attendance === null ? 'Not recorded' : `${item.attendance}%`, item.certificates]),
    };
  }, [reportType, scope, filters.survey, filters.assessment, activityMetrics, getActivity, getParticipant, getAttendancePct]);

  const advancedData = reportType === 'surveys' ? advanced?.surveys : reportType === 'assessments' ? advanced?.assessments : null;

  const surveyRatingBars = useMemo(() => (advanced?.surveys?.questions || [])
    .filter(item => item.type === 'rating' && item.average !== null)
    .map(item => ({ label: item.question, value: Number(item.average) }))
    .sort((a, b) => b.value - a.value), [advanced]);

  const assessmentScoreBars = useMemo(() => {
    const records = advanced?.assessments?.submissionRecords || [];
    const byAssessment = new Map();
    records.forEach(row => {
      const key = String(row.assessmentId);
      const current = byAssessment.get(key) || { label: row.assessment, scores: [], passed: 0, total: 0 };
      if (row.percentage !== null) current.scores.push(Number(row.percentage));
      if (row.passed) current.passed += 1;
      current.total += 1;
      byAssessment.set(key, current);
    });
    return [...byAssessment.values()].map(item => ({ label: item.label, value: average(item.scores) || 0, passRate: pct(item.passed, item.total) || 0 }));
  }, [advanced]);

  const advancedRecord = useMemo(() => {
    if (reportType === 'surveys' && advanced?.surveys) return {
      columns: ['Survey', 'Activity', 'Respondent', 'Email', 'Answered', 'Submitted'],
      rows: advanced.surveys.responseRecords.map(row => [row.survey, row.activity, row.respondent, row.email || '—', row.answered, fmtDate(row.submittedAt)]),
    };
    if (reportType === 'assessments' && advanced?.assessments) return {
      columns: ['Assessment', 'Activity', 'Type', 'Respondent', 'Score', 'Result', 'Submitted'],
      rows: advanced.assessments.submissionRecords.map(row => [row.assessment, row.activity, titleCase(row.type), row.respondent, row.percentage === null ? '—' : `${row.percentage}%`, row.passed ? 'Passed' : 'Not passed', fmtDate(row.submittedAt)]),
    };
    return null;
  }, [advanced, reportType]);

  const updateFilter = (key, value) => setFilters(current => ({ ...current, [key]: value }));
  const resetFilters = () => setFilters(emptyFilters);

  function basicCsv() {
    const csv = [basicReport.columns, ...basicReport.rows].map(row => row.map(escapeCsv).join(',')).join('\r\n');
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`lexams-${reportType}-${stamp}.csv`, '\ufeff' + csv);
  }

  async function advancedCsv() {
    const params = new URLSearchParams({ format: 'csv', type: reportType });
    Object.entries(filters).forEach(([key, value]) => { if (value && value !== 'all') params.set(key, value); });
    const response = await fetch(`/api/report-analytics?${params.toString()}`, { credentials: 'include' });
    if (!response.ok) return;
    const text = await response.text();
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    downloadText(match?.[1] || `lexams-${reportType}-analysis.csv`, text);
  }

  const exportCsv = () => {
    if (!csvAllowed) return;
    if (isAdvancedType && isPro) advancedCsv(); else basicCsv();
  };

  const filterSummary = useMemo(() => {
    const labels = [];
    if (filters.activity !== 'all') labels.push(activities.find(item => String(item.id) === filters.activity)?.title || 'Selected activity');
    if (filters.activityType !== 'all') labels.push(filters.activityType);
    if (filters.category !== 'all') labels.push(filters.category);
    if (filters.organization !== 'all') labels.push(filters.organization);
    if (filters.from || filters.to) labels.push(`${filters.from || 'Start'} – ${filters.to || 'Today'}`);
    if (reportType === 'surveys' && filters.survey !== 'all') labels.push(surveys.find(item => String(item.id) === filters.survey)?.title || 'Selected survey');
    if (reportType === 'assessments' && filters.assessment !== 'all') labels.push(assessments.find(item => String(item.id) === filters.assessment)?.title || 'Selected assessment');
    return labels.length ? labels.join(' · ') : 'All available workspace records';
  }, [filters, activities, surveys, assessments, reportType]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading report data…</div>;

  const presentLike = scope.attendance.filter(row => row.status !== 'absent').length;
  const attendanceRate = pct(presentLike, scope.attendance.length);
  const uniqueSessions = new Set(scope.attendance.map(row => `${row.activity_id}:${row.session_label}`)).size;
  const participantOrgs = new Set(scope.participants.map(row => row.org).filter(Boolean)).size;
  const completionRate = pct(scope.certificates.length, scope.registrations.length);

  return <div className="lex-reports-v2">
    <style>{`
      .lex-reports-v2{display:grid;gap:20px}.lex-report-hero{padding:26px;border:1px solid var(--border-default);border-radius:18px;background:linear-gradient(135deg,var(--surface-card),var(--surface-muted))}.lex-report-hero h2{font-family:var(--font-display);font-size:30px;line-height:1.1;color:var(--color-navy-900);margin:7px 0}.lex-report-hero p{font-size:13px;color:var(--text-secondary);max-width:780px;line-height:1.6}.lex-report-tabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px}.lex-report-tab{min-width:145px;border:1px solid var(--border-default);background:var(--surface-card);border-radius:13px;padding:12px;text-align:left;color:var(--text-secondary);cursor:pointer}.lex-report-tab.active{border-color:var(--color-navy-700);box-shadow:var(--shadow-card);color:var(--color-navy-900)}.lex-report-tab strong{display:block;font-size:13px;margin-top:7px}.lex-report-tab small{display:block;font-size:11px;line-height:1.45;margin-top:4px}.lex-report-filters{border:1px solid var(--border-default);border-radius:16px;background:var(--surface-card);padding:16px}.lex-report-filter-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.lex-report-filter-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.lex-report-filter-grid select,.lex-report-filter-grid input{width:100%;padding:9px 10px;border:1px solid var(--border-default);border-radius:9px;background:var(--surface-card);font-size:12px;color:var(--text-primary)}.lex-report-section-nav{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.lex-report-section-buttons{display:flex;gap:7px}.lex-report-section-buttons button{border:1px solid var(--border-default);background:var(--surface-card);padding:8px 13px;border-radius:999px;font-size:12px;font-weight:700;color:var(--text-secondary)}.lex-report-section-buttons button.active{background:var(--color-navy-900);border-color:var(--color-navy-900);color:#fff}.lex-report-actions{display:flex;gap:8px}.lex-report-actions button{display:flex;align-items:center;gap:6px;border:1px solid var(--border-default);border-radius:9px;padding:8px 11px;background:var(--surface-card);font-size:12px;font-weight:700;color:var(--color-navy-800)}.lex-report-actions button:disabled{opacity:.45;cursor:not-allowed}.lex-report-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.lex-report-metric{border:1px solid var(--border-default);border-radius:15px;background:var(--surface-card);padding:17px}.lex-report-metric span{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-tertiary);font-weight:700}.lex-report-metric strong{display:block;font-family:var(--font-display);font-size:27px;color:var(--color-navy-900);margin-top:7px}.lex-report-metric small{display:block;font-size:11px;color:var(--text-tertiary);margin-top:5px}.lex-report-chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.lex-report-chart{border:1px solid var(--border-default);border-radius:16px;background:var(--surface-card);padding:18px}.lex-report-chart-title{font-size:14px;font-weight:800;color:var(--color-navy-900)}.lex-report-chart>p{font-size:11px;color:var(--text-tertiary);margin:5px 0 15px}.lex-report-bars{display:grid;gap:11px}.lex-report-bar-row>div:first-child{display:flex;justify-content:space-between;gap:14px;font-size:12px;color:var(--text-secondary);margin-bottom:5px}.lex-report-bar-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lex-report-track{height:8px;border-radius:999px;background:var(--surface-muted);overflow:hidden}.lex-report-track span{display:block;height:100%;border-radius:999px;background:var(--color-navy-700)}.lex-report-table-card{border:1px solid var(--border-default);border-radius:16px;background:var(--surface-card);overflow:hidden}.lex-report-table-scroll{overflow-x:auto}.lex-report-table-head,.lex-report-table-row{display:grid;gap:12px;padding:11px 18px}.lex-report-table-head{font-size:10px;text-transform:uppercase;letter-spacing:.07em;font-weight:800;color:var(--text-tertiary);background:var(--surface-muted)}.lex-report-table-row{font-size:12px;color:var(--text-secondary);border-top:1px solid var(--border-default)}.lex-report-notices{display:grid;gap:8px}.lex-report-notices>div{display:flex;gap:9px;padding:11px 13px;border-radius:11px;font-size:12px;line-height:1.5}.lex-report-notices.info>div{background:#EFF7F2;color:#245C3B}.lex-report-notices.warning>div{background:#FFF7E6;color:#725116}.lex-report-notices p{margin:0}.lex-report-empty{font-size:12px;color:var(--text-tertiary);padding:20px 0}.lex-report-empty.large{padding:44px 20px;text-align:center}.lex-report-pro-lock{border:1px solid var(--border-default);border-radius:16px;background:linear-gradient(135deg,var(--surface-card),var(--surface-muted));padding:28px;text-align:center}.lex-report-pro-lock svg{color:var(--color-gold-600)}.lex-report-pro-lock h3{font-family:var(--font-display);font-size:21px;color:var(--color-navy-900);margin:10px 0 5px}.lex-report-pro-lock p{font-size:12px;color:var(--text-secondary);max-width:560px;margin:0 auto;line-height:1.6}.lex-report-question-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.lex-report-question{border:1px solid var(--border-default);border-radius:14px;background:var(--surface-card);padding:15px}.lex-report-question h4{font-size:13px;color:var(--color-navy-900);margin:0}.lex-report-question p{font-size:11px;color:var(--text-tertiary);margin:5px 0 10px}.lex-report-question .mini{font-size:12px;color:var(--text-secondary);display:flex;gap:14px;flex-wrap:wrap}.lex-report-filter-summary{font-size:11px;color:var(--text-tertiary)}
      @media(max-width:950px){.lex-report-filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.lex-report-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:680px){.lex-report-chart-grid,.lex-report-question-grid,.lex-report-filter-grid,.lex-report-metrics{grid-template-columns:1fr}.lex-report-hero{padding:20px}.lex-report-hero h2{font-size:25px}}
      @media print{.lex-report-tabs,.lex-report-filters,.lex-report-section-buttons,.lex-report-actions{display:none!important}.lex-reports-v2{gap:14px}.lex-report-chart,.lex-report-metric,.lex-report-table-card{break-inside:avoid;box-shadow:none}}
    `}</style>

    <section className="lex-report-hero">
      <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--color-navy-700)', fontWeight: 800 }}>Programme intelligence</div>
      <h2>Reports, analysis and visualisation</h2>
      <p>Review programme performance inside LexAMS, move between report types and sections, apply filters to the live analysis, and export exactly the records represented by the current view.</p>
      <div className="lex-report-filter-summary">Current scope: {filterSummary}</div>
    </section>

    <nav className="lex-report-tabs" aria-label="Report types">{reportTypes.map(({ key, icon: Icon, title, desc }) => <button className={`lex-report-tab ${reportType === key ? 'active' : ''}`} key={key} onClick={() => { setReportType(key); setSection('overview'); }}><Icon size={18} /><strong>{title}</strong><small>{desc}</small></button>)}</nav>

    <section className="lex-report-filters">
      <div className="lex-report-filter-head"><div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 800 }}><Filter size={15} /> Filters</div><button onClick={resetFilters} style={{ display: 'flex', gap: 5, alignItems: 'center', border: 0, background: 'transparent', fontSize: 11, color: 'var(--color-navy-700)' }}><RotateCcw size={13} /> Reset</button></div>
      <div className="lex-report-filter-grid">
        <select value={filters.activity} onChange={e => updateFilter('activity', e.target.value)}><option value="all">All activities</option>{activities.map(item => <option key={item.id} value={String(item.id)}>{item.title}</option>)}</select>
        <select value={filters.activityType} onChange={e => updateFilter('activityType', e.target.value)}><option value="all">All activity types</option>{activityTypes.map(item => <option key={item} value={item}>{item}</option>)}</select>
        <select value={filters.category} onChange={e => updateFilter('category', e.target.value)}><option value="all">All participant categories</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select>
        <select value={filters.organization} onChange={e => updateFilter('organization', e.target.value)}><option value="all">All participant organisations</option>{organizations.map(item => <option key={item} value={item}>{item}</option>)}</select>
        <input type="date" value={filters.from} onChange={e => updateFilter('from', e.target.value)} aria-label="From date" />
        <input type="date" value={filters.to} onChange={e => updateFilter('to', e.target.value)} aria-label="To date" />
        {reportType === 'surveys' && <select value={filters.survey} onChange={e => updateFilter('survey', e.target.value)}><option value="all">All surveys</option>{surveys.map(item => <option key={item.id} value={String(item.id)}>{item.title}</option>)}</select>}
        {reportType === 'assessments' && <select value={filters.assessment} onChange={e => updateFilter('assessment', e.target.value)}><option value="all">All assessments</option>{assessments.map(item => <option key={item.id} value={String(item.id)}>{item.title}</option>)}</select>}
      </div>
    </section>

    <div className="lex-report-section-nav">
      <div className="lex-report-section-buttons">{sections.map(item => <button className={section === item.key ? 'active' : ''} key={item.key} onClick={() => setSection(item.key)}>{item.label}</button>)}</div>
      <div className="lex-report-actions"><button disabled={!csvAllowed || (isAdvancedType && !isPro)} onClick={exportCsv}><Download size={14} /> Export CSV</button><button disabled={!isPro} onClick={() => window.print()}><Printer size={14} /> Print / Save PDF</button></div>
    </div>

    {isAdvancedType && billingLoaded && !isPro ? <section className="lex-report-pro-lock"><LockKeyhole size={28} /><h3>Advanced analysis is a Pro feature</h3><p>Free workspaces can still view their survey and assessment setup records. Pro adds response analysis, ratings, question distributions, pass rates, pre/post learning comparisons, filtered CSV export and professional report output.</p>{section === 'records' && <div style={{ marginTop: 20 }}><RecordTable columns={basicReport.columns} rows={basicReport.rows} /></div>}</section> : null}

    {(!isAdvancedType || isPro) && section === 'overview' && <>
      {reportType === 'portfolio' && <div className="lex-report-metrics"><MetricCard label="Activities" value={scope.activities.length} /><MetricCard label="Participants" value={scope.participants.length} /><MetricCard label="Registrations" value={scope.registrations.length} /><MetricCard label="Average attendance" value={averageAttendance === null ? '—' : `${averageAttendance}%`} /></div>}
      {reportType === 'activities' && <div className="lex-report-metrics"><MetricCard label="Activities" value={scope.activities.length} /><MetricCard label="Registrations" value={scope.registrations.length} /><MetricCard label="Average attendance" value={averageAttendance === null ? '—' : `${averageAttendance}%`} /><MetricCard label="Certificates" value={scope.certificates.length} /></div>}
      {reportType === 'attendance' && <div className="lex-report-metrics"><MetricCard label="Attendance records" value={scope.attendance.length} /><MetricCard label="Attendance rate" value={attendanceRate === null ? '—' : `${attendanceRate}%`} note="Present + late" /><MetricCard label="Sessions recorded" value={uniqueSessions} /><MetricCard label="Absences" value={scope.attendance.filter(row => row.status === 'absent').length} /></div>}
      {reportType === 'participants' && <div className="lex-report-metrics"><MetricCard label="Participants" value={scope.participants.length} /><MetricCard label="Organisations" value={participantOrgs} /><MetricCard label="Categories" value={categoryBars.length} /><MetricCard label="Registrations" value={scope.registrations.length} /></div>}
      {reportType === 'certificates' && <div className="lex-report-metrics"><MetricCard label="Certificates" value={scope.certificates.length} /><MetricCard label="Recipients" value={new Set(scope.certificates.map(row => row.participant_id)).size} /><MetricCard label="Activities covered" value={new Set(scope.certificates.map(row => row.activity_id)).size} /><MetricCard label="Certificates / registrations" value={completionRate === null ? '—' : `${completionRate}%`} /></div>}
      {reportType === 'surveys' && isPro && <>{advancedLoading ? <div className="lex-report-empty">Analysing survey responses…</div> : advancedError ? <NoticeList items={[advancedError]} tone="warning" /> : advancedData && <><div className="lex-report-metrics"><MetricCard label="Surveys" value={advancedData.summary.surveyCount} /><MetricCard label="Responses" value={advancedData.summary.responseCount} /><MetricCard label="Average rating" value={advancedData.summary.averageRating === null ? '—' : `${Number(advancedData.summary.averageRating).toFixed(2)}/5`} /><MetricCard label="Rating questions" value={advancedData.summary.ratingQuestionCount} /></div><NoticeList items={advancedData.insights} /><NoticeList items={advancedData.dataQuality} tone="warning" /></>}</>}
      {reportType === 'assessments' && isPro && <>{advancedLoading ? <div className="lex-report-empty">Analysing assessment submissions…</div> : advancedError ? <NoticeList items={[advancedError]} tone="warning" /> : advancedData && <><div className="lex-report-metrics"><MetricCard label="Assessments" value={advancedData.summary.assessmentCount} /><MetricCard label="Submissions" value={advancedData.summary.submissionCount} /><MetricCard label="Average score" value={advancedData.summary.averageScore === null ? '—' : `${Number(advancedData.summary.averageScore).toFixed(2)}%`} /><MetricCard label="Pass rate" value={advancedData.summary.passRate === null ? '—' : `${Number(advancedData.summary.passRate).toFixed(2)}%`} /></div>{advancedData.prePost && (advancedData.prePost.preCount || advancedData.prePost.postCount) ? <div className="lex-report-metrics"><MetricCard label="Pre-test average" value={advancedData.prePost.preAverage === null ? '—' : `${Number(advancedData.prePost.preAverage).toFixed(2)}%`} /><MetricCard label="Post-test average" value={advancedData.prePost.postAverage === null ? '—' : `${Number(advancedData.prePost.postAverage).toFixed(2)}%`} /><MetricCard label="Matched learners" value={advancedData.prePost.matchedParticipants} /><MetricCard label="Matched change" value={advancedData.prePost.matchedChange === null ? '—' : `${advancedData.prePost.matchedChange >= 0 ? '+' : ''}${Number(advancedData.prePost.matchedChange).toFixed(2)} pp`} /></div> : null}<NoticeList items={advancedData.insights} /><NoticeList items={advancedData.dataQuality} tone="warning" /></>}</>}
    </>}

    {(!isAdvancedType || isPro) && section === 'visuals' && <div className="lex-report-chart-grid">
      {(reportType === 'portfolio' || reportType === 'activities') && <><HorizontalBars title="Registrations by activity" data={activityMetrics.map(item => ({ label: item.title, value: item.registered })).sort((a, b) => b.value - a.value)} /><HorizontalBars title="Average attendance by activity" data={activityMetrics.filter(item => item.attendance !== null).map(item => ({ label: item.title, value: item.attendance })).sort((a, b) => b.value - a.value)} suffix="%" /></>}
      {reportType === 'attendance' && <><HorizontalBars title="Attendance status" data={attendanceBars} /><HorizontalBars title="Attendance by activity" data={activityMetrics.filter(item => item.attendance !== null).map(item => ({ label: item.title, value: item.attendance }))} suffix="%" /></>}
      {reportType === 'participants' && <><HorizontalBars title="Participant categories" data={categoryBars} /><HorizontalBars title="Top participant organisations" data={organizationBars} /></>}
      {reportType === 'certificates' && <><HorizontalBars title="Certificates by activity" data={certificateBars} /><HorizontalBars title="Registrations by activity" data={activityMetrics.map(item => ({ label: item.title, value: item.registered }))} /></>}
      {reportType === 'surveys' && isPro && advancedData && <><HorizontalBars title="Responses by survey" data={advancedData.surveys.map(item => ({ label: item.title, value: item.responseCount })).sort((a, b) => b.value - a.value)} /><HorizontalBars title="Average rating by question" description="Rating questions use a 1–5 scale." data={surveyRatingBars} suffix="/5" />{advancedData.questions.filter(item => item.distribution?.length).slice(0, 6).map(item => <HorizontalBars key={`survey-q-${item.id}`} title={item.question} description={`${item.answered} answered · ${item.responseRate ?? 0}% response rate`} data={item.distribution} />)}</>}
      {reportType === 'assessments' && isPro && advancedData && <><HorizontalBars title="Average score by assessment" data={assessmentScoreBars.map(item => ({ label: item.label, value: item.value }))} suffix="%" /><HorizontalBars title="Pass rate by assessment" data={assessmentScoreBars.map(item => ({ label: item.label, value: item.passRate }))} suffix="%" />{advancedData.questions.filter(item => item.correctRate !== null).slice(0, 6).map(item => <HorizontalBars key={`assess-q-${item.id}`} title={item.question} description={`${item.answered} answered · Correct response rate`} data={[{ label: 'Correct', value: item.correctRate }, { label: 'Other / incorrect', value: Math.max(100 - item.correctRate, 0) }]} suffix="%" />)}</>}
    </div>}

    {(!isAdvancedType || isPro) && section === 'records' && <section className="lex-report-table-card"><RecordTable columns={advancedRecord?.columns || basicReport.columns} rows={advancedRecord?.rows || basicReport.rows} /></section>}

    {isAdvancedType && isPro && section === 'overview' && advancedData?.questions?.length ? <section><div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-navy-900)', marginBottom: 10 }}>{reportType === 'surveys' ? 'Question-level feedback' : 'Question-level learning evidence'}</div><div className="lex-report-question-grid">{advancedData.questions.slice(0, 12).map(item => <article className="lex-report-question" key={`${reportType}-${item.id}`}><h4>{item.question}</h4><p>{titleCase(item.type)} · {item.answered} response{item.answered === 1 ? '' : 's'}</p><div className="mini">{item.average !== undefined && item.average !== null && <span>Average: <strong>{Number(item.average).toFixed(2)}</strong></span>}{item.correctRate !== undefined && item.correctRate !== null && <span>Correct: <strong>{Number(item.correctRate).toFixed(2)}%</strong></span>}{item.responseRate !== null && <span>Response rate: <strong>{Number(item.responseRate || 0).toFixed(2)}%</strong></span>}</div>{item.samples?.length ? <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)' }}>{item.samples.map((sample, index) => <div key={index} style={{ padding: '5px 0', borderTop: index ? '1px solid var(--border-default)' : 0 }}>“{sample}”</div>)}</div> : null}</article>)}</div></section> : null}

    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-tertiary)', paddingBottom: 5 }}><TrendingUp size={12} /> Advanced survey and learning analytics use submitted response data; participant profile filters match respondents to participant records by participant ID or email.</div>
  </div>;
}
