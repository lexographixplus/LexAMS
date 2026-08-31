import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import SkeletonScreen from '../components/Skeleton';
import { fmtRange, statusChip } from '../lib/format';
import {
  ArrowRight,
  Award,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  UserPlus,
  Users,
} from 'lucide-react';

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export default function Dashboard() {
  const {
    activities,
    participants,
    registrations,
    attendance,
    certificates,
    surveys,
    assessments,
    loading,
    getRegsForActivity,
    getAttendancePct,
  } = useData();
  const navigate = useNavigate();
  const { profile } = useAuth();

  if (loading) return <SkeletonScreen cards={4} label="Loading your workspace" />;

  const ongoing = activities.filter(a => normalizeStatus(a.status) === 'ongoing');
  const upcoming = activities
    .filter(a => normalizeStatus(a.status) === 'upcoming')
    .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
  const completed = activities.filter(a => normalizeStatus(a.status) === 'completed');

  const totalReach = new Set(registrations.map(r => r.participant_id)).size;
  const allPcts = [];
  activities.forEach(a => {
    getRegsForActivity(a.id).forEach(pid => {
      const pct = getAttendancePct(a.id, pid);
      if (pct !== null) allPcts.push(pct);
    });
  });
  const avgAttendance = allPcts.length ? Math.round(allPcts.reduce((sum, n) => sum + n, 0) / allPcts.length) : null;

  const attention = [];

  ongoing.forEach(activity => {
    const registered = getRegsForActivity(activity.id).length;
    const attendanceRows = attendance.filter(row => row.activity_id === activity.id).length;
    if (registered > 0 && attendanceRows === 0) {
      attention.push({
        kind: 'Attendance',
        title: activity.title,
        detail: `${registered} registered, attendance has not been recorded yet`,
        path: `/app/activities/${activity.id}`,
      });
    }
  });

  upcoming.forEach(activity => {
    const days = daysUntil(activity.start_date);
    if (days !== null && days >= 0 && days <= 7) {
      attention.push({
        kind: days === 0 ? 'Today' : 'Starting soon',
        title: activity.title,
        detail: days === 0 ? 'Starts today' : `Starts in ${days} day${days === 1 ? '' : 's'}`,
        path: `/app/activities/${activity.id}`,
      });
    }
  });

  surveys
    .filter(s => ['active', 'open'].includes(normalizeStatus(s.status)))
    .slice(0, 2)
    .forEach(s => attention.push({
      kind: 'Survey',
      title: s.title || 'Active survey',
      detail: 'Public responses are currently open',
      path: '/app/surveys',
    }));

  assessments
    .filter(a => ['active', 'open'].includes(normalizeStatus(a.status)))
    .slice(0, 2)
    .forEach(a => attention.push({
      kind: 'Assessment',
      title: a.title || 'Active assessment',
      detail: 'Submissions are currently open',
      path: '/app/assessments',
    }));

  const activeSurveys = surveys.filter(x => ['active', 'open'].includes(normalizeStatus(x.status))).length;
  const activeAssessments = assessments.filter(x => ['active', 'open'].includes(normalizeStatus(x.status))).length;
  const nothingRunning = !ongoing.length && !upcoming.length && !activeSurveys && !activeAssessments;

  const workspaceName = profile?.org_name || 'Your workspace';
  // The header says what is true of this workspace right now, rather than
  // describing what the page is for.
  const stateSummary = !activities.length
    ? 'No activities yet. Create your first one to start tracking registration, attendance and results.'
    : nothingRunning
      ? `Nothing is running right now. ${completed.length} completed ${completed.length === 1 ? 'activity' : 'activities'} on record.`
      : [
          ongoing.length ? `${ongoing.length} ongoing` : null,
          upcoming.length ? `${upcoming.length} upcoming` : null,
          activeSurveys ? `${activeSurveys} open ${activeSurveys === 1 ? 'survey' : 'surveys'}` : null,
          activeAssessments ? `${activeAssessments} open ${activeAssessments === 1 ? 'assessment' : 'assessments'}` : null,
        ].filter(Boolean).join(' · ');

  const recent = [...activities]
    .sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')))
    .slice(0, 5);

  return (
    <div>
      <style>{`
        .lexdash-summary { display:grid; grid-template-columns: repeat(4,1fr); gap:12px; }
        .lexdash-main { display:grid; grid-template-columns: 1.15fr .85fr; gap:20px; margin-top:20px; }
        .lexdash-activity-row { display:grid; grid-template-columns: 1.8fr .8fr 1fr .7fr; gap:14px; align-items:center; }
        @media (max-width: 1100px) {
          .lexdash-summary { grid-template-columns: repeat(2,1fr); }
          .lexdash-main { grid-template-columns: 1fr; }
        }
        @media (max-width: 760px) {
          .lexdash-summary { grid-template-columns: 1fr 1fr; }
          .lexdash-activity-row { grid-template-columns: 1fr; gap:5px; }
        }
        /* Kept two-up on a phone: one card per row pushed the workspace's own
           figures below the fold, which is what this screen exists to show. */
        @media (max-width: 480px) {
          .lexdash-summary { grid-template-columns: 1fr 1fr; gap:10px; }
        }
      `}</style>

      <header className="lx-page-head">
        <div>
          <h1>{workspaceName}</h1>
          <p>{stateSummary}</p>
        </div>
        <div className="lx-page-actions">
          <button type="button" className="lx-btn lx-btn-secondary" onClick={() => navigate('/app/participants')}>
            <UserPlus size={16} aria-hidden="true" /> Add participant
          </button>
          <button type="button" className="lx-btn lx-btn-primary" onClick={() => navigate('/app/activities')}>
            <CalendarPlus size={16} aria-hidden="true" /> New activity
          </button>
        </div>
      </header>

      <div className="lexdash-summary">
        <Metric label="Activities" value={activities.length} sub={`${ongoing.length} ongoing`} icon={CalendarPlus} />
        <Metric label="People reached" value={totalReach} sub={`${participants.length} participant records`} icon={Users} />
        <Metric label="Attendance" value={avgAttendance === null ? 'No data' : `${avgAttendance}%`} sub="Average recorded rate" icon={CheckCircle2} />
        <Metric label="Certificates" value={certificates.length} sub={`${completed.length} completed activities`} icon={Award} />
      </div>

      <div className="lexdash-main">
        <section style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18 }}>
            <div>
              <div style={eyebrowStyle}>Attention</div>
              <h3 style={sectionTitleStyle}>What needs a look</h3>
              <p style={sectionCopyStyle}>Operational items that may need action or follow-up.</p>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{attention.length} item{attention.length === 1 ? '' : 's'}</span>
          </div>

          <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
            {attention.length === 0 ? (
              <div style={emptyStateStyle}>
                <CheckCircle2 size={22} color="var(--color-success)" />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Nothing urgent right now</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>New operational signals will appear here as your activities move.</div>
                </div>
              </div>
            ) : attention.slice(0, 6).map((item, index) => (
              <button key={`${item.kind}-${item.title}-${index}`} onClick={() => navigate(item.path)} style={attentionItemStyle}>
                <div style={{ minWidth: 82, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-navy-700)', fontWeight: 700 }}>{item.kind}</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{item.detail}</div>
                </div>
                <ArrowRight size={15} color="var(--text-tertiary)" />
              </button>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={eyebrowStyle}>Now</div>
              <h3 style={sectionTitleStyle}>Current operations</h3>
            </div>
            <Clock3 size={19} color="var(--color-gold-500)" aria-hidden="true" />
          </div>
          {nothingRunning ? (
            // Four zeros beside a summary row reporting real totals reads as a
            // broken panel. When nothing is running, say so once.
            <div className="lx-state" style={{ marginTop: 20 }}>
              <CheckCircle2 className="lx-state-icon" size={20} color="var(--color-success)" aria-hidden="true" />
              <div>
                <strong>Nothing is running right now</strong>
                <p>
                  {activities.length
                    ? 'No activity, survey or assessment is currently open. Scheduling the next one will show it here.'
                    : 'Your first activity will appear here once you create it.'}
                </p>
                <div className="lx-state-actions">
                  <button type="button" className="lx-btn lx-btn-secondary lx-btn-small" onClick={() => navigate('/app/activities')}>
                    Go to activities
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14, marginTop: 22 }}>
              <Signal label="Ongoing activities" value={ongoing.length} />
              <Signal label="Upcoming activities" value={upcoming.length} />
              <Signal label="Active surveys" value={activeSurveys} />
              <Signal label="Active assessments" value={activeAssessments} />
            </div>
          )}
        </section>
      </div>

      <div className="lexdash-main">
        <section style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '22px 24px 16px' }}>
            <div style={eyebrowStyle}>Activity pulse</div>
            <h3 style={sectionTitleStyle}>Recent programme activity</h3>
          </div>
          {recent.length === 0 ? (
            <div style={{ padding: '22px 24px 28px', color: 'var(--text-tertiary)', fontSize: 13 }}>No activities yet.</div>
          ) : recent.map(activity => (
            <button
              key={activity.id}
              className="lexdash-activity-row"
              onClick={() => navigate(`/app/activities/${activity.id}`)}
              style={activityRowStyle}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{activity.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{getRegsForActivity(activity.id).length} registered</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'left' }}>{activity.type}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'left' }}>{fmtRange({ start: activity.start_date, end: activity.end_date })}</div>
              <div style={{ textAlign: 'left' }}><span style={statusChip(activity.status)}>{activity.status}</span></div>
            </button>
          ))}
        </section>

        <section style={panelStyle}>
          <div style={eyebrowStyle}>Next up</div>
          <h3 style={sectionTitleStyle}>Upcoming activities</h3>
          <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
            {upcoming.length === 0 ? (
              <div style={emptyStateStyle}>
                <CalendarPlus size={20} color="var(--color-navy-700)" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>No upcoming activities</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>Create the next activity when you are ready.</div>
                </div>
              </div>
            ) : upcoming.slice(0, 5).map(activity => {
              const days = daysUntil(activity.start_date);
              return (
                <button key={activity.id} onClick={() => navigate(`/app/activities/${activity.id}`)} style={upcomingStyle}>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{activity.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{fmtRange({ start: activity.start_date, end: activity.end_date })}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {days === null ? '' : days === 0 ? 'Today' : days > 0 ? `${days}d` : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, icon: Icon }) {
  return (
    <div style={metricStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={eyebrowStyle}>{label}</div>
        <Icon size={17} color="var(--color-navy-700)" />
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: typeof value === 'string' && value.length > 6 ? 24 : 31, fontWeight: 700, marginTop: 13, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 9 }}>{sub}</div>
    </div>
  );
}

function Signal({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, paddingBottom: 12, borderBottom: '1px solid var(--border-default)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <strong style={{ fontFamily: 'var(--font-display)', fontSize: 19 }}>{value}</strong>
    </div>
  );
}

const panelStyle = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 16,
  boxShadow: 'var(--shadow-card)',
  padding: '24px',
};

const metricStyle = {
  ...panelStyle,
  padding: '18px 20px',
};

const eyebrowStyle = {
  fontSize: 12,
  letterSpacing: '.11em',
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  fontWeight: 700,
};

const sectionTitleStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 20,
  margin: '7px 0 0',
};

const sectionCopyStyle = {
  fontSize: 12,
  lineHeight: 1.6,
  color: 'var(--text-secondary)',
  margin: '7px 0 0',
};



const emptyStateStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  border: '1px dashed var(--border-default)',
  borderRadius: 12,
  padding: '18px',
  background: 'var(--surface-muted)',
};

const attentionItemStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  border: '1px solid var(--border-default)',
  borderRadius: 11,
  padding: '13px 14px',
  background: '#FFFFFF',
  cursor: 'pointer',
};


const activityRowStyle = {
  width: '100%',
  padding: '13px 24px',
  border: 'none',
  borderTop: '1px solid var(--border-default)',
  background: '#FFFFFF',
  cursor: 'pointer',
};

const upcomingStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  border: '1px solid var(--border-default)',
  borderRadius: 10,
  background: '#FFFFFF',
  padding: '12px 13px',
  cursor: 'pointer',
};

