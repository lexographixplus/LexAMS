import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { fmtRange, fmtDate, statusChip } from '../lib/format';
import { Copy, Pencil, Trash2, ExternalLink, Eye } from 'lucide-react';
import CertificatePreview from '../components/CertificatePreview';
import { useAuth } from '../contexts/AuthContext';
import ActivityPlanningWorkspace from '../components/planning/ActivityPlanningWorkspace';

const TABS = ['Overview', 'Planning', 'Participants', 'Attendance', 'Surveys', 'Assessments', 'Certificates'];

export default function ActivityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    certificates, surveys, assessments, loading,
    getActivity, getParticipant, getRegsForActivity,
    getAttForActivity, getDoneSessions, getAttendancePct,
    upsertAttendance, issueCertificate, updateActivity, deleteActivity,
  } = useData();
  const [tab, setTab] = useState('Overview');
  const [session, setSession] = useState('Day 1');
  const [certType, setCertType] = useState('completion');
  const { profile } = useAuth();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [previewCert, setPreviewCert] = useState(null);

  function showToastMsg(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text);
    showToastMsg(`${label} link copied`);
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', fontSize: 14, color: 'var(--text-tertiary)' }}>
      Loading...
    </div>
  );

  const activity = getActivity(id);
  if (!activity) return <div>Activity not found.</div>;

  const pids = getRegsForActivity(activity.id);
  const att = getAttForActivity(activity.id);
  const doneSess = getDoneSessions(activity.id);
  const allSessions = Array.from({ length: activity.sessions }, (_, i) => 'Day ' + (i + 1));
  const threshold = 75;

  // Attendance for selected session
  const sessionAtt = att.filter(a => a.session_label === session);
  const presentCount = sessionAtt.filter(a => a.status === 'present').length;
  const lateCount = sessionAtt.filter(a => a.status === 'late').length;
  const absentCount = sessionAtt.filter(a => a.status === 'absent').length;

  // Certificates for this activity
  const activityCerts = certificates.filter(c => c.activity_id === activity.id);

  // Surveys for this activity
  const activitySurveys = surveys.filter(s => s.activity_id === activity.id);

  // Assessments for this activity
  const activityAssessments = assessments.filter(a => a.activity_id === activity.id);

  async function cycleAttendance(pid) {
    const rec = sessionAtt.find(a => a.participant_id === pid);
    let nextStatus;
    if (!rec) {
      nextStatus = 'present';
    } else {
      nextStatus = rec.status === 'present' ? 'late' : rec.status === 'late' ? 'absent' : 'present';
    }
    await upsertAttendance(activity.id, pid, session, nextStatus);
  }

  async function issueCert(pid) {
    const result = await issueCertificate(activity.id, pid, certType);
    if (result?.pending) {
      showToastMsg('Certificate request submitted for admin approval');
    } else {
      showToastMsg('Certificate issued');
    }
  }

  function openEdit() {
    setEditForm({
      title: activity.title, type: activity.type, status: activity.status,
      venue: activity.venue, organizer: activity.organizer, facilitator: activity.facilitator,
      start_date: activity.start_date, end_date: activity.end_date,
      sessions: activity.sessions, reg_open: activity.reg_open,
      description: activity.description,
    });
    setShowEdit(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateActivity(activity.id, editForm);
      setShowEdit(false);
      showToastMsg('Activity updated');
    } catch (err) {
      showToastMsg('Error: ' + err.message);
    }
    setSaving(false);
  }

  async function confirmDelete() {
    try {
      await deleteActivity(activity.id);
      navigate('/app/activities');
    } catch (err) {
      showToastMsg('Error: ' + err.message);
      setShowDelete(false);
    }
  }

  const regLink = `${window.location.origin}/register/${activity.reg_token}`;
  const attLink = `${window.location.origin}/checkin/${activity.att_token}`;

  const tabStyle = (t) => ({
    padding: '8px 16px', fontSize: 14, fontWeight: 600,
    background: 'none', border: 'none',
    color: t === tab ? 'var(--color-navy-900)' : 'var(--text-tertiary)',
    borderBottom: t === tab ? '2px solid var(--color-navy-900)' : '2px solid transparent',
    cursor: 'pointer', transition: 'color 120ms',
  });

  return (
    <div>
      <button onClick={() => navigate('/app/activities')} style={{
        background: 'none', border: 'none', fontSize: 13, fontWeight: 600,
        color: 'var(--color-navy-700)', padding: 0, cursor: 'pointer',
      }}>&larr; All activities</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 25, fontWeight: 700, margin: 0 }}>
              {activity.title}
            </h2>
            <span style={statusChip(activity.status)}>{activity.status}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
            {activity.type} &middot; {fmtRange({ start: activity.start_date, end: activity.end_date })} &middot; {activity.venue} &middot;
            Organized by {activity.organizer} &middot; Facilitator: {activity.facilitator}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={openEdit} title="Edit activity" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', fontSize: 13, fontWeight: 600,
            background: 'transparent', border: '1.5px solid var(--border-default)',
            borderRadius: 'var(--radius-md)', color: 'var(--color-navy-700)', cursor: 'pointer',
          }}><Pencil size={14} /> Edit</button>
          <button onClick={() => setShowDelete(true)} title="Delete activity" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', fontSize: 13, fontWeight: 600,
            background: 'transparent', border: '1.5px solid var(--color-danger)',
            borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', cursor: 'pointer',
          }}><Trash2 size={14} /> Delete</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginTop: 22, borderBottom: '1px solid var(--border-default)', display: 'flex', gap: 4, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>{t}</button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'Overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginTop: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{
              background: 'var(--surface-card)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '22px 24px',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>About this activity</div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 10 }}>
                {activity.description}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {[
                { label: 'Sessions', value: activity.sessions },
                { label: 'Registered', value: pids.length },
                { label: 'Attendance', value: doneSess.length ? (() => {
                  const pcts = pids.map(p => getAttendancePct(activity.id, p)).filter(v => v !== null);
                  return pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) + '%' : '\u2014';
                })() : '\u2014' },
                { label: 'Certificates', value: activityCerts.length },
              ].map(st => (
                <div key={st.label} style={{
                  background: 'var(--surface-card)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '16px 18px',
                }}>
                  <div style={{
                    fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase',
                    color: 'var(--text-tertiary)', fontWeight: 600,
                  }}>{st.label}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginTop: 6 }}>
                    {st.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Share links */}
            <div style={{
              background: 'var(--surface-card)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '22px 24px',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Share links</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Registration link</div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)', padding: '8px 12px',
                  }}>
                    <div style={{
                      flex: 1, fontSize: 12, color: 'var(--text-secondary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{regLink}</div>
                    <button onClick={() => copyToClipboard(regLink, 'Registration')} title="Copy" style={{
                      background: 'none', border: 'none', color: 'var(--color-navy-700)', cursor: 'pointer', padding: 2, flexShrink: 0,
                    }}><Copy size={14} /></button>
                    <a href={regLink} target="_blank" rel="noopener" style={{ color: 'var(--color-navy-700)', flexShrink: 0 }}>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Attendance check-in link</div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)', padding: '8px 12px',
                  }}>
                    <div style={{
                      flex: 1, fontSize: 12, color: 'var(--text-secondary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{attLink}</div>
                    <button onClick={() => copyToClipboard(attLink, 'Attendance')} title="Copy" style={{
                      background: 'none', border: 'none', color: 'var(--color-navy-700)', cursor: 'pointer', padding: 2, flexShrink: 0,
                    }}><Copy size={14} /></button>
                    <a href={attLink} target="_blank" rel="noopener" style={{ color: 'var(--color-navy-700)', flexShrink: 0 }}>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div style={{
              background: 'var(--surface-card)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '22px 24px',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Settings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Registration</span>
                  <span style={{ fontWeight: 600, color: activity.reg_open ? 'var(--color-success)' : 'var(--text-tertiary)' }}>
                    {activity.reg_open ? 'Open' : 'Closed'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Attendance mode</span>
                  <span style={{ fontWeight: 600 }}>Link check-in</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Certificate threshold</span>
                  <span style={{ fontWeight: 600 }}>{threshold}% attendance</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Planning Tab */}
      {tab === 'Planning' && (
        <div style={{ marginTop: 22 }}>
          <ActivityPlanningWorkspace activity={activity} />
        </div>
      )}

      {/* Participants Tab */}
      {tab === 'Participants' && (
        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
          overflow: 'hidden', marginTop: 22,
        }}>
          <div style={{ padding: '16px 22px', fontSize: 14, fontWeight: 600 }}>
            {pids.length} registered participants
          </div>
          <div className="table-scroll"><div style={{minWidth: 700}}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1.6fr 1.8fr 1fr 1fr 1fr',
            gap: 14, padding: '12px 22px', fontSize: 11, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600,
            background: 'var(--surface-muted)',
          }}>
            <div>Name</div><div>Email</div><div>Category</div><div>Attendance</div><div>Certificate</div>
          </div>
          {pids.map(pid => {
            const p = getParticipant(pid);
            if (!p) return null;
            const pct = getAttendancePct(activity.id, pid);
            const cert = activityCerts.find(c => c.participant_id === pid);
            return (
              <div key={pid} style={{
                display: 'grid', gridTemplateColumns: '1.6fr 1.8fr 1fr 1fr 1fr',
                gap: 14, alignItems: 'center', padding: '13px 22px',
                borderTop: '1px solid var(--border-default)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.email}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.category}</div>
                <div style={{ fontSize: 13 }}>{pct !== null ? pct + '%' : '\u2014'}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {cert ? cert.cert_no : '\u2014'}
                </div>
              </div>
            );
          })}
          </div></div>
        </div>
      )}

      {/* Attendance Tab */}
      {tab === 'Attendance' && (
        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <select value={session} onChange={e => setSession(e.target.value)} style={{
              padding: '8px 14px', fontSize: 14, border: '1.5px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)', outline: 'none',
            }}>
              {allSessions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={statusChip('present')}>Present {presentCount}</span>
            <span style={statusChip('late')}>Late {lateCount}</span>
            <span style={statusChip('absent')}>Absent {absentCount}</span>
          </div>
          <div style={{
            background: 'var(--surface-card)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
            overflow: 'hidden', marginTop: 16,
          }}>
            <div className="table-scroll"><div style={{minWidth: 700}}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1.6fr 2fr 1fr',
              gap: 14, padding: '12px 22px', fontSize: 11, letterSpacing: '0.07em',
              textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600,
              background: 'var(--surface-muted)',
            }}>
              <div>Name</div><div>Email</div><div>Status</div>
            </div>
            {pids.map(pid => {
              const p = getParticipant(pid);
              if (!p) return null;
              const rec = sessionAtt.find(a => a.participant_id === pid);
              const status = rec ? rec.status : 'unmarked';
              return (
                <div key={pid} style={{
                  display: 'grid', gridTemplateColumns: '1.6fr 2fr 1fr',
                  gap: 14, alignItems: 'center', padding: '11px 22px',
                  borderTop: '1px solid var(--border-default)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.email}</div>
                  <div>
                    <button
                      onClick={() => cycleAttendance(pid)}
                      title="Click to change status"
                      style={{
                        ...statusChip(status === 'unmarked' ? 'Upcoming' : status),
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      {status === 'unmarked' ? 'Unmarked' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  </div>
                </div>
              );
            })}
            </div></div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10 }}>
            Click a status to cycle Present &rarr; Late &rarr; Absent.
          </div>
        </div>
      )}

      {/* Surveys Tab */}
      {tab === 'Surveys' && (
        <div style={{ marginTop: 22 }}>
          {activitySurveys.length > 0 ? (
            <div style={{
              background: 'var(--surface-card)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 22px', fontSize: 14, fontWeight: 600 }}>
                {activitySurveys.length} survey{activitySurveys.length !== 1 ? 's' : ''}
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr',
                gap: 14, padding: '12px 22px', fontSize: 11, letterSpacing: '0.07em',
                textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600,
                background: 'var(--surface-muted)',
              }}>
                <div>Title</div><div>Status</div><div>Share token</div>
              </div>
              {activitySurveys.map(s => (
                <div key={s.id} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr',
                  gap: 14, alignItems: 'center', padding: '13px 22px',
                  borderTop: '1px solid var(--border-default)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.title}</div>
                  <div><span style={statusChip(s.status)}>{s.status}</span></div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {s.share_token || '\u2014'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              background: 'var(--surface-card)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)', padding: 40, textAlign: 'center',
              fontSize: 13, color: 'var(--text-tertiary)',
            }}>No surveys yet.</div>
          )}
        </div>
      )}

      {/* Assessments Tab */}
      {tab === 'Assessments' && (
        <div style={{ marginTop: 22 }}>
          {activityAssessments.length > 0 ? (
            <div style={{
              background: 'var(--surface-card)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 22px', fontSize: 14, fontWeight: 600 }}>
                {activityAssessments.length} assessment{activityAssessments.length !== 1 ? 's' : ''}
              </div>
              <div className="table-scroll"><div style={{minWidth: 700}}>
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                gap: 14, padding: '12px 22px', fontSize: 11, letterSpacing: '0.07em',
                textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600,
                background: 'var(--surface-muted)',
              }}>
                <div>Title</div><div>Type</div><div>Passing score</div><div>Status</div>
              </div>
              {activityAssessments.map(a => (
                <div key={a.id} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  gap: 14, alignItems: 'center', padding: '13px 22px',
                  borderTop: '1px solid var(--border-default)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.assessment_type || '\u2014'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {a.passing_score != null ? a.passing_score + '%' : '\u2014'}
                  </div>
                  <div><span style={statusChip(a.status)}>{a.status}</span></div>
                </div>
              ))}
              </div></div>
            </div>
          ) : (
            <div style={{
              background: 'var(--surface-card)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)', padding: 40, textAlign: 'center',
              fontSize: 13, color: 'var(--text-tertiary)',
            }}>No assessments yet.</div>
          )}
        </div>
      )}

      {/* Certificates Tab */}
      {tab === 'Certificates' && (
        <div style={{ marginTop: 22 }}>
          {/* Certificate type selector */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Certificate type:</span>
            {['completion', 'attendance', 'appreciation'].map(t => (
              <button key={t} onClick={() => setCertType(t)} style={{
                padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                border: certType === t ? '1.5px solid var(--color-navy-900)' : '1.5px solid var(--border-default)',
                background: certType === t ? 'var(--color-navy-900)' : 'var(--surface-card)',
                color: certType === t ? '#FFFFFF' : 'var(--text-secondary)',
                cursor: 'pointer', textTransform: 'capitalize',
              }}>{t}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Eligible */}
          <div style={{
            background: 'var(--surface-card)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 22px' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Eligible for certificate</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                Requires {threshold}% attendance
              </div>
            </div>
            {(() => {
              const eligible = pids.filter(pid => {
                const pct = getAttendancePct(activity.id, pid);
                const hasCert = activityCerts.some(c => c.participant_id === pid);
                return pct !== null && pct >= threshold && !hasCert;
              });
              return eligible.length > 0 ? eligible.map(pid => {
                const p = getParticipant(pid);
                const pct = getAttendancePct(activity.id, pid);
                return (
                  <div key={pid} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: 14, padding: '11px 22px', borderTop: '1px solid var(--border-default)',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p?.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{pct}% attendance</div>
                    </div>
                    <button onClick={() => issueCert(pid)} style={{
                      padding: '6px 14px', fontSize: 13, fontWeight: 600,
                      background: 'transparent', border: '1.5px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)', color: 'var(--color-navy-700)', cursor: 'pointer',
                    }}>Issue</button>
                  </div>
                );
              }) : (
                <div style={{
                  padding: '26px 22px', textAlign: 'center', fontSize: 13,
                  color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-default)',
                }}>No participants currently meet the requirement.</div>
              );
            })()}
          </div>

          {/* Issued */}
          <div style={{
            background: 'var(--surface-card)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 22px', fontSize: 14, fontWeight: 600 }}>Issued</div>
            {(() => {
              return activityCerts.length > 0 ? activityCerts.map(c => {
                const p = getParticipant(c.participant_id);
                return (
                  <div key={c.cert_no} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: 14, padding: '11px 22px', borderTop: '1px solid var(--border-default)',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p?.name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {c.cert_no} &middot; {fmtDate(c.issued_date)}
                        <span style={{
                          marginLeft: 8, padding: '1px 6px', borderRadius: 4,
                          fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-body)',
                          background: 'var(--surface-muted)', color: 'var(--text-secondary)',
                          textTransform: 'capitalize',
                        }}>{c.certificate_type || 'completion'}</span>
                      </div>
                    </div>
                    <button onClick={() => setPreviewCert(c)} title="View & download" style={{
                      background: 'none', border: 'none', color: 'var(--color-navy-700)',
                      cursor: 'pointer', padding: 4,
                    }}><Eye size={16} /></button>
                  </div>
                );
              }) : (
                <div style={{
                  padding: '26px 22px', textAlign: 'center', fontSize: 13,
                  color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-default)',
                }}>No certificates issued yet.</div>
              );
            })()}
          </div>
          </div>
        </div>
      )}
      {/* Edit dialog */}
      {showEdit && editForm && (
        <div onClick={() => setShowEdit(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,43,84,0.25)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-raised)', padding: '28px 32px',
            width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>Edit activity</h3>
            <form onSubmit={saveEdit} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Title" required style={_input} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} style={_input}>
                  {['Training', 'Workshop', 'Meeting', 'Seminar', 'Conference', 'Community engagement'].map(t =>
                    <option key={t} value={t}>{t}</option>
                  )}
                </select>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} style={_input}>
                  {['Upcoming', 'Ongoing', 'Completed'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <input value={editForm.venue} onChange={e => setEditForm(f => ({ ...f, venue: e.target.value }))}
                placeholder="Venue" style={_input} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input type="date" value={editForm.start_date} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} style={_input} />
                <input type="date" value={editForm.end_date} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} style={_input} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input value={editForm.facilitator} onChange={e => setEditForm(f => ({ ...f, facilitator: e.target.value }))}
                  placeholder="Facilitator" style={_input} />
                <input type="number" min={1} value={editForm.sessions} onChange={e => setEditForm(f => ({ ...f, sessions: +e.target.value }))}
                  placeholder="Sessions" style={_input} />
              </div>
              <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description" rows={3} style={{ ..._input, resize: 'vertical' }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={editForm.reg_open} onChange={e => setEditForm(f => ({ ...f, reg_open: e.target.checked }))} />
                Registration open
              </label>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                <button type="button" onClick={() => setShowEdit(false)} style={{
                  padding: '10px 20px', fontSize: 14, fontWeight: 600,
                  background: 'transparent', border: '1.5px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" disabled={saving} style={{
                  padding: '10px 20px', fontSize: 14, fontWeight: 600,
                  background: 'var(--color-navy-900)', color: '#FFFFFF',
                  border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}>{saving ? 'Saving...' : 'Save changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDelete && (
        <div onClick={() => setShowDelete(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,43,84,0.25)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-raised)', padding: '28px 32px', width: 420, maxWidth: '95vw',
          }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-danger)' }}>
              Delete activity
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
              This will permanently delete <strong>{activity.title}</strong> and all associated registrations,
              attendance records, and certificates. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowDelete(false)} style={{
                padding: '10px 20px', fontSize: 14, fontWeight: 600,
                background: 'transparent', border: '1.5px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={confirmDelete} style={{
                padding: '10px 20px', fontSize: 14, fontWeight: 600,
                background: 'var(--color-danger)', color: '#FFFFFF',
                border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Certificate preview */}
      {previewCert && (
        <CertificatePreview
          cert={previewCert}
          participant={getParticipant(previewCert.participant_id)}
          activity={activity}
          orgName={profile?.org_name || 'Organization'}
          logoUrl={profile?.logo_url}
          onClose={() => setPreviewCert(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-navy-900)', color: '#FFFFFF', fontSize: 13, fontWeight: 500,
          padding: '11px 20px', borderRadius: 999, boxShadow: 'var(--shadow-raised)', zIndex: 300,
        }}>{toast}</div>
      )}
    </div>
  );
}

const _input = {
  width: '100%', padding: '10px 14px', fontSize: 14,
  border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  background: 'var(--surface-card)', outline: 'none', color: 'var(--text-primary)',
  fontFamily: 'var(--font-body)',
};
