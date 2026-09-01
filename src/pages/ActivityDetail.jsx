import { lazy, Suspense, useState } from 'react';
import useDocumentTitle from '../lib/useDocumentTitle';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { fmtRange, fmtDate, statusChip } from '../lib/format';
import { Copy, Pencil, Trash2, ExternalLink, Eye, Award } from 'lucide-react';
import CertificatePreview from '../components/CertificatePreview';
import { useAuth } from '../contexts/AuthContext';
import ActivityPlanningWorkspace from '../components/planning/ActivityPlanningWorkspace';
import ActivityOperationalPulse from '../components/planning/ActivityOperationalPulse';
import ActivityReportPulse from '../components/reporting/ActivityReportPulse';
import ActivityOperationsPanel from '../components/ActivityOperationsPanel';
import ActivityWideCheckinPanel from '../components/ActivityWideCheckinPanel';
import SkeletonScreen from '../components/Skeleton';

const ActivityReportWorkspace = lazy(() => import('../components/reporting/ActivityReportWorkspace'));

const TABS = ['Overview', 'Planning', 'Participants', 'Attendance', 'Surveys', 'Assessments', 'Certificates', 'Report'];

function initialActivityTab() {
  const requested = new URLSearchParams(window.location.search).get('view');
  if (!requested) return 'Overview';
  return TABS.find(tab => tab.toLowerCase() === requested.toLowerCase()) || 'Overview';
}

