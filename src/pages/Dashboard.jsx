import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { fmtRange, statusChip } from '../lib/format';

export default function Dashboard() {
  const {
    activities, participants, registrations, certificates, surveys,
    loading, getRegsForActivity, getAttendancePct,
  } = useData();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '60vh', color: 'var(--text-secondary)', fontSize: 14,
      }}>
        Loading dashboard...
      </div>
    );
  }

  // KPIs
  const totalReach = new Set(registrations.map(r => r.participant_id)).size;
  const allPcts = [];
  activities.forEach(a => {
    getRegsForActivity(a.id).forEach(pid => {
      const p = getAttendancePct(a.id, pid);
      if (p !== null) allPcts.push(p);
    });
  });
  const avgAtt = allPcts.length ? Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length) : 0;

  const kpis = [
    { label: 'Total activities', value: activities.length, sub: `${activities.filter(a => a.status === 'Ongoing').length} ongoing` },
    { label: 'Total reach', value: totalReach, sub: `${participants.length} in database` },
    { label: 'Attendance rate', value: avgAtt + '%', sub: 'Across all sessions' },
    { label: 'Certificates', value: certificates.length, sub: `${activities.filter(a => a.status === 'Completed').length} completed activities` },
  ];

  // Chart data - activities by month
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();
  const monthCounts = months.map((m, i) => {
    return activities.filter(a => {
      if (!a.start_date) return false;
      const d = new Date(a.start_date + 'T00:00:00');
      return d.getFullYear() === currentYear && d.getMonth() === i;
    }).length;
  });
  // Only show months that have data or up to the current month
  const currentMonth = new Date().getMonth();
  const visibleMonths = months.slice(0, currentMonth + 1);
  const visibleCounts = monthCounts.slice(0, currentMonth + 1);
  const maxCount = Math.max(...visibleCounts, 1);

  // Survey engagement
  const totalSurveys = surveys.length;
  const completedSurveys = surveys.filter(s => s.status === 'completed' || s.status === 'closed').length;
  const svCompletion = totalSurveys ? Math.round(completedSurveys / totalSurveys * 100) : 0;

  // Recent & upcoming
  const recent = [...activities]
    .filter(a => a.status !== 'Upcoming')
    .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))
    .slice(0, 4);
  const upcoming = activities.filter(a => a.status === 'Upcoming');

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            background: 'var(--surface-card)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
            padding: '20px 22px',
          }}>
            <div style={{
              fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--text-tertiary)', fontWeight: 600,
            }}>{k.label}</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700,
              marginTop: 8, lineHeight: 1,
            }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginTop: 20 }}>
        {/* Bar chart */}
        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
          padding: '22px 24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Activities by month</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{currentYear}</div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 14,
            height: 150, marginTop: 18,
          }}>
            {visibleMonths.map((m, i) => (
              <div key={m} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'flex-end',
                gap: 6, height: '100%',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {visibleCounts[i]}
                </div>
                <div style={{
                  width: '100%', borderRadius: '4px 4px 0 0',
                  background: visibleCounts[i] ? 'var(--color-navy-700)' : 'var(--surface-muted)',
                  height: `${(visibleCounts[i] / maxCount) * 100}%`,
                  minHeight: visibleCounts[i] ? 8 : 4,
                  transition: 'height 300ms',
                }} />
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Engagement */}
        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
          padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Engagement</div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Surveys created</span>
              <span style={{ fontWeight: 600 }}>{totalSurveys}</span>
            </div>
            <div style={{
              height: 6, background: 'var(--surface-muted)', borderRadius: 999,
              marginTop: 8, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 999,
                background: 'var(--color-navy-700)',
                width: `${svCompletion}%`,
              }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
              {completedSurveys} of {totalSurveys} completed
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Registrations</span>
              <span style={{ fontWeight: 600 }}>{registrations.length}</span>
            </div>
            <div style={{
              height: 6, background: 'var(--surface-muted)', borderRadius: 999,
              marginTop: 8, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 999,
                background: 'var(--color-gold-500)',
                width: activities.length ? `${Math.min((registrations.length / (activities.length * 10)) * 100, 100)}%` : '0%',
              }} />
            </div>
          </div>
          <div style={{
            marginTop: 'auto', borderTop: '1px solid var(--border-default)',
            paddingTop: 14, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
          }}>
            <span style={{ color: 'var(--color-gold-500)', fontSize: 10, verticalAlign: 2 }}>
              {'\u25CF'}
            </span>
            &nbsp; {certificates.length} certificates issued across {activities.filter(a => a.status === 'Completed').length} activities
          </div>
        </div>
      </div>

      {/* Recent & Upcoming */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginTop: 20 }}>
        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden',
        }}>
          <div style={{ padding: '18px 22px 14px', fontSize: 14, fontWeight: 600 }}>
            Recent activities
          </div>
          {recent.length === 0 && (
            <div style={{ padding: '20px 22px', fontSize: 13, color: 'var(--text-tertiary)' }}>
              No recent activities yet.
            </div>
          )}
          {recent.map(a => (
            <div
              key={a.id}
              onClick={() => navigate(`/app/activities/${a.id}`)}
              style={{
                display: 'grid', gridTemplateColumns: '2.2fr 1fr 1.1fr 0.9fr',
                gap: 14, alignItems: 'center', padding: '13px 22px',
                borderTop: '1px solid var(--border-default)', cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-muted)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.type}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {fmtRange({ start: a.start_date, end: a.end_date })}
              </div>
              <div><span style={statusChip(a.status)}>{a.status}</span></div>
            </div>
          ))}
        </div>

        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '18px 22px',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Upcoming</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            {upcoming.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                No upcoming activities.
              </div>
            )}
            {upcoming.map(a => (
              <div
                key={a.id}
                onClick={() => navigate(`/app/activities/${a.id}`)}
                style={{
                  cursor: 'pointer', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', padding: '12px 14px',
                  transition: 'border-color 120ms',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-navy-700)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = ''}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {fmtRange({ start: a.start_date, end: a.end_date })} &middot; {a.venue}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {getRegsForActivity(a.id).length} registered
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
