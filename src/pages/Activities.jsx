import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Filter, MapPin, Plus, Search, Users } from 'lucide-react';
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

  const types = ['all', ...new Set(activities.map(a => a.type).filter(Boolean))];
  const statuses = ['all', 'Completed', 'Ongoing', 'Upcoming'];

  const filtered = useMemo(() => activities.filter(a => {
    if (q && !`${a.title} ${a.venue || ''} ${a.facilitator || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (typeF !== 'all' && a.type !== typeF) return false;
    if (statusF !== 'all' && a.status !== statusF) return false;
    return true;
  }), [activities, q, typeF, statusF]);

  const ongoing = activities.filter(a => a.status === 'Ongoing').length;
  const upcoming = activities.filter(a => a.status === 'Upcoming').length;
  const completed = activities.filter(a => a.status === 'Completed').length;

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

  const inputStyle = {
    padding: '10px 13px', fontSize: 14, border: '1px solid var(--border-default)',
    borderRadius: 9, background: 'var(--surface-card)', color: 'var(--text-primary)',
    outline: 'none', width: '100%', fontFamily: 'var(--font-body)',
  };

  if (loading) {
    return <div style={{ minHeight: 360, display: 'grid', placeItems: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>Loading activities...</div>;
  }

  return (
    <div className="activities-workspace">
      <style>{`
        .activities-workspace { display: grid; gap: 24px; }
        .activities-hero { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: end; }
        .activities-title { font-family: var(--font-display); font-size: 30px; line-height: 1.1; margin: 0; color: var(--color-navy-900); }
        .activities-lede { margin: 8px 0 0; color: var(--text-secondary); font-size: 14px; line-height: 1.6; max-width: 640px; }
        .activities-create { min-height: 42px; padding: 0 17px; display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 9px; background: var(--color-navy-900); color: white; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: var(--shadow-card); }
        .activities-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid var(--border-default); border-radius: 14px; overflow: hidden; background: var(--surface-card); }
        .activities-summary-item { padding: 18px 20px; border-right: 1px solid var(--border-default); }
        .activities-summary-item:last-child { border-right: 0; }
        .activities-summary-label { color: var(--text-tertiary); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .09em; }
        .activities-summary-value { margin-top: 7px; font-family: var(--font-display); color: var(--color-navy-900); font-size: 25px; font-weight: 700; }
        .activities-tools { display: grid; grid-template-columns: minmax(240px, 1fr) 180px 180px; gap: 10px; align-items: center; }
        .activities-search { position: relative; }
        .activities-search svg { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); }
        .activities-search input { padding-left: 38px !important; }
        .activities-board { border: 1px solid var(--border-default); border-radius: 14px; overflow: hidden; background: var(--surface-card); box-shadow: var(--shadow-card); }
        .activities-board-head { padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 18px; border-bottom: 1px solid var(--border-default); }
        .activities-board-title { font-size: 13px; font-weight: 700; color: var(--color-navy-900); }
        .activities-board-count { font-size: 12px; color: var(--text-tertiary); }
        .activities-list { display: grid; }
        .activities-card { padding: 18px 20px; display: grid; grid-template-columns: minmax(240px, 2fr) 1fr .7fr .8fr; gap: 18px; align-items: center; border-bottom: 1px solid var(--border-default); cursor: pointer; transition: background 140ms ease; }
        .activities-card:last-child { border-bottom: 0; }
        .activities-card:hover { background: var(--surface-muted); }
        .activities-name { font-size: 14px; font-weight: 700; color: var(--text-primary); }
        .activities-meta { margin-top: 7px; display: flex; gap: 13px; flex-wrap: wrap; color: var(--text-tertiary); font-size: 12px; }
        .activities-meta span { display: inline-flex; align-items: center; gap: 5px; }
        .activities-metric-label { color: var(--text-tertiary); font-size: 12px; text-transform: uppercase; letter-spacing: .07em; font-weight: 700; }
        .activities-metric-value { margin-top: 6px; color: var(--text-primary); font-size: 13px; font-weight: 600; }
        .activities-empty { padding: 54px 24px; text-align: center; }
        .activities-empty-title { font-family: var(--font-display); font-size: 20px; color: var(--color-navy-900); font-weight: 700; }
        .activities-empty-copy { margin: 8px auto 0; max-width: 460px; color: var(--text-secondary); font-size: 13px; line-height: 1.65; }
        @media (max-width: 900px) {
          .activities-summary { grid-template-columns: 1fr 1fr; }
          .activities-summary-item:nth-child(2) { border-right: 0; }
          .activities-summary-item:nth-child(-n+2) { border-bottom: 1px solid var(--border-default); }
          .activities-tools { grid-template-columns: 1fr 1fr; }
          .activities-search { grid-column: 1 / -1; }
          .activities-card { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 620px) {
          .activities-hero { grid-template-columns: 1fr; }
          .activities-create { justify-content: center; }
          .activities-tools { grid-template-columns: 1fr; }
          .activities-search { grid-column: auto; }
          .activities-card { grid-template-columns: 1fr; gap: 12px; }
        }
      `}</style>

      <section className="activities-hero">
        <div>
          <h1 className="activities-title">Activities</h1>
          <p className="activities-lede">Plan, monitor and close programme activities from one working view. Open an activity to manage participation, attendance, outcomes and certificates.</p>
        </div>
        <button className="activities-create" onClick={() => setShowNewDlg(true)}><Plus size={16} /> New activity</button>
      </section>

      <section className="activities-summary" aria-label="Activity summary">
        {[
          ['All activities', activities.length],
          ['Ongoing', ongoing],
          ['Upcoming', upcoming],
          ['Completed', completed],
        ].map(([label, value]) => (
          <div className="activities-summary-item" key={label}>
            <div className="activities-summary-label">{label}</div>
            <div className="activities-summary-value">{value}</div>
          </div>
        ))}
      </section>

      <section className="activities-tools" aria-label="Activity filters">
        <div className="activities-search">
          <Search size={16} aria-hidden="true" />
          <label className="lx-visually-hidden" htmlFor="activity-search">Search activities</label>
          <input id="activity-search" type="search" style={inputStyle} placeholder="Search title, venue or facilitator" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <label className="lx-visually-hidden" htmlFor="activity-type-filter">Filter by type</label>
        <select id="activity-type-filter" value={typeF} onChange={e => setTypeF(e.target.value)} style={inputStyle}>
          {types.map(t => <option key={t} value={t}>{t === 'all' ? 'All types' : t}</option>)}
        </select>
        <label className="lx-visually-hidden" htmlFor="activity-status-filter">Filter by status</label>
        <select id="activity-status-filter" value={statusF} onChange={e => setStatusF(e.target.value)} style={inputStyle}>
          {statuses.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
        </select>
      </section>

      <section className="activities-board">
        <div className="activities-board-head">
          <div className="activities-board-title">Activity register</div>
          <div className="activities-board-count">{filtered.length} shown</div>
        </div>
        {filtered.length ? (
          <div className="activities-list">
            {filtered.map(a => {
              const pids = getRegsForActivity(a.id);
              const pcts = pids.map(pid => getAttendancePct(a.id, pid)).filter(v => v !== null);
              const avg = pcts.length ? `${Math.round(pcts.reduce((x, y) => x + y, 0) / pcts.length)}%` : 'Not started';
              return (
                <article className="activities-card" key={a.id} onClick={() => navigate(`/app/activities/${a.id}`)}>
                  <div>
                    <div className="activities-name">{a.title}</div>
                    <div className="activities-meta">
                      <span><CalendarDays size={12} /> {fmtRange({ start: a.start_date, end: a.end_date })}</span>
                      <span><MapPin size={12} /> {a.venue || 'Venue TBD'}</span>
                      <span>{a.type}</span>
                    </div>
                  </div>
                  <div>
                    <div className="activities-metric-label">Participation</div>
                    <div className="activities-metric-value"><Users size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{pids.length} registered</div>
                  </div>
                  <div>
                    <div className="activities-metric-label">Attendance</div>
                    <div className="activities-metric-value">{avg}</div>
                  </div>
                  <div><span style={statusChip(a.status)}>{a.status}</span></div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="activities-empty">
            <Filter size={22} color="var(--color-navy-700)" />
            <div className="activities-empty-title">No activities found</div>
            <div className="activities-empty-copy">Adjust the filters or create a new activity to start building your programme record.</div>
          </div>
        )}
      </section>

      {showNewDlg && (
        <div onClick={() => setShowNewDlg(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,43,84,.34)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', borderRadius: 16, boxShadow: 'var(--shadow-raised)', padding: '28px 30px', width: 520, maxWidth: '100%' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--color-navy-900)' }}>Create activity</div>
            <p style={{ margin: '7px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>Add the core delivery details now. Registration, attendance and outcomes can be managed from the activity workspace after creation.</p>
            <form onSubmit={createActivity} style={{ marginTop: 20, display: 'grid', gap: 13 }}>
              <input placeholder="Activity title" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
                  {['Training', 'Workshop', 'Meeting', 'Seminar', 'Conference', 'Community engagement'].map(t => <option key={t}>{t}</option>)}
                </select>
                <input placeholder="Venue" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inputStyle} />
                <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={inputStyle} />
              </div>
              <input placeholder="Lead facilitator" value={form.facilitator} onChange={e => setForm(f => ({ ...f, facilitator: e.target.value }))} style={inputStyle} />
              <textarea placeholder="Description" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setShowNewDlg(false)} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: '10px 18px', borderRadius: 9, border: 0, background: 'var(--color-navy-900)', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: submitting ? .65 : 1 }}>{submitting ? 'Creating...' : 'Create activity'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
