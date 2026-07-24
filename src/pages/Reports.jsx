import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { fmtRange, fmtDate } from '../lib/format';

const reportTypes = [
  { key: 'acts', title: 'Activity summary', desc: 'Overview of all activities with registration and attendance stats.' },
  { key: 'att', title: 'Attendance records', desc: 'Session-level attendance records for all participants.' },
  { key: 'parts', title: 'Participant list', desc: 'Full participant database with contact details and activity counts.' },
  { key: 'surveys', title: 'Survey analysis', desc: 'Survey count, titles and status across activities.' },
  { key: 'certs', title: 'Certificate register', desc: 'All issued certificates with participant and activity details.' },
];

export default function Reports() {
  const {
    activities, participants, registrations, attendance, certificates, surveys,
    loading, getRegsForActivity, getAttendancePct, getActivity, getParticipant,
  } = useData();
  const [report, setReport] = useState(null);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
        Loading report data...
      </div>
    );
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
          const avg = pcts.length ? Math.round(pcts.reduce((x, y) => x + y, 0) / pcts.length) + '%' : '\u2014';
          return [
            a.title, a.type,
            fmtRange({ start: a.start_date, end: a.end_date }),
            String(pids.length), avg,
            String(certificates.filter(c => c.activity_id === a.id).length),
          ];
        }),
      };
    } else if (type === 'att') {
      rep = {
        title: 'Attendance records',
        cols: ['Activity', 'Participant', 'Session', 'Status'],
        rows: attendance.slice(0, 120).map(a => {
          const act = getActivity(a.activity_id);
          const part = getParticipant(a.participant_id);
          return [act?.title || '', part?.name || '', a.session_label, a.status.charAt(0).toUpperCase() + a.status.slice(1)];
        }),
      };
    } else if (type === 'parts') {
      rep = {
        title: 'Participant list',
        cols: ['Name', 'Email', 'Phone', 'Organization', 'Category', 'Activities'],
        rows: participants.map(p => [
          p.name, p.email, p.phone, p.org, p.category,
          String(registrations.filter(r => r.participant_id === p.id).length),
        ]),
      };
    } else if (type === 'surveys') {
      rep = {
        title: 'Survey analysis',
        cols: ['Survey title', 'Activity', 'Status', 'Created'],
        rows: surveys.map(s => {
          const act = getActivity(s.activity_id);
          return [
            s.title || '\u2014',
            act?.title || '\u2014',
            s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : '\u2014',
            s.created_at ? fmtDate(s.created_at) : '\u2014',
          ];
        }),
      };
    } else {
      rep = {
        title: 'Certificate register',
        cols: ['Certificate no.', 'Participant', 'Activity', 'Issued'],
        rows: certificates.map(c => [
          c.cert_no,
          getParticipant(c.participant_id)?.name || '',
          getActivity(c.activity_id)?.title || '',
          fmtDate(c.issued_date),
        ]),
      };
    }
    setReport(rep);
  }

  function exportCsv() {
    if (!report) return;
    const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
    const csv = [report.cols.map(esc).join(','), ...report.rows.map(row => row.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = report.title.toLowerCase().replace(/\s+/g, '-') + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const colCount = report ? report.cols.length : 1;

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>Reports</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
        Generate summaries from live activity data. Export as CSV for sharing.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 22 }}>
        {reportTypes.map(r => (
          <div
            key={r.key}
            onClick={() => genReport(r.key)}
            style={{
              background: 'var(--surface-card)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
              padding: '20px 22px', cursor: 'pointer', transition: 'border-color 120ms',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-navy-700)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = ''}
          >
            <div style={{ fontSize: 14, fontWeight: 600 }}>{r.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{r.desc}</div>
          </div>
        ))}
      </div>

      {report && (
        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
          overflow: 'hidden', marginTop: 24,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 22px',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{report.title}</div>
            <button onClick={exportCsv} style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              background: 'transparent', border: '1.5px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)', color: 'var(--color-navy-700)',
            }}>Export CSV</button>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${colCount}, 1fr)`,
            gap: 14, padding: '12px 22px',
            fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase',
            color: 'var(--text-tertiary)', fontWeight: 600, background: 'var(--surface-muted)',
          }}>
            {report.cols.map(c => <div key={c}>{c}</div>)}
          </div>
          {report.rows.map((row, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${colCount}, 1fr)`,
              gap: 14, padding: '11px 22px',
              borderTop: '1px solid var(--border-default)',
            }}>
              {row.map((cell, j) => (
                <div key={j} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{cell}</div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