function ActivityTable({ headers, children }) {
  return (
    <div className="lx-activity-table-wrap">
      <table className="lx-table">
        <thead><tr>{headers.map(header => <th key={header}><span>{header}</span></th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function ActivityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    certificates, surveys, assessments, loading,
    getActivity, getParticipant, getRegsForActivity,
    getAttForActivity, getDoneSessions, getAttendancePct,
    upsertAttendance, issueCertificate, updateActivity, deleteActivity,
  } = useData();
  const [tab, setTab] = useState(initialActivityTab);
  const [session, setSession] = useState('Day 1');
  const [certType, setCertType] = useState('completion');
  const { profile, isDemo } = useAuth();
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

  const activity = loading ? null : getActivity(id);
  useDocumentTitle(activity?.title || 'Activity');

  if (loading) return <SkeletonScreen cards={3} label="Loading this activity" />;

  if (!activity) {
    return (
      <div className="lx-message-inline">
        <section className="lx-message-card">
          <p className="lx-message-code">Not found</p>
          <h1>This activity is no longer available</h1>
          <p>It may have been deleted, or it may belong to a different workspace.</p>
          <div className="lx-message-actions">
            <button type="button" className="lx-btn lx-btn-primary" onClick={() => navigate('/app/activities')}>Back to activities</button>
          </div>
        </section>
      </div>
    );
  }

  const pids = getRegsForActivity(activity.id);
  const att = getAttForActivity(activity.id);
  const doneSess = getDoneSessions(activity.id);
  const allSessions = Array.from({ length: Number(activity.sessions || 0) }, (_, i) => 'Day ' + (i + 1));
  const threshold = 75;

  const sessionAtt = att.filter(a => a.session_label === session);
  const presentCount = sessionAtt.filter(a => a.status === 'present').length;
  const lateCount = sessionAtt.filter(a => a.status === 'late').length;
  const absentCount = sessionAtt.filter(a => a.status === 'absent').length;
  const activityCerts = certificates.filter(c => c.activity_id === activity.id);
  const activitySurveys = surveys.filter(s => s.activity_id === activity.id);
  const activityAssessments = assessments.filter(a => a.activity_id === activity.id);

  const averageAttendance = doneSess.length ? (() => {
    const pcts = pids.map(pid => getAttendancePct(activity.id, pid)).filter(value => value !== null);
    return pcts.length ? `${Math.round(pcts.reduce((sum, value) => sum + value, 0) / pcts.length)}%` : '—';
  })() : '—';

  async function cycleAttendance(pid) {
    const rec = sessionAtt.find(a => a.participant_id === pid);
    const nextStatus = !rec ? 'present' : rec.status === 'present' ? 'late' : rec.status === 'late' ? 'absent' : 'present';
    await upsertAttendance(activity.id, pid, session, nextStatus);
  }

  async function issueCert(pid) {
    const result = await issueCertificate(activity.id, pid, certType);
    showToastMsg(result?.pending ? 'Certificate request submitted for admin approval' : 'Certificate issued');
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
    } finally {
      setSaving(false);
    }
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

  return (
    <div>
      <button type="button" className="lx-back-link" onClick={() => navigate('/app/activities')}>&larr; All activities</button>

      <header className="lx-activity-head">
        <div className="lx-activity-head-top">
          <div>
            <div className="lx-activity-title">
              <h1>{activity.title}</h1>
              <span style={statusChip(activity.status)}>{activity.status}</span>
            </div>
            <p className="lx-activity-meta">
              {activity.type} &middot; {fmtRange({ start: activity.start_date, end: activity.end_date })} &middot; {activity.venue} &middot; Organized by {activity.organizer} &middot; Facilitator: {activity.facilitator}
            </p>
          </div>
          <div className="lx-activity-actions">
            <Link className="lx-btn lx-btn-secondary" to={`/app/certificates?awardActivity=${encodeURIComponent(activity.id)}#awards-recognition`}><Award size={15} aria-hidden="true" /> Give award</Link>
            {!isDemo && <>
              <button type="button" className="lx-btn lx-btn-secondary" onClick={openEdit}><Pencil size={14} aria-hidden="true" /> Edit</button>
              <button type="button" className="lx-btn lx-btn-danger" onClick={() => setShowDelete(true)}><Trash2 size={14} aria-hidden="true" /> Delete</button>
            </>}
          </div>
        </div>
      </header>

      <nav className="lx-activity-tabs" aria-label="Activity workspace">
        {TABS.map(item => (
          <button
            key={item}
            type="button"
            className="lx-activity-tab"
            aria-selected={item === tab}
            onClick={() => setTab(item)}
          >{item}</button>
        ))}
      </nav>

      {tab === 'Overview' && (
        <div className="lx-activity-overview-layout">
          <div className="lx-activity-overview-main">
            <section className="lx-activity-card lx-activity-card-pad">
              <h2 className="lx-activity-section-title">About this activity</h2>
              <p className="lx-activity-section-copy">{activity.description || 'No description has been added yet.'}</p>
            </section>
            <div className="lx-activity-overview-stats">
              {[
                ['Sessions', activity.sessions],
                ['Registered', pids.length],
                ['Attendance', averageAttendance],
                ['Certificates', activityCerts.length],
              ].map(([label, value]) => <div className="lx-activity-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}
            </div>
            <ActivityOperationalPulse activity={activity} onOpenPlanning={() => setTab('Planning')} />
            <ActivityReportPulse activity={activity} onOpenReport={() => setTab('Report')} />
          </div>
          <aside className="lx-activity-overview-side">
            <section className="lx-activity-card lx-activity-card-pad">
              <h2 className="lx-activity-section-title">Share links</h2>
              <div className="lx-activity-share-list">
                <div className="lx-activity-share-item">
                  <span>Registration link</span>
                  <div className="lx-activity-linkbox"><code>{regLink}</code><button className="lx-activity-icon-btn" onClick={() => copyToClipboard(regLink, 'Registration')} aria-label="Copy the registration link"><Copy size={14} /></button><a className="lx-activity-icon-btn" href={regLink} target="_blank" rel="noopener noreferrer" aria-label="Open the registration page in a new tab"><ExternalLink size={14} /></a></div>
                </div>
                <div className="lx-activity-share-item">
                  <span>Attendance check-in link</span>
                  <div className="lx-activity-linkbox"><code>{attLink}</code><button className="lx-activity-icon-btn" onClick={() => copyToClipboard(attLink, 'Attendance')} aria-label="Copy the attendance check-in link"><Copy size={14} /></button><a className="lx-activity-icon-btn" href={attLink} target="_blank" rel="noopener noreferrer" aria-label="Open the attendance check-in page in a new tab"><ExternalLink size={14} /></a></div>
                </div>
              </div>
            </section>
            <section className="lx-activity-card lx-activity-card-pad">
              <h2 className="lx-activity-section-title">Activity settings</h2>
              <div className="lx-activity-settings-list">
                <div className="lx-activity-setting"><span>Registration</span><strong>{activity.reg_open ? 'Open' : 'Closed'}</strong></div>
                <div className="lx-activity-setting"><span>Attendance mode</span><strong>Link check-in</strong></div>
                <div className="lx-activity-setting"><span>Certificate threshold</span><strong>{threshold}% attendance</strong></div>
              </div>
            </section>
          </aside>
        </div>
      )}

      {tab === 'Planning' && <div className="lx-activity-tab-panel"><ActivityPlanningWorkspace activity={activity} /></div>}

      {tab === 'Participants' && (
        <div className="lx-activity-tab-panel">
          {!isDemo && <ActivityOperationsPanel mode="registration" />}
          <details className="lx-activity-disclosure" open={isDemo}>
            <summary>Participant outcomes · attendance and certificate status</summary>
            <div className="lx-activity-disclosure-body">
              <ActivityTable headers={['Name', 'Email', 'Category', 'Attendance', 'Certificate']}>
                {pids.map(pid => {
                  const participant = getParticipant(pid);
                  if (!participant) return null;
                  const pct = getAttendancePct(activity.id, pid);
                  const cert = activityCerts.find(item => item.participant_id === pid);
                  return <tr key={pid}><td><strong>{participant.name}</strong></td><td>{participant.email}</td><td>{participant.category || '—'}</td><td className="lx-num">{pct !== null ? `${pct}%` : '—'}</td><td>{cert?.cert_no || '—'}</td></tr>;
                })}
              </ActivityTable>
              {!pids.length && <div className="lx-activity-empty">No registered participants yet.</div>}
            </div>
          </details>
        </div>
      )}

      {tab === 'Attendance' && (
        <div className="lx-activity-tab-panel">
          {!isDemo && <>
            <ActivityWideCheckinPanel />
            <ActivityOperationsPanel mode="attendance" />
          </>}
          <details className="lx-activity-disclosure" open={isDemo}>
            <summary>Attendance ledger · manual session view</summary>
            <div className="lx-activity-disclosure-body">
              <div className="lx-activity-attendance-toolbar">
                <select className="lx-field" value={session} onChange={e => setSession(e.target.value)}>
                  {allSessions.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
                <span style={statusChip('present')}>Present {presentCount}</span>
                <span style={statusChip('late')}>Late {lateCount}</span>
                <span style={statusChip('absent')}>Absent {absentCount}</span>
              </div>
              <ActivityTable headers={['Name', 'Email', 'Status']}>
                {pids.map(pid => {
                  const participant = getParticipant(pid);
                  if (!participant) return null;
                  const rec = sessionAtt.find(item => item.participant_id === pid);
                  const state = rec ? rec.status : 'unmarked';
                  return <tr key={pid}><td><strong>{participant.name}</strong></td><td>{participant.email}</td><td><button type="button" onClick={() => cycleAttendance(pid)} title="Click to change status" className="lx-activity-pill">{state === 'unmarked' ? 'Unmarked' : state}</button></td></tr>;
                })}
              </ActivityTable>
              <p className="lx-activity-legacy-note">Click a status to cycle Present → Late → Absent. The V2 check-in workspace above remains the primary operational attendance tool.</p>
            </div>
          </details>
        </div>
      )}

      {tab === 'Surveys' && (
        <div className="lx-activity-tab-panel lx-activity-card">
          <div className="lx-activity-list-head"><strong>{activitySurveys.length} survey{activitySurveys.length === 1 ? '' : 's'}</strong><span>Surveys linked to this activity.</span></div>
          {activitySurveys.length ? <ActivityTable headers={['Title', 'Status', 'Share token']}>
            {activitySurveys.map(item => <tr key={item.id}><td><strong>{item.title}</strong></td><td><span style={statusChip(item.status)}>{item.status}</span></td><td>{item.share_token || '—'}</td></tr>)}
          </ActivityTable> : <div className="lx-activity-empty">No surveys yet.</div>}
        </div>
      )}

      {tab === 'Assessments' && (
        <div className="lx-activity-tab-panel lx-activity-card">
          <div className="lx-activity-list-head"><strong>{activityAssessments.length} assessment{activityAssessments.length === 1 ? '' : 's'}</strong><span>Knowledge checks and assessments linked to this activity.</span></div>
          {activityAssessments.length ? <ActivityTable headers={['Title', 'Type', 'Passing score', 'Status']}>
            {activityAssessments.map(item => <tr key={item.id}><td><strong>{item.title}</strong></td><td>{item.assessment_type || '—'}</td><td>{item.passing_score != null ? `${item.passing_score}%` : '—'}</td><td><span style={statusChip(item.status)}>{item.status}</span></td></tr>)}
          </ActivityTable> : <div className="lx-activity-empty">No assessments yet.</div>}
        </div>
      )}

      {tab === 'Certificates' && (
        <div className="lx-activity-tab-panel">
          <div className="lx-activity-toolbar">
            <span className="lx-activity-toolbar-label">Certificate type</span>
            {['completion', 'attendance', 'appreciation'].map(type => <button key={type} type="button" className={`lx-activity-pill ${certType === type ? 'active' : ''}`} onClick={() => setCertType(type)}>{type}</button>)}
          </div>
          <div className="lx-activity-cert-grid">
            <section className="lx-activity-card">
              <div className="lx-activity-list-head"><strong>Eligible for certificate</strong><span>Requires {threshold}% attendance.</span></div>
              {(() => {
                const eligible = pids.filter(pid => {
                  const pct = getAttendancePct(activity.id, pid);
                  const hasCert = activityCerts.some(cert => cert.participant_id === pid);
                  return pct !== null && pct >= threshold && !hasCert;
                });
                return eligible.length ? eligible.map(pid => {
                  const participant = getParticipant(pid);
                  const pct = getAttendancePct(activity.id, pid);
                  return <div className="lx-activity-cert-row" key={pid}><div><div className="lx-activity-cert-name">{participant?.name}</div><div className="lx-activity-cert-meta">{pct}% attendance</div></div><button className="lx-btn lx-btn-secondary lx-btn-small" onClick={() => issueCert(pid)}>Issue</button></div>;
                }) : <div className="lx-activity-empty">No participants currently meet the requirement.</div>;
              })()}
            </section>
            <section className="lx-activity-card">
              <div className="lx-activity-list-head"><strong>Issued</strong><span>{activityCerts.length} certificate{activityCerts.length === 1 ? '' : 's'} issued for this activity.</span></div>
              {activityCerts.length ? activityCerts.map(cert => {
                const participant = getParticipant(cert.participant_id);
                return <div className="lx-activity-cert-row" key={cert.cert_no}><div><div className="lx-activity-cert-name">{participant?.name}</div><div className="lx-activity-cert-meta">{cert.cert_no} · {fmtDate(cert.issued_date)}<span className="lx-activity-cert-tag">{cert.certificate_type || 'completion'}</span></div></div><button className="lx-activity-icon-btn" onClick={() => setPreviewCert(cert)} title="View & download" aria-label={`View certificate for ${participant?.name || 'participant'}`}><Eye size={16} /></button></div>;
              }) : <div className="lx-activity-empty">No certificates issued yet.</div>}
            </section>
          </div>
        </div>
      )}

      {tab === 'Report' && (
        <div className="lx-activity-tab-panel">
          <Suspense fallback={<div className="lx-activity-empty">Opening living report…</div>}><ActivityReportWorkspace activity={activity} /></Suspense>
        </div>
      )}

      {showEdit && editForm && (
        <div className="lx-activity-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowEdit(false)}>
          <div className="lx-dialog lx-activity-edit-dialog">
            <h2>Edit activity</h2>
            <form className="lx-form" onSubmit={saveEdit}>
              <input className="lx-field" value={editForm.title} onChange={e => setEditForm(form => ({ ...form, title: e.target.value }))} placeholder="Title" required />
              <div className="lx-activity-form-grid">
                <select className="lx-field" value={editForm.type} onChange={e => setEditForm(form => ({ ...form, type: e.target.value }))}>{['Training', 'Workshop', 'Meeting', 'Seminar', 'Conference', 'Community engagement'].map(type => <option key={type} value={type}>{type}</option>)}</select>
                <select className="lx-field" value={editForm.status} onChange={e => setEditForm(form => ({ ...form, status: e.target.value }))}>{['Upcoming', 'Ongoing', 'Completed'].map(state => <option key={state} value={state}>{state}</option>)}</select>
              </div>
              <input className="lx-field" value={editForm.venue} onChange={e => setEditForm(form => ({ ...form, venue: e.target.value }))} placeholder="Venue" />
              <div className="lx-activity-form-grid">
                <input className="lx-field" type="date" value={editForm.start_date} onChange={e => setEditForm(form => ({ ...form, start_date: e.target.value }))} />
                <input className="lx-field" type="date" value={editForm.end_date} onChange={e => setEditForm(form => ({ ...form, end_date: e.target.value }))} />
              </div>
              <div className="lx-activity-form-grid">
                <input className="lx-field" value={editForm.facilitator} onChange={e => setEditForm(form => ({ ...form, facilitator: e.target.value }))} placeholder="Facilitator" />
                <input className="lx-field" type="number" min={1} value={editForm.sessions} onChange={e => setEditForm(form => ({ ...form, sessions: +e.target.value }))} placeholder="Sessions" />
              </div>
              <textarea className="lx-field" value={editForm.description} onChange={e => setEditForm(form => ({ ...form, description: e.target.value }))} placeholder="Description" rows={3} />
              <label className="lx-activity-form-check"><input type="checkbox" checked={editForm.reg_open} onChange={e => setEditForm(form => ({ ...form, reg_open: e.target.checked }))} /> Registration open</label>
              <div className="lx-activity-dialog-actions"><button type="button" className="lx-btn lx-btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button><button type="submit" className="lx-btn lx-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="lx-activity-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowDelete(false)}>
          <div className="lx-dialog lx-activity-delete-dialog">
            <h2 className="lx-activity-danger-title">Delete activity</h2>
            <p className="lx-activity-section-copy">This will permanently delete <strong>{activity.title}</strong> and all associated registrations, attendance records, and certificates. This action cannot be undone.</p>
            <div className="lx-activity-dialog-actions"><button className="lx-btn lx-btn-secondary" onClick={() => setShowDelete(false)}>Cancel</button><button className="lx-btn lx-btn-danger" onClick={confirmDelete}>Delete</button></div>
          </div>
        </div>
      )}

      {previewCert && <CertificatePreview cert={previewCert} participant={getParticipant(previewCert.participant_id)} activity={activity} orgName={profile?.org_name || 'Organization'} logoUrl={profile?.logo_url} onClose={() => setPreviewCert(null)} />}
      {toast && <div className="lx-toast">{toast}</div>}
    </div>
  );
}
