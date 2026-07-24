import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { fmtRange, statusChip } from '../lib/format';

export default function Activities() {
  const { activities, loading, addActivity, getRegsForActivity, getAttendancePct } = useData();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [typeF, setTypeF] = useState('all');
  const [statusF, setStatusF] = useState('all');
  const [showNewDlg, setShowNewDlg] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'Training', venue: '', start_date: '', end_date: '', facilitator: '', description: '' });

  const types = ['all', ...new Set(activities.map(a => a.type))];
  const statuses = ['all', 'Completed', 'Ongoing', 'Upcoming'];

  const filtered = activities.filter(a => {
    if (q && !a.title.toLowerCase().includes(q.toLowerCase())) return false;
    if (typeF !== 'all' && a.type !== typeF) return false;
    if (statusF !== 'all' && a.status !== statusF) return false;
    return true;
  });

  async function createActivity(e) {
    e.preventDefault();
    if (!form.title.trim() || submitting) return;
    const start_date = form.start_date || new Date().toISOString().slice(0, 10);
    const end_date = form.end_date || start_date;
    const sessions = Math.max(1, Math.round((new Date(end_date) - new Date(start_date)) / 86400000) + 1);
    setSubmitting(true);
    try {
      await addActivity({
        title: form.title.trim(),
        type: form.type,
        status: 'Upcoming',
        venue: form.venue.trim() || 'TBD',
        organizer: 'Programs Unit',
        facilitator: form.facilitator.trim() || 'TBD',
        start_date,
        end_date,
        sessions,
        reg_open: true,
        description: form.description.trim() || 'No description provided.',
      });
      setShowNewDlg(false);
      setForm({ title: '', type: 'Training', venue: '', start_date: '', end_date: '', facilitator: '', description: '' });
    } catch (err) {
      console.error('Failed to create activity:', err);
    } finally {
      setSubmitting(false);
    }
  }

  const selectStyle = {
    padding: '10px 14px', fontSize: 14, border: '1.5px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)',
    color: 'var(--text-primary)', outline: 'none', width: '100%',
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid var(--border-default)',
            borderTopColor: 'var(--color-navy-900)', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
          }} />
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Loading activities...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>Activities</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            {activities.length} activities &middot; {activities.filter(a => a.status === 'Ongoing').length} ongoing
          </p>
        </div>
        <button onClick={() => setShowNewDlg(true)} style={{
          padding: '10px 20px', fontSize: 14, fontWeight: 600,
          color: 'var(--color-navy-900)', background: 'var(--color-gold-500)',
          border: 'none', borderRadius: 'var(--radius-md)',
        }}>New activity</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px', gap: 14, marginTop: 22 }}>
        <input
          placeholder="Search activities..."
          value={q} onChange={e => setQ(e.target.value)}
          style={{
            padding: '10px 14px', fontSize: 14,
            border: '1.5px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)',
            outline: 'none', width: '100%',
          }}
        />
        <select value={typeF} onChange={e => setTypeF(e.target.value)} style={selectStyle}>
          {types.map(t => <option key={t} value={t}>{t === 'all' ? 'All types' : t}</option>)}
        </select>
        <select value={statusF} onChange={e => setStatusF(e.target.value)} style={selectStyle}>
          {statuses.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--surface-card)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
        overflow: 'hidden', marginTop: 18,
      }}>
        <div className="table-scroll"><div style={{minWidth: 700}}>
        <div style={{
          display: 'grid', gridTemplateColumns: '2.4fr 1fr 1.3fr 0.8fr 1fr 0.9fr',
          gap: 14, padding: '12px 22px', fontSize: 11, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600,
          background: 'var(--surface-muted)',
        }}>
          <div>Activity</div><div>Type</div><div>Dates</div>
          <div>Registered</div><div>Attendance</div><div>Status</div>
        </div>
        {filtered.map(a => {
          const pids = getRegsForActivity(a.id);
          const pcts = pids.map(p => getAttendancePct(a.id, p)).filter(v => v !== null);
          const avg = pcts.length ? Math.round(pcts.reduce((x, y) => x + y, 0) / pcts.length) + '%' : '\u2014';
          return (
            <div
              key={a.id}
              onClick={() => navigate(`/app/activities/${a.id}`)}
              style={{
                display: 'grid', gridTemplateColumns: '2.4fr 1fr 1.3fr 0.8fr 1fr 0.9fr',
                gap: 14, alignItems: 'center', padding: '14px 22px',
                borderTop: '1px solid var(--border-default)', cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-muted)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{a.venue}</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.type}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{fmtRange({ start: a.start_date, end: a.end_date })}</div>
              <div style={{ fontSize: 13 }}>{pids.length}</div>
              <div style={{ fontSize: 13 }}>{avg}</div>
              <div><span style={statusChip(a.status)}>{a.status}</span></div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{
            padding: '36px 22px', textAlign: 'center',
            fontSize: 13, color: 'var(--text-tertiary)',
            borderTop: '1px solid var(--border-default)',
          }}>No activities match the current filters.</div>
        )}
        </div></div>
      </div>

      {/* New Activity Dialog */}
      {showNewDlg && (
        <div
          onClick={() => setShowNewDlg(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,43,84,0.25)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-raised)', padding: '28px 32px',
              width: 480, maxWidth: '95vw',
            }}
          >
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>New activity</h3>
            <form onSubmit={createActivity} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input placeholder="Title" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                style={{ ...selectStyle }} />
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={selectStyle}>
                {['Training', 'Workshop', 'Meeting', 'Seminar', 'Conference', 'Community engagement'].map(t =>
                  <option key={t} value={t}>{t}</option>
                )}
              </select>
              <input placeholder="Venue" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                style={selectStyle} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  style={selectStyle} />
                <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  style={selectStyle} />
              </div>
              <input placeholder="Lead facilitator" value={form.facilitator} onChange={e => setForm(f => ({ ...f, facilitator: e.target.value }))}
                style={selectStyle} />
              <textarea placeholder="Description" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                style={{ ...selectStyle, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                <button type="button" onClick={() => setShowNewDlg(false)} style={{
                  padding: '10px 20px', fontSize: 14, fontWeight: 600,
                  background: 'transparent', border: '1.5px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)',
                }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{
                  padding: '10px 20px', fontSize: 14, fontWeight: 600,
                  background: 'var(--color-navy-900)', color: '#FFFFFF',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  opacity: submitting ? 0.6 : 1,
                }}>{submitting ? 'Creating...' : 'Create activity'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
