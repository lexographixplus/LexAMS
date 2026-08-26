import { ArrowRight, ClipboardCheck, GraduationCap, Mail, MessageCircle, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { fmtRange } from '../lib/format';

const card = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)',
  padding: '22px 24px',
};

const actionLink = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  color: 'var(--color-navy-800)',
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
};

function ActionCard({ icon: Icon, title, description, count, to }) {
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', minHeight: 180 }}>
      <div style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'var(--surface-muted)', color: 'var(--color-navy-800)' }}>
        <Icon size={19} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 15 }}>{title}</div>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', marginTop: 6, flex: 1 }}>{description}</p>
      <Link to={to} style={actionLink}>Open {title.toLowerCase()} <ArrowRight size={15} /></Link>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>{count}</div>
    </div>
  );
}

export default function Communication() {
  const { loading, activities, participants, surveys, assessments } = useData();
  const touchpoints = activities.slice(0, 6).map(activity => ({
    ...activity,
    surveyCount: surveys.filter(survey => String(survey.activity_id) === String(activity.id)).length,
    assessmentCount: assessments.filter(assessment => String(assessment.activity_id) === String(activity.id)).length,
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Workspace</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginTop: 5 }}>Communication</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, maxWidth: 620, lineHeight: 1.55 }}>
            Keep participant feedback, learning follow-up, and team coordination in one place.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 999, background: 'var(--surface-muted)', color: 'var(--text-secondary)', fontSize: 12 }}>
          <MessageCircle size={15} /> {loading ? 'Loading workspace…' : `${participants.length} participants in your workspace`}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 24 }}>
        <ActionCard icon={ClipboardCheck} title="Surveys" description="Collect structured feedback after an activity and review ratings, distributions, and comments." count={`${surveys.length} survey${surveys.length === 1 ? '' : 's'} available`} to="/app/surveys" />
        <ActionCard icon={GraduationCap} title="Assessments" description="Share knowledge checks and compare participant learning before and after a programme." count={`${assessments.length} assessment${assessments.length === 1 ? '' : 's'} available`} to="/app/assessments" />
        <ActionCard icon={UsersRound} title="Team" description="Coordinate workspace members, invitations, and pending approval requests." count="Manage team coordination" to="/app/team" />
      </div>

      <section style={{ ...card, marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Programme touchpoints</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 5 }}>See which feedback and learning tools are attached to each activity.</p>
          </div>
          <Link to="/app/activities" style={actionLink}>View activities <ArrowRight size={15} /></Link>
        </div>

        {touchpoints.length ? (
          <div style={{ marginTop: 16 }}>
            {touchpoints.map(activity => (
              <div key={activity.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderTop: '1px solid var(--border-default)', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 220, flex: 1 }}>
                  <Link to={`/app/activities/${activity.id}`} style={{ color: 'var(--color-navy-900)', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>{activity.title}</Link>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 4 }}>{fmtRange({ start: activity.start_date, end: activity.end_date })}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={tag}>{activity.surveyCount} survey{activity.surveyCount === 1 ? '' : 's'}</span>
                  <span style={tag}>{activity.assessmentCount} assessment{activity.assessmentCount === 1 ? '' : 's'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 16, padding: 18, borderRadius: 'var(--radius-md)', background: 'var(--surface-muted)', color: 'var(--text-secondary)', fontSize: 13 }}>Create an activity to start organising communication touchpoints.</div>
        )}
      </section>

      <section style={{ ...card, marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Mail size={18} color="var(--color-navy-800)" />
          <div style={{ fontSize: 16, fontWeight: 700 }}>Participants to reach</div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 5 }}>Open a participant email address from here, or use Surveys and Assessments to send structured forms.</p>
        {participants.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 16 }}>
            {participants.slice(0, 6).map(participant => (
              <div key={participant.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '11px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', minWidth: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{participant.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>{participant.email || 'No email recorded'}</div>
                </div>
                {participant.email && <a href={`mailto:${participant.email}`} aria-label={`Email ${participant.name}`} style={{ ...actionLink, flexShrink: 0 }}><Mail size={15} /></a>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 16, padding: 18, borderRadius: 'var(--radius-md)', background: 'var(--surface-muted)', color: 'var(--text-secondary)', fontSize: 13 }}>No participant contacts have been added yet.</div>
        )}
        {participants.length > 6 && <Link to="/app/participants" style={{ ...actionLink, marginTop: 16 }}>View all participants <ArrowRight size={15} /></Link>}
      </section>
    </div>
  );
}

const tag = { padding: '6px 9px', borderRadius: 999, background: 'var(--surface-muted)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 };
