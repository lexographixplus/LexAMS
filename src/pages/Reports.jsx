import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { fmtRange, fmtDate } from '../lib/format';
import { Activity, Award, ClipboardList, FileSpreadsheet, Users } from 'lucide-react';

const reportTypes = [
  { key: 'acts', icon: Activity, title: 'Activity summary', desc: 'Programme overview with registration, attendance and certificate counts.' },
  { key: 'att', icon: ClipboardList, title: 'Attendance records', desc: 'Session-level attendance records across all activities.' },
  { key: 'parts', icon: Users, title: 'Participant list', desc: 'Participant records with contact details and activity counts.' },
  { key: 'surveys', icon: FileSpreadsheet, title: 'Survey analysis', desc: 'Survey titles, activity links and current status.' },
  { key: 'certs', icon: Award, title: 'Certificate register', desc: 'Issued certificates with participant and activity details.' },
];

export default function Reports() {
  const {
    activities, participants, registrations, attendance, certificates, surveys,
    loading, getRegsForActivity, getAttendancePct, getActivity, getParticipant,
  } = useData();
  const [report, setReport] = useState(null);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>Loading report data...</div>;
  }

  function genReport(type) {
    let rep;
    if (type === 'acts') {
      rep = {
        title: 'Activity summary',
        cols: ['Activity', 'Type', 'Dates', 'Registered', 'Attendance', 'Certificates'],
        rows: activities.map(a => {
          const pids = getRegsForActivity(a.id);
          const pcts = pids.map(p => getAttendancePct(a.id, p)).filter(v => v !== null);
          const avg = pcts.length ? Math.round(pcts.reduce((x, y) => x + y, 0) / pcts.length) + '%' : 'Not recorded';
          return [a.title, a.type, fmtRange({ start: a.start_date, end: a.end_date }), String(pids.length), avg, String(certificates.filter(c => c.activity_id === a.id).length)];
        }),
      };
    } else if (type === 'att') {
      rep = {
        title: 'Attendance records',
        cols: ['Activity', 'Participant', 'Session', 'Status'],
        rows: attendance.map(a => {
          const act = getActivity(a.activity_id);
          const part = getParticipant(a.participant_id);
          return [act?.title || '', part?.name || '', a.session_label, a.status.charAt(0).toUpperCase() + a.status.slice(1)];
        }),
      };
    } else if (type === 'parts') {
      rep = {
        title: 'Participant list',
        cols: ['Name', 'Email', 'Phone', 'Organization', 'Category', 'Activities'],
        rows: participants.map(p => [p.name, p.email, p.phone || '', p.org || '', p.category, String(registrations.filter(r => r.participant_id === p.id).length)]),
      };
    } else if (type === 'surveys') {
      rep = {
        title: 'Survey analysis',
        cols: ['Survey title', 'Activity', 'Status', 'Created'],
        rows: surveys.map(s => {
          const act = getActivity(s.activity_id);
          return [s.title || 'Untitled survey', act?.title || 'Unknown activity', s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : 'Unknown', s.created_at ? fmtDate(s.created_at) : 'Unknown'];
        }),
      };
    } else {
      rep = {
        title: 'Certificate register',
        cols: ['Certificate no.', 'Participant', 'Activity', 'Issued'],
        rows: certificates.map(c => [c.cert_no, getParticipant(c.participant_id)?.name || '', getActivity(c.activity_id)?.title || '', fmtDate(c.issued_date)]),
      };
    }
    setReport(rep);
  }

  function exportCsv() {
    if (!report) return;
    const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csv = [report.cols.map(esc).join(','), ...report.rows.map(row => row.map(esc).join(','))].join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `lexams-${report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const colCount = report ? report.cols.length : 1;
  const totalRecords = activities.length + participants.length + attendance.length + certificates.length + surveys.length;

  return (
    <div className="lexams-reports">
      <style>{`
        .lexams-reports { display: grid; gap: 24px; }
        .lexams-reports-hero { padding: 26px; border: 1px solid var(--border-default); border-radius: 18px; background: linear-gradient(135deg,var(--surface-card),var(--surface-muted)); }
        .lexams-reports-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
        .lexams-report-card { border:1px solid var(--border-default); border-radius:16px; background:var(--surface-card); padding:20px; cursor:pointer; min-height:162px; transition:transform 140ms ease,border-color 140ms ease,box-shadow 140ms ease; }
        .lexams-report-card:hover { transform:translateY(-2px); border-color:var(--color-navy-700); box-shadow:var(--shadow-card); }
        .lexams-report-icon { width:42px;height:42px;border-radius:11px;background:#EEF3F8;color:var(--color-navy-700);display:grid;place-items:center; }
        .lexams-report-table { overflow:hidden; border:1px solid var(--border-default); border-radius:16px; background:var(--surface-card); }
        .lexams-report-scroll { overflow-x:auto; }
        @media(max-width:900px){.lexams-reports-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:620px){.lexams-reports-grid{grid-template-columns:1fr}.lexams-reports-hero{padding:20px}}
      `}</style>

      <section className="lexams-reports-hero">
        <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--color-navy-700)', fontWeight: 800 }}>Operational reporting</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1.08, color: 'var(--color-navy-900)', margin: '8px 0 0' }}>Reports built from live programme records</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.65, maxWidth: 700 }}>Choose a report to review the current workspace data, then export the complete result as CSV for further analysis or sharing.</p>
        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>{totalRecords} live records available across activities, participants, attendance, certificates and surveys.</div>
      </section>

      <section>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Choose a report</div>
        <div className="lexams-reports-grid">
          {reportTypes.map(({ key, icon: Icon, title, desc }) => (
            <article key={key} className="lexams-report-card" onClick={() => genReport(key)}>
              <div className="lexams-report-icon"><Icon size={19} /></div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-navy-900)', marginTop: 18 }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>{desc}</div>
            </article>
          ))}
        </div>
      </section>

      {report ? (
        <section className="lexams-report-table">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '18px 22px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-navy-900)' }}>{report.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{report.rows.length} record{report.rows.length === 1 ? '' : 's'}</div>
            </div>
            <button onClick={exportCsv} disabled={!report.rows.length} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 700, background: 'var(--color-navy-900)', border: 'none', borderRadius: 'var(--radius-md)', color: '#fff', cursor: report.rows.length ? 'pointer' : 'not-allowed', opacity: report.rows.length ? 1 : .5 }}>Export CSV</button>
          </div>
          {report.rows.length ? (
            <div className="lexams-report-scroll">
              <div style={{ minWidth: Math.max(720, colCount * 150) }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colCount}, minmax(120px, 1fr))`, gap: 14, padding: '12px 22px', fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700, background: 'var(--surface-muted)' }}>
                  {report.cols.map(c => <div key={c}>{c}</div>)}
                </div>
                {report.rows.map((row, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${colCount}, minmax(120px, 1fr))`, gap: 14, padding: '12px 22px', borderTop: '1px solid var(--border-default)' }}>
                    {row.map((cell, j) => <div key={j} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{cell}</div>)}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '42px 22px', textAlign: 'center', borderTop: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>No records in this report yet</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>As the workspace collects data, it will appear here automatically.</div>
            </div>
          )}
        </section>
      ) : (
        <section style={{ padding: '34px 24px', border: '1px dashed var(--border-default)', borderRadius: 16, textAlign: 'center', background: 'var(--surface-muted)' }}>
          <FileSpreadsheet size={24} style={{ color: 'var(--color-navy-700)' }} />
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 12 }}>Select a report to begin</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>The report preview and export controls will appear here.</div>
        </section>
      )}
    </div>
  );
}
