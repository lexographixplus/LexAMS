import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { initials as getInitials } from '../lib/format';
import { fmtRange } from '../lib/format';

export default function Participants() {
  const { activities, participants, registrations, certificates, loading, addParticipant, updateParticipant, deleteParticipant, addRegistration, getAttendancePct, isAdmin } = useData();
  const [q, setQ] = useState('');
  const [catF, setCatF] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [selectedPid, setSelectedPid] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', org: '', category: 'Volunteer', activityIds: [] });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  const categories = ['all', ...new Set(participants.map(p => p.category))];

  const filtered = participants.filter(p => {
    if (q) {
      const lq = q.toLowerCase();
      if (!p.name.toLowerCase().includes(lq) && !p.email.toLowerCase().includes(lq) && !(p.org || '').toLowerCase().includes(lq)) return false;
    }
    if (catF !== 'all' && p.category !== catF) return false;
    return true;
  });

  function toggleActivity(actId) {
    setForm(f => ({
      ...f,
      activityIds: f.activityIds.includes(actId)
        ? f.activityIds.filter(id => id !== actId)
        : [...f.activityIds, actId],
    }));
  }

  async function handleAddParticipant(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      const result = await addParticipant({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        org: form.org.trim() || null,
        category: form.category,
      }, { activityIds: form.activityIds });
      if (result?.pending) {
        setShowNew(false);
        setForm({ name: '', email: '', phone: '', org: '', category: 'Volunteer', activityIds: [] });
        showToast('Submitted for admin approval');
      } else {
        for (const actId of form.activityIds) {
          try { await addRegistration(actId, result.id); } catch {}
        }
        setShowNew(false);
        setForm({ name: '', email: '', phone: '', org: '', category: 'Volunteer', activityIds: [] });
        if (form.activityIds.length > 0) {
          showToast(`Participant added and registered to ${form.activityIds.length} activit${form.activityIds.length === 1 ? 'y' : 'ies'}`);
        }
      }
    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  const selectedP = selectedPid ? participants.find(p => p.id === selectedPid) : null;
  const selectedActs = selectedP ? registrations.filter(r => r.participant_id === selectedPid).map(r => {
    const a = activities.find(a => a.id === r.activity_id);
    if (!a) return null;
    const pct = getAttendancePct(r.activity_id, selectedPid);
    const cert = certificates.find(c => c.activity_id === r.activity_id && c.participant_id === selectedPid);
    return { ...a, pct, cert };
  }).filter(Boolean) : [];

  const inputStyle = {
    width: '100%', padding: '10px 14px', fontSize: 14,
    border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-card)', outline: 'none',
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Loading participants...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>Participants</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            Central database of everyone engaged across activities.
          </p>
        </div>
        <button onClick={() => setShowNew(true)} style={{
          padding: '10px 20px', fontSize: 14, fontWeight: 600,
          color: 'var(--color-navy-900)', background: 'var(--color-gold-500)',
          border: 'none', borderRadius: 'var(--radius-md)',
        }}>Add participant</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 14, marginTop: 22 }}>
        <input
          placeholder="Search by name, email or organization..."
          value={q} onChange={e => setQ(e.target.value)}
          style={inputStyle}
        />
        <select value={catF} onChange={e => setCatF(e.target.value)} style={inputStyle}>
          {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
        </select>
      </div>

      <div style={{
        background: 'var(--surface-card)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
        overflow: 'hidden', marginTop: 18,
      }}>
        <div className="table-scroll"><div style={{minWidth: 700}}>
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.6fr 1.1fr 0.8fr 0.8fr',
          gap: 14, padding: '12px 22px', fontSize: 11, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600,
          background: 'var(--surface-muted)',
        }}>
          <div>Participant</div><div>Phone</div><div>Organization</div>
          <div>Category</div><div>Activities</div><div>Certs</div>
        </div>
        {filtered.map(p => {
          const actCount = registrations.filter(r => r.participant_id === p.id).length;
          const certCount = certificates.filter(c => c.participant_id === p.id).length;
          return (
            <div
              key={p.id}
              onClick={() => setSelectedPid(p.id)}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.6fr 1.1fr 0.8fr 0.8fr',
                gap: 14, alignItems: 'center', padding: '12px 22px',
                borderTop: '1px solid var(--border-default)', cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-muted)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 999, background: 'var(--surface-muted)',
                  color: 'var(--color-navy-700)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>{getInitials(p.name)}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{p.email}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.phone || '\u2014'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.org || '\u2014'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.category}</div>
              <div style={{ fontSize: 13 }}>{actCount}</div>
              <div style={{ fontSize: 13 }}>{certCount}</div>
            </div>
          );
        })}
        </div></div>
      </div>

      {selectedP && (
        <>
          <div onClick={() => setSelectedPid(null)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,43,84,0.25)', zIndex: 140,
          }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
            background: 'var(--surface-card)', boxShadow: 'var(--shadow-raised)',
            zIndex: 150, overflowY: 'auto',
          }}>
            <div style={{
              padding: 24, borderBottom: '1px solid var(--border-default)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 999, background: 'var(--color-navy-900)',
                color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 700, flexShrink: 0,
              }}>{getInitials(selectedP.name)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700 }}>{selectedP.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {selectedP.category} &middot; {selectedP.org || '\u2014'}
                </div>
              </div>
              <button onClick={() => setSelectedPid(null)} style={{
                background: 'none', border: 'none', fontSize: 18,
                color: 'var(--text-tertiary)', padding: 4,
              }}>&times;</button>
            </div>
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--border-default)',
              display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Email</span><span>{selectedP.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Phone</span><span>{selectedP.phone || '\u2014'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Activities</span>
                <span style={{ fontWeight: 600 }}>{selectedActs.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Certificates</span>
                <span style={{ fontWeight: 600 }}>{selectedActs.filter(a => a.cert).length}</span>
              </div>
            </div>
            <div style={{
              padding: '12px 24px', borderBottom: '1px solid var(--border-default)',
              display: 'flex', gap: 8,
            }}>
              <button onClick={() => {
                setEditForm({ name: selectedP.name, email: selectedP.email, phone: selectedP.phone || '', org: selectedP.org || '', category: selectedP.category });
                setEditing(true);
              }} style={{
                flex: 1, padding: '8px', fontSize: 13, fontWeight: 600,
                background: 'transparent', border: '1.5px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)', color: 'var(--color-navy-700)', cursor: 'pointer',
              }}>Edit</button>
              <button onClick={() => setShowDeleteConfirm(true)} style={{
                flex: 1, padding: '8px', fontSize: 13, fontWeight: 600,
                background: 'transparent', border: '1.5px solid var(--color-danger)',
                borderRadius: 'var(--radius-sm)', color: 'var(--color-danger)', cursor: 'pointer',
              }}>{isAdmin ? 'Delete' : 'Request deletion'}</button>
            </div>

            {editing && editForm && (
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Edit participant</div>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setSaving(true);
                  try {
                    await updateParticipant(selectedPid, editForm);
                    setEditing(false);
                    showToast('Participant updated');
                  } catch (err) { showToast('Error: ' + err.message); }
                  setSaving(false);
                }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" style={inputStyle} />
                  <input type="email" required value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" style={inputStyle} />
                  <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" style={inputStyle} />
                  <input value={editForm.org} onChange={e => setEditForm(f => ({ ...f, org: e.target.value }))} placeholder="Organization" style={inputStyle} />
                  <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                    {['Volunteer', 'Staff', 'Community member', 'Partner', 'Youth', 'Teacher', 'Parent', 'External'].map(c =>
                      <option key={c} value={c}>{c}</option>
                    )}
                  </select>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setEditing(false)} style={{
                      padding: '8px 16px', fontSize: 13, fontWeight: 600, background: 'transparent',
                      border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-secondary)', cursor: 'pointer',
                    }}>Cancel</button>
                    <button type="submit" disabled={saving} style={{
                      padding: '8px 16px', fontSize: 13, fontWeight: 600,
                      background: 'var(--color-navy-900)', color: '#FFFFFF',
                      border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      opacity: saving ? 0.7 : 1,
                    }}>{saving ? 'Saving...' : 'Save'}</button>
                  </div>
                </form>
              </div>
            )}

            {showDeleteConfirm && (
              <div style={{
                padding: '20px 24px', borderBottom: '1px solid var(--border-default)',
                background: '#FEF2F2',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)' }}>
                  {isAdmin ? `Delete ${selectedP.name}?` : `Request deletion of ${selectedP.name}?`}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
                  {isAdmin
                    ? 'This removes the participant and all their registrations, attendance, and certificates.'
                    : 'An administrator must approve this request before the participant and related records are removed.'}
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button onClick={() => setShowDeleteConfirm(false)} style={{
                    padding: '8px 16px', fontSize: 13, fontWeight: 600, background: 'transparent',
                    border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                  }}>Cancel</button>
                  <button onClick={async () => {
                    try {
                      const result = await deleteParticipant(selectedPid);
                      setShowDeleteConfirm(false);
                      setSelectedPid(null);
                      showToast(result?.pending ? 'Deletion submitted for admin approval' : 'Participant deleted');
                    } catch (err) { showToast('Error: ' + err.message); }
                  }} style={{
                    padding: '8px 16px', fontSize: 13, fontWeight: 600,
                    background: 'var(--color-danger)', color: '#FFFFFF',
                    border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  }}>{isAdmin ? 'Delete' : 'Submit request'}</button>
                </div>
              </div>
            )}

            <div style={{ padding: '20px 24px' }}>
              <div style={{
                fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--text-tertiary)', fontWeight: 600,
              }}>Participation history</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                {selectedActs.map(a => (
                  <div key={a.id} style={{
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)', padding: '12px 14px',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {fmtRange({ start: a.start_date, end: a.end_date })} &middot; Attendance: {a.pct !== null ? a.pct + '%' : '\u2014'}
                      {' '}&middot; {a.cert ? a.cert.cert_no : 'No certificate'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {showNew && (
        <div onClick={() => setShowNew(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,43,84,0.25)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-raised)', padding: '28px 32px',
            width: 420, maxWidth: '95vw',
          }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>Add participant</h3>
            <form onSubmit={handleAddParticipant} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input placeholder="Full name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
              <input type="email" placeholder="Email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
              <input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
              <input placeholder="Organization" value={form.org} onChange={e => setForm(f => ({ ...f, org: e.target.value }))} style={inputStyle} />
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                {['Volunteer', 'Staff', 'Community member', 'Partner', 'Youth', 'Teacher', 'Parent', 'External'].map(c =>
                  <option key={c} value={c}>{c}</option>
                )}
              </select>

              {activities.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                    Assign to activities
                  </label>
                  <div style={{
                    border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                    maxHeight: 160, overflowY: 'auto', background: 'var(--surface-card)',
                  }}>
                    {activities.map(a => (
                      <label key={a.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 14px', fontSize: 13, cursor: 'pointer',
                        borderBottom: '1px solid var(--border-default)',
                        background: form.activityIds.includes(a.id) ? 'var(--surface-muted)' : 'transparent',
                      }}>
                        <input
                          type="checkbox"
                          checked={form.activityIds.includes(a.id)}
                          onChange={() => toggleActivity(a.id)}
                          style={{ accentColor: 'var(--color-navy-900)' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500 }}>{a.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.type} &middot; {a.status}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {form.activityIds.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--color-navy-700)', marginTop: 6, fontWeight: 500 }}>
                      {form.activityIds.length} activit{form.activityIds.length === 1 ? 'y' : 'ies'} selected
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                <button type="button" onClick={() => setShowNew(false)} style={{
                  padding: '10px 20px', fontSize: 14, fontWeight: 600,
                  background: 'transparent', border: '1.5px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)',
                }}>Cancel</button>
                <button type="submit" disabled={saving} style={{
                  padding: '10px 20px', fontSize: 14, fontWeight: 600,
                  background: 'var(--color-navy-900)', color: '#FFFFFF',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  opacity: saving ? 0.6 : 1,
                }}>{saving ? 'Adding...' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
