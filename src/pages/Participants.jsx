import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { initials as getInitials, fmtRange } from '../lib/format';
import CertificatePreview from '../components/CertificatePreview';
import { isReportingPreviewDemo } from '../lib/reportPreviewDemo';
import { isRecognitionCertificate } from '../../shared/recognition.js';
import SkeletonScreen from '../components/Skeleton';
import { Users, SearchX } from 'lucide-react';
import './participants.css';

const CATEGORIES = ['Volunteer', 'Staff', 'Community member', 'Partner', 'Youth', 'Teacher', 'Parent', 'External'];
const PAGE_SIZE = 25;

const COLUMNS = [
  { key: 'name', label: 'Participant', sortable: true },
  { key: 'phone', label: 'Phone', sortable: false },
  { key: 'org', label: 'Organisation', sortable: true },
  { key: 'category', label: 'Category', sortable: true },
  { key: 'activities', label: 'Activities', sortable: true, numeric: true },
  { key: 'certificates', label: 'Certificates', sortable: true, numeric: true },
];

export default function Participants() {
  const { activities, participants, registrations, certificates, loading, addParticipant, updateParticipant, deleteParticipant, addRegistration, getAttendancePct, isAdmin } = useData();
  const { profile } = useAuth();
  const previewReadOnly = isReportingPreviewDemo();
  const [q, setQ] = useState('');
  const [catF, setCatF] = useState('all');
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' });
  const [page, setPage] = useState(1);
  const [showNew, setShowNew] = useState(false);
  const [selectedPid, setSelectedPid] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', org: '', category: 'Volunteer', activityIds: [] });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState(null);
  const [previewAward, setPreviewAward] = useState(null);
  const [sharingAwardId, setSharingAwardId] = useState(null);
  const drawerCloseRef = useRef(null);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  const categories = ['all', ...new Set(participants.map(p => p.category))];

  const counts = useMemo(() => {
    const activityCount = new Map();
    const certificateCount = new Map();
    registrations.forEach(r => activityCount.set(r.participant_id, (activityCount.get(r.participant_id) || 0) + 1));
    certificates.forEach(c => certificateCount.set(c.participant_id, (certificateCount.get(c.participant_id) || 0) + 1));
    return { activityCount, certificateCount };
  }, [registrations, certificates]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = participants.filter(p => {
      if (term) {
        const haystack = `${p.name} ${p.email} ${p.org || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return catF === 'all' || p.category === catF;
    });

    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      switch (sort.key) {
        case 'activities':
          return ((counts.activityCount.get(a.id) || 0) - (counts.activityCount.get(b.id) || 0)) * direction;
        case 'certificates':
          return ((counts.certificateCount.get(a.id) || 0) - (counts.certificateCount.get(b.id) || 0)) * direction;
        case 'org':
        case 'category':
          return String(a[sort.key] || '').localeCompare(String(b[sort.key] || '')) * direction;
        default:
          return String(a.name || '').localeCompare(String(b.name || '')) * direction;
      }
    });
  }, [participants, q, catF, sort, counts]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // A filter change can leave the reader on a page that no longer exists.
  useEffect(() => { setPage(1); }, [q, catF]);

  function toggleSort(key) {
    setSort(current => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' });
  }

  function toggleActivity(actId) {
    setForm(f => ({ ...f, activityIds: f.activityIds.includes(actId) ? f.activityIds.filter(id => id !== actId) : [...f.activityIds, actId] }));
  }

  async function handleAddParticipant(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      const result = await addParticipant({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null, org: form.org.trim() || null, category: form.category }, { activityIds: form.activityIds });
      if (result?.pending) {
        setShowNew(false);
        setForm({ name: '', email: '', phone: '', org: '', category: 'Volunteer', activityIds: [] });
        showToast('Submitted for admin approval');
      } else {
        for (const actId of form.activityIds) { try { await addRegistration(actId, result.id); } catch { /* registration is retried from the activity */ } }
        setShowNew(false);
        setForm({ name: '', email: '', phone: '', org: '', category: 'Volunteer', activityIds: [] });
        if (form.activityIds.length > 0) showToast(`Participant added and registered to ${form.activityIds.length} activit${form.activityIds.length === 1 ? 'y' : 'ies'}`);
      }
    } catch (err) { showToast('Error: ' + err.message); }
    finally { setSaving(false); }
  }

  const selectedP = selectedPid ? participants.find(p => p.id === selectedPid) : null;
  const selectedActs = selectedP ? registrations.filter(r => r.participant_id === selectedPid).map(r => {
    const a = activities.find(item => item.id === r.activity_id);
    if (!a) return null;
    return { ...a, pct: getAttendancePct(r.activity_id, selectedPid), cert: certificates.find(c => c.activity_id === r.activity_id && c.participant_id === selectedPid && (!c.certificate_kind || c.certificate_kind === 'completion')) };
  }).filter(Boolean) : [];
  const selectedAwards = selectedP ? certificates
    .filter(c => c.participant_id === selectedPid && isRecognitionCertificate(c))
    .sort((a, b) => String(b.issued_date || '').localeCompare(String(a.issued_date || ''))) : [];

  // The drawer behaves as a dialog: focus moves into it, and Escape closes it.
  useEffect(() => {
    if (!selectedP) return undefined;
    drawerCloseRef.current?.focus();
    function onKeyDown(event) { if (event.key === 'Escape') setSelectedPid(null); }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedP]);

  async function shareAward(certificate) {
    if (previewReadOnly) {
      showToast('Recognition delivery is disabled in the read-only preview.');
      return;
    }
    setSharingAwardId(certificate.id);
    try {
      const response = await fetch('/api/award-delivery', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ certificateIds: [certificate.id] }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'LexAMS could not send this recognition.');
      if (Number(body.sent) > 0) {
        showToast('Recognition sent and recorded in Communications history.');
        return;
      }
      const reason = body.skipped?.[0]?.reason;
      const messages = {
        pro_required: 'Recognition delivery is available on LexAMS Pro.',
        monthly_limit: 'The monthly participant-email limit has been reached.',
        missing_email: 'Add a valid participant email address before sharing.',
        suppressed: 'This participant cannot receive email from this workspace.',
        certificate_inactive: 'Only active recognition certificates can be shared.',
        certificate_not_found: 'This recognition certificate is no longer available.',
      };
      throw new Error(messages[reason] || 'LexAMS could not deliver this recognition. Check Communications history for details.');
    } catch (error) {
      showToast(error.message || 'LexAMS could not deliver this recognition.');
    } finally { setSharingAwardId(null); }
  }

  if (loading) return <SkeletonScreen cards={3} label="Loading participants" />;

  const sortMark = key => sort.key !== key ? '' : sort.direction === 'asc' ? '▲' : '▼';
  const ariaSort = key => sort.key !== key ? 'none' : sort.direction === 'asc' ? 'ascending' : 'descending';

  return <div>
    <header className="lx-page-head">
      <div>
        <h1>Participants</h1>
        <p>Central database of everyone engaged across activities.</p>
      </div>
      <div className="lx-page-actions">
        <button type="button" className="lx-btn lx-btn-primary" onClick={() => setShowNew(true)}>Add participant</button>
      </div>
    </header>

    <div className="lx-participants-filters">
      <label className="lx-visually-hidden" htmlFor="participant-search">Search participants</label>
      <input id="participant-search" type="search" className="lx-field" placeholder="Search by name, email or organisation" value={q} onChange={e => setQ(e.target.value)} />
      <label className="lx-visually-hidden" htmlFor="participant-category-filter">Filter by category</label>
      <select id="participant-category-filter" className="lx-field" value={catF} onChange={e => setCatF(e.target.value)}>
        {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
      </select>
    </div>

    {participants.length === 0 ? (
      <div className="lx-state" style={{ marginTop: 18 }}>
        <Users className="lx-state-icon" size={20} color="var(--color-navy-700)" aria-hidden="true" />
        <div>
          <strong>No participants yet</strong>
          <p>Add someone directly, or import a list from a spreadsheet to get started.</p>
          <div className="lx-state-actions">
            <button type="button" className="lx-btn lx-btn-primary lx-btn-small" onClick={() => setShowNew(true)}>Add participant</button>
          </div>
        </div>
      </div>
    ) : filtered.length === 0 ? (
      <div className="lx-state" style={{ marginTop: 18 }}>
        <SearchX className="lx-state-icon" size={20} color="var(--text-tertiary)" aria-hidden="true" />
        <div>
          <strong>No participants match those filters</strong>
          <p>Try a different search term, or clear the category filter.</p>
          <div className="lx-state-actions">
            <button type="button" className="lx-btn lx-btn-secondary lx-btn-small" onClick={() => { setQ(''); setCatF('all'); }}>Clear filters</button>
          </div>
        </div>
      </div>
    ) : (
      <div className="lx-table-card">
        <div className="lx-table-scroll">
          <table className="lx-table">
            <caption className="lx-visually-hidden">
              Participants, sorted by {COLUMNS.find(c => c.key === sort.key)?.label} {sort.direction === 'asc' ? 'ascending' : 'descending'}
            </caption>
            <thead>
              <tr>
                {COLUMNS.map(column => (
                  <th key={column.key} scope="col" aria-sort={column.sortable ? ariaSort(column.key) : undefined}>
                    {column.sortable ? (
                      <button type="button" className="lx-sort" onClick={() => toggleSort(column.key)}>
                        {column.label}
                        <span className="lx-sort-mark" aria-hidden="true">{sortMark(column.key)}</span>
                      </button>
                    ) : <span>{column.label}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(p => (
                <tr key={p.id}>
                  <td>
                    <button type="button" className="lx-person" onClick={() => setSelectedPid(p.id)}>
                      <span className="lx-avatar" aria-hidden="true">{getInitials(p.name)}</span>
                      <span>
                        <span className="lx-person-name">{p.name}</span>
                        <span className="lx-person-email">{p.email}</span>
                      </span>
                    </button>
                  </td>
                  <td>{p.phone || '—'}</td>
                  <td>{p.org || '—'}</td>
                  <td>{p.category}</td>
                  <td className="lx-num">{counts.activityCount.get(p.id) || 0}</td>
                  <td className="lx-num">{counts.certificateCount.get(p.id) || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="lx-pagination">
          <span>
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          {pageCount > 1 && (
            <div className="lx-pagination-controls">
              <button type="button" className="lx-btn lx-btn-secondary lx-btn-small" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
              <span aria-live="polite">Page {currentPage} of {pageCount}</span>
              <button type="button" className="lx-btn lx-btn-secondary lx-btn-small" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
            </div>
          )}
        </div>
      </div>
    )}

    {selectedP && <>
      <button type="button" className="lx-drawer-backdrop" aria-label="Close participant details" onClick={() => setSelectedPid(null)} />
      <aside className="lx-drawer" role="dialog" aria-modal="true" aria-label={`${selectedP.name} details`}>
        <div className="lx-drawer-head">
          <span className="lx-avatar" aria-hidden="true">{getInitials(selectedP.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="lx-drawer-name">{selectedP.name}</div>
            <div className="lx-drawer-sub">{selectedP.category} · {selectedP.org || '—'}</div>
          </div>
          <button type="button" ref={drawerCloseRef} className="lx-drawer-close" aria-label="Close participant details" onClick={() => setSelectedPid(null)}>&times;</button>
        </div>

        <div className="lx-drawer-section">
          <div className="lx-facts">
            <div><span className="lx-fact-label">Email</span><span>{selectedP.email}</span></div>
            <div><span className="lx-fact-label">Phone</span><span>{selectedP.phone || '—'}</span></div>
            <div><span className="lx-fact-label">Activities</span><span style={{ fontWeight: 600 }}>{selectedActs.length}</span></div>
            <div><span className="lx-fact-label">Recognition awards</span><span style={{ fontWeight: 600 }}>{selectedAwards.length}</span></div>
          </div>
        </div>

        <div className="lx-drawer-actions">
          <a className="lx-btn lx-btn-award" href={`/app/certificates?awardParticipant=${encodeURIComponent(selectedP.id)}#awards-recognition`}>Give award</a>
          <button type="button" className="lx-btn lx-btn-secondary" onClick={() => { setEditForm({ name: selectedP.name, email: selectedP.email, phone: selectedP.phone || '', org: selectedP.org || '', category: selectedP.category }); setEditing(true); }}>Edit</button>
          <button type="button" className="lx-btn lx-btn-danger" onClick={() => setShowDeleteConfirm(true)}>{isAdmin ? 'Delete' : 'Request deletion'}</button>
        </div>

        {editing && editForm && <div className="lx-drawer-section">
          <strong style={{ fontSize: 13 }}>Edit participant</strong>
          <form className="lx-form" onSubmit={async e => { e.preventDefault(); setSaving(true); try { await updateParticipant(selectedPid, editForm); setEditing(false); showToast('Participant updated'); } catch (err) { showToast('Error: ' + err.message); } setSaving(false); }}>
            <label className="lx-visually-hidden" htmlFor="edit-name">Name</label>
            <input id="edit-name" className="lx-field" required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" />
            <label className="lx-visually-hidden" htmlFor="edit-email">Email</label>
            <input id="edit-email" className="lx-field" type="email" required value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" />
            <label className="lx-visually-hidden" htmlFor="edit-phone">Phone</label>
            <input id="edit-phone" className="lx-field" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" />
            <label className="lx-visually-hidden" htmlFor="edit-org">Organisation</label>
            <input id="edit-org" className="lx-field" value={editForm.org} onChange={e => setEditForm(f => ({ ...f, org: e.target.value }))} placeholder="Organisation" />
            <label className="lx-visually-hidden" htmlFor="edit-category">Category</label>
            <select id="edit-category" className="lx-field" value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="lx-dialog-actions">
              <button type="button" className="lx-btn lx-btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" className="lx-btn lx-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>}

        {showDeleteConfirm && <div className="lx-danger-box" role="alert">
          <strong>{isAdmin ? `Delete ${selectedP.name}?` : `Request deletion of ${selectedP.name}?`}</strong>
          <p>{isAdmin
            ? 'This removes the participant and their registrations and attendance. Previously issued certificates and awards are preserved as historical records.'
            : 'An administrator must approve this request. Previously issued certificates and awards remain preserved in the recognition audit trail.'}</p>
          <div className="lx-dialog-actions">
            <button type="button" className="lx-btn lx-btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            <button type="button" className="lx-btn lx-btn-danger" onClick={async () => { try { const result = await deleteParticipant(selectedPid); setShowDeleteConfirm(false); setSelectedPid(null); showToast(result?.pending ? 'Deletion submitted for admin approval' : 'Participant deleted'); } catch (err) { showToast('Error: ' + err.message); } }}>{isAdmin ? 'Delete' : 'Submit request'}</button>
          </div>
        </div>}

        <div className="lx-drawer-section">
          <div className="lx-eyebrow">Participation history</div>
          {selectedActs.length === 0
            ? <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>Not registered to any activity yet.</p>
            : <div className="lx-history">
                {selectedActs.map(a => (
                  <div key={a.id} className="lx-history-item">
                    <strong>{a.title}</strong>
                    <span>{fmtRange({ start: a.start_date, end: a.end_date })} · Attendance: {a.pct !== null ? a.pct + '%' : '—'} · {a.cert ? a.cert.cert_no : 'No completion certificate'}</span>
                  </div>
                ))}
              </div>}

          {selectedAwards.length > 0 && <>
            <div className="lx-eyebrow" style={{ marginTop: 22 }}>Awards &amp; recognition</div>
            <div className="lx-history">
              {selectedAwards.slice(0, 8).map(c => (
                <div key={c.id} className="lx-history-item">
                  <strong>{c.award_title || c.certificate_type || 'Recognition'}</strong>
                  <span>{c.award_period || c.cert_no} · {c.status || 'active'}</span>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button type="button" className="button-link" onClick={() => setPreviewAward(c)}>View certificate</button>
                    <button
                      type="button"
                      className="button-link"
                      disabled={previewReadOnly || sharingAwardId !== null || !c.access_token || c.status !== 'active'}
                      title={previewReadOnly ? 'Delivery disabled in read-only preview' : c.status !== 'active' ? 'Only active recognition can be shared' : c.access_token ? 'Send through LexAMS Communications' : 'Public verification link unavailable'}
                      onClick={() => shareAward(c)}
                    >{sharingAwardId === c.id ? 'Sending…' : 'Share via LexAMS'}</button>
                  </div>
                </div>
              ))}
            </div>
          </>}
        </div>
      </aside>
    </>}

    {showNew && <div className="lx-dialog-backdrop" onClick={() => setShowNew(false)}>
      <div className="lx-dialog" role="dialog" aria-modal="true" aria-labelledby="add-participant-title" onClick={e => e.stopPropagation()}>
        <h2 id="add-participant-title">Add participant</h2>
        <form className="lx-form" onSubmit={handleAddParticipant}>
          <label className="lx-visually-hidden" htmlFor="new-name">Full name</label>
          <input id="new-name" className="lx-field" placeholder="Full name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <label className="lx-visually-hidden" htmlFor="new-email">Email</label>
          <input id="new-email" className="lx-field" type="email" placeholder="Email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <label className="lx-visually-hidden" htmlFor="new-phone">Phone</label>
          <input id="new-phone" className="lx-field" placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <label className="lx-visually-hidden" htmlFor="new-org">Organisation</label>
          <input id="new-org" className="lx-field" placeholder="Organisation" value={form.org} onChange={e => setForm(f => ({ ...f, org: e.target.value }))} />
          <label className="lx-visually-hidden" htmlFor="new-category">Category</label>
          <select id="new-category" className="lx-field" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {activities.length > 0 && <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="lx-form-label">Assign to activities</legend>
            <div className="lx-check-list">
              {activities.map(a => (
                <label key={a.id}>
                  <input type="checkbox" checked={form.activityIds.includes(a.id)} onChange={() => toggleActivity(a.id)} />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 600 }}>{a.title}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)' }}>{a.type} · {a.status}</span>
                  </span>
                </label>
              ))}
            </div>
            {form.activityIds.length > 0 && <p style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 600, color: 'var(--color-navy-700)' }}>
              {form.activityIds.length} activit{form.activityIds.length === 1 ? 'y' : 'ies'} selected
            </p>}
          </fieldset>}

          <div className="lx-dialog-actions">
            <button type="button" className="lx-btn lx-btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
            <button type="submit" className="lx-btn lx-btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add participant'}</button>
          </div>
        </form>
      </div>
    </div>}

    {previewAward && <CertificatePreview
      cert={previewAward}
      participant={participants.find(p => p.id === previewAward.participant_id)}
      activity={activities.find(a => a.id === previewAward.activity_id)}
      orgName={profile?.org_name || 'Organization'}
      logoUrl={profile?.logo_url}
      onClose={() => setPreviewAward(null)}
    />}

    {toast && <div role="status" aria-live="polite" className="lx-toast">{toast}</div>}
  </div>;
}
