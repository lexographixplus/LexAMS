import { useEffect, useMemo, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { fmtRange, fmtDate } from '../lib/format';
import {
  Activity, Award, BarChart3, ClipboardList, FileSpreadsheet,
  Filter, GraduationCap, Printer, RotateCcw, Users,
} from 'lucide-react';

const reportTypes = [
  { key: 'portfolio', icon: BarChart3, title: 'Programme overview', desc: 'Cross-programme performance and engagement.' },
  { key: 'activities', icon: Activity, title: 'Activities', desc: 'Registration, attendance and certificate performance.' },
  { key: 'attendance', icon: ClipboardList, title: 'Attendance', desc: 'Session-level participation and attendance patterns.' },
  { key: 'participants', icon: Users, title: 'Participants', desc: 'Participant profile, categories and organisations.' },
  { key: 'surveys', icon: FileSpreadsheet, title: 'Surveys', desc: 'Survey coverage and current collection status.' },
  { key: 'assessments', icon: GraduationCap, title: 'Assessments', desc: 'Assessment coverage, type and passing requirements.' },
  { key: 'certificates', icon: Award, title: 'Certificates', desc: 'Certificate issuance and completion records.' },
];

const sections = [
  { key: 'overview', label: 'Overview' },
  { key: 'visuals', label: 'Visuals' },
  { key: 'records', label: 'Records' },
];

const emptyFilters = {
  activity: 'all',
  activityType: 'all',
  category: 'all',
  organization: 'all',
  from: '',
  to: '',
};

function titleCase(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function average(values) {
  const nums = values.filter(value => typeof value === 'number' && Number.isFinite(value));
  return nums.length ? Math.round(nums.reduce((sum, value) => sum + value, 0) / nums.length) : null;
}

function MetricCard({ label, value, note }) {
  return (
    <div className="lexams-metric-card">
      <div className="lexams-metric-label">{label}</div>
      <div className="lexams-metric-value">{value}</div>
      {note && <div className="lexams-metric-note">{note}</div>}
    </div>
  );
}

function HorizontalBars({ title, description, data, valueSuffix = '', emptyText = 'No data available for this view.' }) {
  const max = Math.max(...data.map(item => item.value), 0);
  return (
    <article className="lexams-chart-card">
      <div className="lexams-chart-title">{title}</div>
      {description && <div className="lexams-chart-desc">{description}</div>}
      {data.length ? (
        <div className="lexams-bars">
          {data.map(item => {
            const width = max > 0 ? Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0) : 0;
            return (
              <div key={item.key || item.label} className="lexams-bar-row">
                <div className="lexams-bar-meta">
                  <span title={item.label}>{item.label}</span>
                  <strong>{item.value}{valueSuffix}</strong>
                </div>
                <div className="lexams-bar-track" aria-hidden="true">
                  <div className="lexams-bar-fill" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : <div className="lexams-chart-empty">{emptyText}</div>}
    </article>
  );
}

function RecordTable({ report }) {
  const colCount = report?.cols?.length || 1;
  if (!report?.rows?.length) {
    return (
      <div className="lexams-empty-records">
        <div>No records match this report and filter combination.</div>
        <span>Adjust the filters or collect more programme data.</span>
      </div>
    );
  }

  return (
    <div className="lexams-report-scroll">
      <div style={{ minWidth: Math.max(760, colCount * 150) }}>
        <div className="lexams-table-head" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(120px, 1fr))` }}>
          {report.cols.map(column => <div key={column}>{column}</div>)}
        </div>
        {report.rows.map((row, index) => (
          <div key={index} className="lexams-table-row" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(120px, 1fr))` }}>
            {row.map((cell, cellIndex) => <div key={cellIndex}>{cell}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Reports() {
  const {
    activities, participants, registrations, attendance, certificates, surveys, assessments,
    loading, getRegsForActivity, getAttendancePct, getActivity, getParticipant,
  } = useData();

  const [reportType, setReportType] = useState('portfolio');
  const [section, setSection] = useState('overview');
  const [filters, setFilters] = useState(emptyFilters);
  const [csvExportAllowed, setCsvExportAllowed] = useState(false);
  const [billingLoaded, setBillingLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/billing/plan', { credentials: 'include' })
      .then(response => response.ok ? response.json() : null)
      .then(billing => { if (active) setCsvExportAllowed(Boolean(billing?.entitlements?.csvExport)); })
      .finally(() => { if (active) setBillingLoaded(true); });
    return () => { active = false; };
  }, []);

  const activityTypes = useMemo(() => [...new Set(activities.map(activity => activity.type).filter(Boolean))].sort(), [activities]);
  const categories = useMemo(() => [...new Set(participants.map(participant => participant.category).filter(Boolean))].sort(), [participants]);
  const organizations = useMemo(() => [...new Set(participants.map(participant => participant.org).filter(Boolean))].sort(), [participants]);

  const scope = useMemo(() => {
    const fromDate = filters.from ? new Date(`${filters.from}T00:00:00`) : null;
    const toDate = filters.to ? new Date(`${filters.to}T23:59:59`) : null;

    const filteredActivities = activities.filter(activity => {
      if (filters.activity !== 'all' && String(activity.id) !== filters.activity) return false;
      if (filters.activityType !== 'all' && activity.type !== filters.activityType) return false;
      const start = safeDate(activity.start_date);
      const end = safeDate(activity.end_date) || start;
      if (fromDate && end && end < fromDate) return false;
      if (toDate && start && start > toDate) return false;
      return true;
    });

    const activityIds = new Set(filteredActivities.map(activity => String(activity.id)));
    const baseParticipants = participants.filter(participant => {
      if (filters.category !== 'all' && participant.category !== filters.category) return false;
      if (filters.organization !== 'all' && (participant.org || '') !== filters.organization) return false;
      return true;
    });
    const baseParticipantIds = new Set(baseParticipants.map(participant => String(participant.id)));

    const activityScopedRegistrations = registrations.filter(registration =>
      activityIds.has(String(registration.activity_id)) && baseParticipantIds.has(String(registration.participant_id))
    );
    const hasActivityScope = filters.activity !== 'all' || filters.activityType !== 'all' || Boolean(filters.from) || Boolean(filters.to);
    const engagedIds = new Set(activityScopedRegistrations.map(registration => String(registration.participant_id)));
    const filteredParticipants = baseParticipants.filter(participant => !hasActivityScope || engagedIds.has(String(participant.id)));
    const participantIds = new Set(filteredParticipants.map(participant => String(participant.id)));

    const filteredRegistrations = registrations.filter(registration =>
      activityIds.has(String(registration.activity_id)) && participantIds.has(String(registration.participant_id))
    );
    const filteredAttendance = attendance.filter(record =>
      activityIds.has(String(record.activity_id)) && participantIds.has(String(record.participant_id))
    );
    const filteredCertificates = certificates.filter(certificate =>
      activityIds.has(String(certificate.activity_id)) && participantIds.has(String(certificate.participant_id))
    );
    const filteredSurveys = surveys.filter(survey => activityIds.has(String(survey.activity_id)));
    const filteredAssessments = assessments.filter(assessment => {
      if (!assessment.activity_id) return !hasActivityScope;
      return activityIds.has(String(assessment.activity_id));
    });

    return {
      activities: filteredActivities,
      participants: filteredParticipants,
      registrations: filteredRegistrations,
      attendance: filteredAttendance,
      certificates: filteredCertificates,
      surveys: filteredSurveys,
      assessments: filteredAssessments,
    };
  }, [activities, participants, registrations, attendance, certificates, surveys, assessments, filters]);

  const activityMetrics = useMemo(() => scope.activities.map(activity => {
    const participantIds = scope.registrations
      .filter(registration => String(registration.activity_id) === String(activity.id))
      .map(registration => registration.participant_id);
    const attendancePcts = participantIds
      .map(participantId => getAttendancePct(activity.id, participantId))
      .filter(value => value !== null);
    const certificateCount = scope.certificates.filter(certificate => String(certificate.activity_id) === String(activity.id)).length;
    return {
      id: activity.id,
      title: activity.title,
      type: activity.type,
      dates: fmtRange({ start: activity.start_date, end: activity.end_date }),
      registered: participantIds.length,
      attendance: average(attendancePcts),
      certificates: certificateCount,
    };
  }), [scope.activities, scope.registrations, scope.certificates, getAttendancePct]);

  const participantCategories = useMemo(() => {
    const counts = new Map();
    scope.participants.forEach(participant => {
      const label = participant.category || 'Uncategorised';
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([label, value]) => ({ key: label, label, value }))
      .sort((a, b) => b.value - a.value);
  }, [scope.participants]);

  const participantOrganizations = useMemo(() => {
    const counts = new Map();
    scope.participants.forEach(participant => {
      const label = participant.org || 'Not specified';
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([label, value]) => ({ key: label, label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [scope.participants]);

  const attendanceStatuses = useMemo(() => {
    const order = ['present', 'late', 'absent'];
    const counts = new Map(order.map(status => [status, 0]));
    scope.attendance.forEach(record => counts.set(record.status, (counts.get(record.status) || 0) + 1));
    return [...counts.entries()]
      .filter(([, value]) => value > 0)
      .map(([status, value]) => ({ key: status, label: titleCase(status), value }));
  }, [scope.attendance]);

  const assessmentTypes = useMemo(() => {
    const counts = new Map();
    scope.assessments.forEach(assessment => {
      const label = titleCase(assessment.assessment_type || 'standalone');
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()].map(([label, value]) => ({ key: label, label, value }));
  }, [scope.assessments]);

  const surveyStatuses = useMemo(() => {
    const counts = new Map();
    scope.surveys.forEach(survey => {
      const label = titleCase(survey.status || 'unknown');
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()].map(([label, value]) => ({ key: label, label, value }));
  }, [scope.surveys]);

  const averageAttendance = useMemo(() => {
    const percentages = scope.registrations
      .map(registration => getAttendancePct(registration.activity_id, registration.participant_id))
      .filter(value => value !== null);
    return average(percentages);
  }, [scope.registrations, getAttendancePct]);

  const report = useMemo(() => {
    if (reportType === 'attendance') {
      return {
        title: 'Attendance report',
        cols: ['Activity', 'Participant', 'Session', 'Status'],
        rows: scope.attendance.map(record => [
          getActivity(record.activity_id)?.title || '',
          getParticipant(record.participant_id)?.name || '',
          record.session_label || '',
          titleCase(record.status),
        ]),
      };
    }

    if (reportType === 'participants') {
      return {
        title: 'Participant report',
        cols: ['Name', 'Email', 'Phone', 'Organization', 'Category', 'Activities', 'Attendance'],
        rows: scope.participants.map(participant => {
          const regs = scope.registrations.filter(registration => String(registration.participant_id) === String(participant.id));
          const pcts = regs.map(registration => getAttendancePct(registration.activity_id, participant.id)).filter(value => value !== null);
          const avg = average(pcts);
          return [
            participant.name,
            participant.email,
            participant.phone || '',
            participant.org || '',
            participant.category || '',
            String(regs.length),
            avg === null ? 'Not recorded' : `${avg}%`,
          ];
        }),
      };
    }

    if (reportType === 'surveys') {
      return {
        title: 'Survey report',
        cols: ['Survey title', 'Activity', 'Status', 'Created'],
        rows: scope.surveys.map(survey => [
          survey.title || 'Untitled survey',
          getActivity(survey.activity_id)?.title || 'Unknown activity',
          titleCase(survey.status || 'unknown'),
          survey.created_at ? fmtDate(survey.created_at) : 'Unknown',
        ]),
      };
    }

    if (reportType === 'assessments') {
      return {
        title: 'Assessment report',
        cols: ['Assessment', 'Activity', 'Type', 'Pass mark', 'Time limit', 'Status'],
        rows: scope.assessments.map(assessment => [
          assessment.title || 'Untitled assessment',
          assessment.activity_id ? (getActivity(assessment.activity_id)?.title || 'Unknown activity') : 'Standalone',
          titleCase(assessment.assessment_type || 'standalone'),
          `${assessment.passing_score ?? 70}%`,
          assessment.time_limit_minutes ? `${assessment.time_limit_minutes} min` : 'No limit',
          titleCase(assessment.status || 'unknown'),
        ]),
      };
    }

    if (reportType === 'certificates') {
      return {
        title: 'Certificate report',
        cols: ['Certificate no.', 'Participant', 'Activity', 'Issued'],
        rows: scope.certificates.map(certificate => [
          certificate.cert_no,
          getParticipant(certificate.participant_id)?.name || '',
          getActivity(certificate.activity_id)?.title || '',
          fmtDate(certificate.issued_date),
        ]),
      };
    }

    return {
      title: reportType === 'activities' ? 'Activity report' : 'Programme overview',
      cols: ['Activity', 'Type', 'Dates', 'Registered', 'Attendance', 'Certificates'],
      rows: activityMetrics.map(metric => [
        metric.title,
        metric.type || '',
        metric.dates,
        String(metric.registered),
        metric.attendance === null ? 'Not recorded' : `${metric.attendance}%`,
        String(metric.certificates),
      ]),
    };
  }, [reportType, scope, activityMetrics, getActivity, getParticipant, getAttendancePct]);

  const filterSummary = useMemo(() => {
    const labels = [];
    if (filters.activity !== 'all') labels.push(activities.find(activity => String(activity.id) === filters.activity)?.title || 'Selected activity');
    if (filters.activityType !== 'all') labels.push(filters.activityType);
    if (filters.category !== 'all') labels.push(filters.category);
    if (filters.organization !== 'all') labels.push(filters.organization);
    if (filters.from) labels.push(`from ${filters.from}`);
    if (filters.to) labels.push(`to ${filters.to}`);
    return labels.length ? labels.join(' · ') : 'All programme data';
  }, [filters, activities]);

  function updateFilter(name, value) {
    setFilters(current => ({ ...current, [name]: value }));
  }

  function exportCsv() {
    if (!report?.rows?.length || !csvExportAllowed) return;
    const esc = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const filterLine = [`Filters`, filterSummary];
    const csv = [
      filterLine.map(esc).join(','),
      report.cols.map(esc).join(','),
      ...report.rows.map(row => row.map(esc).join(',')),
    ].join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const anchor = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `lexams-${report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-filtered-${stamp}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>Loading report data...</div>;
  }

  const topActivityByAttendance = [...activityMetrics]
    .filter(metric => metric.attendance !== null)
    .sort((a, b) => b.attendance - a.attendance)[0];
  const topCategory = participantCategories[0];

  return (
    <div className="lexams-reports">
      <style>{`
        .lexams-reports { display:grid; gap:22px; }
        .lexams-reports * { box-sizing:border-box; }
        .lexams-reports-hero { padding:26px; border:1px solid var(--border-default); border-radius:18px; background:linear-gradient(135deg,var(--surface-card),var(--surface-muted)); }
        .lexams-report-types { display:flex; gap:8px; overflow-x:auto; padding-bottom:2px; }
        .lexams-type-btn,.lexams-section-btn { white-space:nowrap; border:1px solid var(--border-default); background:var(--surface-card); color:var(--text-secondary); border-radius:999px; padding:9px 13px; display:inline-flex; align-items:center; gap:7px; font-size:12px; font-weight:700; cursor:pointer; }
        .lexams-type-btn.active,.lexams-section-btn.active { background:var(--color-navy-900); border-color:var(--color-navy-900); color:#fff; }
        .lexams-filter-panel { border:1px solid var(--border-default); border-radius:16px; background:var(--surface-card); padding:18px; }
        .lexams-filter-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:14px; }
        .lexams-filter-field label { display:block; font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:6px; }
        .lexams-filter-field select,.lexams-filter-field input { width:100%; min-height:40px; border:1px solid var(--border-default); border-radius:10px; background:var(--surface-card); color:var(--text-primary); padding:8px 10px; font-size:13px; }
        .lexams-report-shell { border:1px solid var(--border-default); border-radius:18px; background:var(--surface-card); overflow:hidden; }
        .lexams-report-toolbar { padding:18px 20px; border-bottom:1px solid var(--border-default); display:flex; justify-content:space-between; gap:16px; align-items:flex-start; flex-wrap:wrap; }
        .lexams-section-nav { display:flex; gap:7px; flex-wrap:wrap; }
        .lexams-action-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .lexams-action { border:1px solid var(--border-default); background:var(--surface-card); color:var(--color-navy-900); border-radius:10px; padding:9px 12px; font-size:12px; font-weight:700; display:inline-flex; align-items:center; gap:7px; cursor:pointer; }
        .lexams-action.primary { background:var(--color-navy-900); color:#fff; border-color:var(--color-navy-900); }
        .lexams-action:disabled { opacity:.45; cursor:not-allowed; }
        .lexams-report-content { padding:20px; }
        .lexams-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
        .lexams-metric-card { border:1px solid var(--border-default); background:var(--surface-muted); border-radius:14px; padding:17px; min-height:116px; }
        .lexams-metric-label { font-size:11px; text-transform:uppercase; letter-spacing:.06em; font-weight:800; color:var(--text-tertiary); }
        .lexams-metric-value { font-family:var(--font-display); color:var(--color-navy-900); font-size:29px; font-weight:750; margin-top:9px; }
        .lexams-metric-note { font-size:11px; color:var(--text-tertiary); margin-top:5px; line-height:1.45; }
        .lexams-insights { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:14px; }
        .lexams-insight { border:1px solid var(--border-default); border-radius:14px; padding:17px; }
        .lexams-insight strong { display:block; color:var(--color-navy-900); font-size:13px; margin-bottom:5px; }
        .lexams-insight span { font-size:12px; line-height:1.55; color:var(--text-secondary); }
        .lexams-visual-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
        .lexams-chart-card { border:1px solid var(--border-default); border-radius:15px; padding:18px; min-height:220px; }
        .lexams-chart-title { color:var(--color-navy-900); font-size:14px; font-weight:800; }
        .lexams-chart-desc { color:var(--text-tertiary); font-size:11px; line-height:1.5; margin-top:4px; }
        .lexams-bars { display:grid; gap:13px; margin-top:17px; }
        .lexams-bar-row { display:grid; gap:6px; }
        .lexams-bar-meta { display:flex; justify-content:space-between; gap:12px; font-size:11px; color:var(--text-secondary); }
        .lexams-bar-meta span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .lexams-bar-meta strong { color:var(--color-navy-900); }
        .lexams-bar-track { height:8px; border-radius:999px; background:var(--surface-muted); overflow:hidden; }
        .lexams-bar-fill { height:100%; border-radius:999px; background:var(--color-navy-700); }
        .lexams-chart-empty { padding:42px 0; text-align:center; font-size:12px; color:var(--text-tertiary); }
        .lexams-report-scroll { overflow-x:auto; margin:-20px; }
        .lexams-table-head,.lexams-table-row { display:grid; gap:14px; padding:12px 20px; }
        .lexams-table-head { background:var(--surface-muted); font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--text-tertiary); font-weight:800; }
        .lexams-table-row { border-top:1px solid var(--border-default); font-size:12px; line-height:1.5; color:var(--text-secondary); }
        .lexams-empty-records { text-align:center; padding:44px 18px; color:var(--text-secondary); font-size:13px; }
        .lexams-empty-records span { display:block; color:var(--text-tertiary); font-size:11px; margin-top:6px; }
        .lexams-pro-note { font-size:10px; color:var(--text-tertiary); margin-top:5px; text-align:right; }
        @media(max-width:980px){.lexams-filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.lexams-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:720px){.lexams-visual-grid,.lexams-insights{grid-template-columns:1fr}.lexams-reports-hero{padding:20px}}
        @media(max-width:560px){.lexams-filter-grid,.lexams-metrics{grid-template-columns:1fr}.lexams-report-content{padding:16px}.lexams-report-scroll{margin:-16px}.lexams-report-toolbar{padding:16px}}
        @media print {
          .no-print,.lexams-filter-panel,.lexams-report-types,.lexams-section-nav,.lexams-action-row { display:none !important; }
          .lexams-reports { display:block; }
          .lexams-reports-hero { border:none; padding:0 0 18px; background:#fff; }
          .lexams-report-shell { border:none; }
          .lexams-report-toolbar { padding:0 0 16px; }
          .lexams-report-content { padding:0; }
          .lexams-chart-card,.lexams-metric-card,.lexams-insight { break-inside:avoid; }
        }
      `}</style>

      <section className="lexams-reports-hero">
        <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--color-navy-700)', fontWeight: 800 }}>Programme intelligence</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1.08, color: 'var(--color-navy-900)', margin: '8px 0 0' }}>Analyse programme performance in LexAMS</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.65, maxWidth: 760 }}>
          View reports by type and section, filter the underlying programme records, compare key indicators, and export only the data currently in scope.
        </p>
        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-tertiary)' }}>{filterSummary}</div>
      </section>

      <nav className="lexams-report-types no-print" aria-label="Report types">
        {reportTypes.map(({ key, icon: Icon, title }) => (
          <button key={key} type="button" className={`lexams-type-btn ${reportType === key ? 'active' : ''}`} onClick={() => { setReportType(key); setSection('overview'); }}>
            <Icon size={14} /> {title}
          </button>
        ))}
      </nav>

      <section className="lexams-filter-panel no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 800, color: 'var(--color-navy-900)' }}><Filter size={15} /> Report filters</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Filters update indicators, charts, records and exports together.</div>
          </div>
          <button type="button" className="lexams-action" onClick={() => setFilters(emptyFilters)}><RotateCcw size={14} /> Reset</button>
        </div>
        <div className="lexams-filter-grid">
          <div className="lexams-filter-field">
            <label>Activity</label>
            <select value={filters.activity} onChange={event => updateFilter('activity', event.target.value)}>
              <option value="all">All activities</option>
              {activities.map(activity => <option key={activity.id} value={String(activity.id)}>{activity.title}</option>)}
            </select>
          </div>
          <div className="lexams-filter-field">
            <label>Activity type</label>
            <select value={filters.activityType} onChange={event => updateFilter('activityType', event.target.value)}>
              <option value="all">All types</option>
              {activityTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="lexams-filter-field">
            <label>Participant category</label>
            <select value={filters.category} onChange={event => updateFilter('category', event.target.value)}>
              <option value="all">All categories</option>
              {categories.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
          <div className="lexams-filter-field">
            <label>Participant organisation</label>
            <select value={filters.organization} onChange={event => updateFilter('organization', event.target.value)}>
              <option value="all">All organisations</option>
              {organizations.map(organization => <option key={organization} value={organization}>{organization}</option>)}
            </select>
          </div>
          <div className="lexams-filter-field">
            <label>From date</label>
            <input type="date" value={filters.from} onChange={event => updateFilter('from', event.target.value)} />
          </div>
          <div className="lexams-filter-field">
            <label>To date</label>
            <input type="date" value={filters.to} onChange={event => updateFilter('to', event.target.value)} />
          </div>
        </div>
      </section>

      <section className="lexams-report-shell">
        <div className="lexams-report-toolbar">
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-navy-900)' }}>{report.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{filterSummary}</div>
          </div>
          <div>
            <div className="lexams-action-row no-print">
              <button type="button" className="lexams-action" onClick={() => window.print()} disabled={!csvExportAllowed || !billingLoaded}><Printer size={14} /> Print / Save PDF</button>
              <button type="button" className="lexams-action primary" onClick={exportCsv} disabled={!report.rows.length || !csvExportAllowed || !billingLoaded}>Export filtered CSV</button>
            </div>
            {!csvExportAllowed && billingLoaded && <div className="lexams-pro-note no-print">Filtered exports are available on LexAMS Pro.</div>}
          </div>
        </div>

        <div className="lexams-report-toolbar no-print" style={{ paddingTop: 12, paddingBottom: 12 }}>
          <div className="lexams-section-nav">
            {sections.map(item => (
              <button key={item.key} type="button" className={`lexams-section-btn ${section === item.key ? 'active' : ''}`} onClick={() => setSection(item.key)}>{item.label}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{report.rows.length} filtered record{report.rows.length === 1 ? '' : 's'}</div>
        </div>

        <div className="lexams-report-content">
          {section === 'overview' && (
            <>
              <div className="lexams-metrics">
                <MetricCard label="Activities" value={scope.activities.length} note="Activities in the current filter scope" />
                <MetricCard label="Participants" value={scope.participants.length} note={`${scope.registrations.length} registrations in scope`} />
                <MetricCard label="Average attendance" value={averageAttendance === null ? '—' : `${averageAttendance}%`} note="Average across registered participant/activity pairs" />
                <MetricCard label="Certificates" value={scope.certificates.length} note={`${scope.surveys.length} surveys · ${scope.assessments.length} assessments`} />
              </div>

              <div className="lexams-insights">
                <div className="lexams-insight">
                  <strong>Attendance signal</strong>
                  <span>{topActivityByAttendance ? `${topActivityByAttendance.title} has the highest recorded average attendance in this scope at ${topActivityByAttendance.attendance}%.` : 'Attendance analysis will appear after session attendance is recorded.'}</span>
                </div>
                <div className="lexams-insight">
                  <strong>Participant mix</strong>
                  <span>{topCategory ? `${topCategory.label} is the largest participant category in this scope with ${topCategory.value} participant${topCategory.value === 1 ? '' : 's'}.` : 'Participant composition will appear when matching participant records exist.'}</span>
                </div>
              </div>
            </>
          )}

          {section === 'visuals' && (
            <div className="lexams-visual-grid">
              <HorizontalBars
                title="Attendance by activity"
                description="Average participant attendance percentage for activities in the current scope."
                valueSuffix="%"
                data={activityMetrics.filter(metric => metric.attendance !== null).map(metric => ({ key: metric.id, label: metric.title, value: metric.attendance }))}
              />
              <HorizontalBars
                title="Registrations by activity"
                description="Filtered registration volume across activities."
                data={activityMetrics.map(metric => ({ key: metric.id, label: metric.title, value: metric.registered }))}
              />
              <HorizontalBars
                title="Participant categories"
                description="Composition of participants in the current report scope."
                data={participantCategories}
              />
              <HorizontalBars
                title="Participant organisations"
                description="Top organisations represented by filtered participants."
                data={participantOrganizations}
              />
              <HorizontalBars
                title="Attendance status records"
                description="Present, late and absent session records in the current scope."
                data={attendanceStatuses}
              />
              <HorizontalBars
                title="Certificates by activity"
                description="Certificates issued for filtered activities and participants."
                data={activityMetrics.map(metric => ({ key: metric.id, label: metric.title, value: metric.certificates }))}
              />
              {(reportType === 'surveys' || reportType === 'portfolio') && (
                <HorizontalBars title="Survey status" description="Survey collection status for filtered activities." data={surveyStatuses} />
              )}
              {(reportType === 'assessments' || reportType === 'portfolio') && (
                <HorizontalBars title="Assessment types" description="Pre-test, post-test and standalone assessment coverage." data={assessmentTypes} />
              )}
            </div>
          )}

          {section === 'records' && <RecordTable report={report} />}
        </div>
      </section>
    </div>
  );
}
