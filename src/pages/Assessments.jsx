import { useState } from 'react';
import { apiClient } from '../lib/api';
import { useData } from '../contexts/DataContext';
import { Plus, Link as LinkIcon, Eye, Trash2, Copy } from 'lucide-react';

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'short_answer', label: 'Short answer' },
  { value: 'long_answer', label: 'Long answer' },
];

const ASSESSMENT_TYPES = [
  { value: 'standalone', label: 'Standalone' },
  { value: 'pre', label: 'Pre-test' },
  { value: 'post', label: 'Post-test' },
];

export default function Assessments() {
  const { activities, assessments, setAssessments } = useData();
  const [view, setView] = useState('list');
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [toast, setToast] = useState(null);

  const [form, setForm] = useState({
    title: '', description: '', activity_id: '',
    assessment_type: 'standalone', passing_score: 70, time_limit_minutes: '',
  });
  const [editQuestions, setEditQuestions] = useState([]);
  const [saving, setSaving] = useState(false);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  function addQuestion() {
    setEditQuestions(prev => [...prev, {
      id: Date.now(), question_text: '', question_type: 'multiple_choice',
      options: [], correct_answer: '', points: 1, sort_order: prev.length,
    }]);
  }

  function updateQuestion(idx, updates) {
    setEditQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));
  }

  function removeQuestion(idx) {
    setEditQuestions(prev => prev.filter((_, i) => i !== idx));
  }

  async function createAssessment(e) {
    e.preventDefault();
    if (!form.title.trim() || editQuestions.length === 0) return;
    setSaving(true);
    try {
      const { data: assess, error } = await apiClient.from('assessments').insert({
        title: form.title.trim(),
        description: form.description.trim(),
        activity_id: form.activity_id ? +form.activity_id : null,
        assessment_type: form.assessment_type,
        passing_score: +form.passing_score || 70,
        time_limit_minutes: form.time_limit_minutes ? +form.time_limit_minutes : null,
        status: 'active',
      }).select().single();
      if (error) throw error;

      const qs = editQuestions.map((q, i) => ({
        assessment_id: assess.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer: q.correct_answer || null,
        points: q.points,
        sort_order: i,
      }));
      await apiClient.from('assessment_questions').insert(qs);

      setAssessments(prev => [assess, ...prev]);
      setForm({ title: '', description: '', activity_id: '', assessment_type: 'standalone', passing_score: 70, time_limit_minutes: '' });
      setEditQuestions([]);
      setView('list');
      showToast('Assessment created and active');
    } catch (err) {
      showToast('Error: ' + err.message);
    }
    setSaving(false);
  }

  async function openDetail(assess) {
    setSelectedAssessment(assess);
    const [{ data: qs }, { data: subs }] = await Promise.all([
      apiClient.from('assessment_questions').select('*').eq('assessment_id', assess.id).order('sort_order'),
      apiClient.from('assessment_submissions').select('*').eq('assessment_id', assess.id).order('submitted_at', { ascending: false }),
    ]);
    setQuestions(qs || []);
    setSubmissions(subs || []);
    setView('detail');
  }

  async function toggleStatus(assess) {
    const newStatus = assess.status === 'active' ? 'closed' : 'active';
    const { data } = await apiClient.from('assessments').update({ status: newStatus }).eq('id', assess.id).select().single();
    if (data) {
      setAssessments(prev => prev.map(a => a.id === assess.id ? data : a));
      if (selectedAssessment?.id === assess.id) setSelectedAssessment(data);
      showToast(`Assessment ${newStatus === 'active' ? 'activated' : 'closed'}`);
    }
  }

  async function deleteAssessment(id) {
    await apiClient.from('assessments').delete().eq('id', id);
    setAssessments(prev => prev.filter(a => a.id !== id));
    if (selectedAssessment?.id === id) { setView('list'); setSelectedAssessment(null); }
    showToast('Assessment deleted');
  }

  function copyLink(token) {
    navigator.clipboard.writeText(`${window.location.origin}/assessment/${token}`);
    showToast('Assessment link copied');
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', fontSize: 14,
    border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-card)', outline: 'none', color: 'var(--text-primary)',
  };

  // ---- LIST VIEW ----
  if (view === 'list') return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>Assessments</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            Create pre/post tests or standalone assessments with auto-grading.
          </p>
        </div>
        <button onClick={() => { setView('create'); setEditQuestions([]); }} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 20px', fontSize: 14, fontWeight: 600,
          color: 'var(--color-navy-900)', background: 'var(--color-gold-500)',
          border: 'none', borderRadius: 'var(--radius-md)',
        }}><Plus size={16} /> New assessment</button>
      </div>

      {assessments.length === 0 ? (
        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', padding: 48, textAlign: 'center',
          fontSize: 14, color: 'var(--text-tertiary)', marginTop: 22,
        }}>No assessments yet. Create one to test participant knowledge.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 22 }}>
          {assessments.map(a => {
            const act = activities.find(ac => ac.id === a.activity_id);
            return (
              <div key={a.id} style={{
                background: 'var(--surface-card)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
                padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{a.title}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                      background: 'var(--surface-muted)', color: 'var(--text-tertiary)',
                    }}>{a.assessment_type}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {act ? act.title : 'No activity linked'} &middot; Pass: {a.passing_score}%
                    {a.time_limit_minutes && ` \u00B7 ${a.time_limit_minutes} min`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                    background: a.status === 'active' ? '#E4F3E9' : a.status === 'closed' ? '#F9E4E2' : 'var(--surface-muted)',
                    color: a.status === 'active' ? 'var(--color-success)' : a.status === 'closed' ? 'var(--color-danger)' : 'var(--text-tertiary)',
                  }}>{a.status}</span>
                  <button onClick={() => copyLink(a.share_token)} title="Copy link" style={{
                    background: 'none', border: 'none', color: 'var(--color-navy-700)', padding: 6,
                  }}><Copy size={16} /></button>
                  <button onClick={() => openDetail(a)} title="View results" style={{
                    background: 'none', border: 'none', color: 'var(--color-navy-700)', padding: 6,
                  }}><Eye size={16} /></button>
                  <button onClick={() => deleteAssessment(a.id)} title="Delete" style={{
                    background: 'none', border: 'none', color: 'var(--color-danger)', padding: 6,
                  }}><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {toast && <Toast msg={toast} />}
    </div>
  );

  // ---- CREATE VIEW ----
  if (view === 'create') return (
    <div>
      <button onClick={() => setView('list')} style={{
        background: 'none', border: 'none', fontSize: 13, fontWeight: 600,
        color: 'var(--color-navy-700)', padding: 0, marginBottom: 14,
      }}>&larr; Back to assessments</button>

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>Create assessment</h2>

      <form onSubmit={createAssessment} style={{ marginTop: 22 }}>
        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '24px 28px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Title</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Module 1 Knowledge Check" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Instructions for participants" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Type</label>
                <select value={form.assessment_type} onChange={e => setForm(f => ({ ...f, assessment_type: e.target.value }))} style={inputStyle}>
                  {ASSESSMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Passing score (%)</label>
                <input type="number" min={0} max={100} value={form.passing_score}
                  onChange={e => setForm(f => ({ ...f, passing_score: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Time limit (min)</label>
                <input type="number" min={1} value={form.time_limit_minutes} placeholder="No limit"
                  onChange={e => setForm(f => ({ ...f, time_limit_minutes: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Link to activity</label>
              <select value={form.activity_id} onChange={e => setForm(f => ({ ...f, activity_id: e.target.value }))} style={inputStyle}>
                <option value="">No activity</option>
                {activities.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Questions ({editQuestions.length})</h3>
            <button type="button" onClick={addQuestion} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              background: 'transparent', border: '1.5px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', color: 'var(--color-navy-700)',
            }}><Plus size={14} /> Add question</button>
          </div>

          {editQuestions.length === 0 && (
            <div style={{
              background: 'var(--surface-card)', border: '1px dashed var(--border-default)',
              borderRadius: 'var(--radius-lg)', padding: 36, textAlign: 'center',
              fontSize: 13, color: 'var(--text-tertiary)', marginTop: 14,
            }}>Add at least one question.</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            {editQuestions.map((q, i) => (
              <div key={q.id} style={{
                background: 'var(--surface-card)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                    Question {i + 1} &middot; {q.points} pt{q.points !== 1 ? 's' : ''}
                  </span>
                  <button type="button" onClick={() => removeQuestion(i)} style={{
                    background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: 13, fontWeight: 600,
                  }}>Remove</button>
                </div>
                <input required value={q.question_text}
                  onChange={e => updateQuestion(i, { question_text: e.target.value })}
                  placeholder="Enter your question" style={{ ...inputStyle, marginBottom: 10 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 10 }}>
                  <select value={q.question_type}
                    onChange={e => updateQuestion(i, { question_type: e.target.value, options: e.target.value === 'true_false' ? ['True', 'False'] : [], correct_answer: '' })}
                    style={inputStyle}>
                    {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  {(q.question_type === 'multiple_choice' || q.question_type === 'true_false') && (
                    <select value={q.correct_answer}
                      onChange={e => updateQuestion(i, { correct_answer: e.target.value })}
                      style={inputStyle}>
                      <option value="">Correct answer</option>
                      {(q.question_type === 'true_false' ? ['True', 'False'] : q.options || []).map(o =>
                        <option key={o} value={o}>{o}</option>
                      )}
                    </select>
                  )}
                  <div>
                    <input type="number" min={1} value={q.points}
                      onChange={e => updateQuestion(i, { points: +e.target.value || 1 })}
                      style={inputStyle} title="Points" />
                  </div>
                </div>
                {q.question_type === 'multiple_choice' && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                      Options (one per line)
                    </label>
                    <textarea
                      value={(q.options || []).join('\n')}
                      onChange={e => updateQuestion(i, { options: e.target.value.split('\n').filter(o => o.trim()) })}
                      placeholder="Option A&#10;Option B&#10;Option C&#10;Option D"
                      rows={4} style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button type="button" onClick={() => setView('list')} style={{
            padding: '10px 20px', fontSize: 14, fontWeight: 600,
            background: 'transparent', border: '1.5px solid var(--border-default)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)',
          }}>Cancel</button>
          <button type="submit" disabled={saving || editQuestions.length === 0} style={{
            padding: '10px 24px', fontSize: 14, fontWeight: 600,
            background: 'var(--color-navy-900)', color: '#FFFFFF',
            border: 'none', borderRadius: 'var(--radius-md)',
            opacity: (saving || editQuestions.length === 0) ? 0.6 : 1,
          }}>{saving ? 'Creating...' : 'Create & activate'}</button>
        </div>
      </form>
      {toast && <Toast msg={toast} />}
    </div>
  );

  // ---- DETAIL VIEW ----
  if (view === 'detail' && selectedAssessment) {
    const totalPoints = questions.reduce((s, q) => s + q.points, 0);
    const completedSubs = submissions.filter(s => s.submitted_at);
    const avgPct = completedSubs.length
      ? (completedSubs.reduce((s, sub) => s + (sub.percentage || 0), 0) / completedSubs.length).toFixed(1)
      : null;
    const passCount = completedSubs.filter(s => s.passed).length;

    return (
      <div>
        <button onClick={() => { setView('list'); setSelectedAssessment(null); }} style={{
          background: 'none', border: 'none', fontSize: 13, fontWeight: 600,
          color: 'var(--color-navy-700)', padding: 0, marginBottom: 14,
        }}>&larr; Back to assessments</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>{selectedAssessment.title}</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
              {selectedAssessment.assessment_type} &middot; Pass: {selectedAssessment.passing_score}%
              {selectedAssessment.time_limit_minutes && ` \u00B7 ${selectedAssessment.time_limit_minutes} min`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => toggleStatus(selectedAssessment)} style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              background: 'transparent', border: '1.5px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', color: 'var(--color-navy-700)',
            }}>{selectedAssessment.status === 'active' ? 'Close' : 'Reopen'}</button>
            <button onClick={() => copyLink(selectedAssessment.share_token)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              background: 'var(--color-navy-900)', color: '#FFFFFF',
              border: 'none', borderRadius: 'var(--radius-md)',
            }}><LinkIcon size={14} /> Copy link</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginTop: 22 }}>
          {[
            { label: 'Submissions', value: completedSubs.length },
            { label: 'Average score', value: avgPct ? avgPct + '%' : '\u2014' },
            { label: 'Pass rate', value: completedSubs.length ? Math.round(passCount / completedSubs.length * 100) + '%' : '\u2014' },
            { label: 'Total points', value: totalPoints },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--surface-card)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '20px 22px',
            }}>
              <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginTop: 8 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Submissions table */}
        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', marginTop: 20,
        }}>
          <div style={{ padding: '16px 22px', fontSize: 14, fontWeight: 600 }}>Submissions</div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1fr 0.8fr',
            gap: 14, padding: '12px 22px', fontSize: 12, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600,
            background: 'var(--surface-muted)',
          }}>
            <div>Name</div><div>Email</div><div>Score</div><div>Percentage</div><div>Result</div>
          </div>
          {completedSubs.length === 0 ? (
            <div style={{ padding: '26px 22px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-default)' }}>
              No submissions yet.
            </div>
          ) : completedSubs.map(s => (
            <div key={s.id} style={{
              display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1fr 0.8fr',
              gap: 14, alignItems: 'center', padding: '11px 22px',
              borderTop: '1px solid var(--border-default)', fontSize: 13,
            }}>
              <div style={{ fontWeight: 600 }}>{s.respondent_name || 'Anonymous'}</div>
              <div style={{ color: 'var(--text-secondary)' }}>{s.respondent_email || '\u2014'}</div>
              <div>{s.score}/{s.total_points}</div>
              <div>{s.percentage != null ? s.percentage + '%' : '\u2014'}</div>
              <div>
                <span style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  background: s.passed ? '#E4F3E9' : '#F9E4E2',
                  color: s.passed ? 'var(--color-success)' : 'var(--color-danger)',
                }}>{s.passed ? 'Passed' : 'Failed'}</span>
              </div>
            </div>
          ))}
        </div>
        {toast && <Toast msg={toast} />}
      </div>
    );
  }

  return null;
}

function Toast({ msg }) {
  return (
    <div style={{
      position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--color-navy-900)', color: '#FFFFFF', fontSize: 13, fontWeight: 500,
      padding: '11px 20px', borderRadius: 999, boxShadow: 'var(--shadow-raised)', zIndex: 300,
    }}>{msg}</div>
  );
}
