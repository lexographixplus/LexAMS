import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useData } from '../contexts/DataContext';
import { fmtDate } from '../lib/format';
import { Plus, Link as LinkIcon, Eye, Trash2, Copy } from 'lucide-react';

const QUESTION_TYPES = [
  { value: 'rating', label: 'Rating (1-5)' },
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'text', label: 'Text response' },
  { value: 'yes_no', label: 'Yes / No' },
];

export default function Surveys() {
  const { activities, surveys, setSurveys } = useData();
  const navigate = useNavigate();
  const [view, setView] = useState('list'); // list | create | detail
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [responses, setResponses] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [toast, setToast] = useState(null);

  // Create form
  const [form, setForm] = useState({
    title: '', description: '', activity_id: '', allow_anonymous: false,
  });
  const [editQuestions, setEditQuestions] = useState([]);
  const [saving, setSaving] = useState(false);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function addQuestion() {
    setEditQuestions(prev => [...prev, {
      id: Date.now(), question_text: '', question_type: 'rating',
      options: [], required: true, sort_order: prev.length,
    }]);
  }

  function updateQuestion(idx, updates) {
    setEditQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));
  }

  function removeQuestion(idx) {
    setEditQuestions(prev => prev.filter((_, i) => i !== idx));
  }

  async function createSurvey(e) {
    e.preventDefault();
    if (!form.title.trim() || editQuestions.length === 0) return;
    setSaving(true);
    try {
      const { data: survey, error } = await supabase.from('surveys').insert({
        title: form.title.trim(),
        description: form.description.trim(),
        activity_id: form.activity_id ? +form.activity_id : null,
        allow_anonymous: form.allow_anonymous,
        status: 'active',
      }).select().single();
      if (error) throw error;

      const qs = editQuestions.map((q, i) => ({
        survey_id: survey.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        required: q.required,
        sort_order: i,
      }));
      await supabase.from('survey_questions').insert(qs);

      setSurveys(prev => [survey, ...prev]);
      setForm({ title: '', description: '', activity_id: '', allow_anonymous: false });
      setEditQuestions([]);
      setView('list');
      showToast('Survey created and active');
    } catch (err) {
      showToast('Error: ' + err.message);
    }
    setSaving(false);
  }

  async function openDetail(survey) {
    setSelectedSurvey(survey);
    const [{ data: qs }, { data: resps }] = await Promise.all([
      supabase.from('survey_questions').select('*').eq('survey_id', survey.id).order('sort_order'),
      supabase.from('survey_responses').select('*').eq('survey_id', survey.id).order('submitted_at', { ascending: false }),
    ]);
    setQuestions(qs || []);
    setResponses(resps || []);
    setView('detail');
  }

  async function toggleStatus(survey) {
    const newStatus = survey.status === 'active' ? 'closed' : 'active';
    const { data } = await supabase.from('surveys').update({ status: newStatus }).eq('id', survey.id).select().single();
    if (data) {
      setSurveys(prev => prev.map(s => s.id === survey.id ? data : s));
      if (selectedSurvey?.id === survey.id) setSelectedSurvey(data);
      showToast(`Survey ${newStatus === 'active' ? 'activated' : 'closed'}`);
    }
  }

  async function deleteSurvey(id) {
    await supabase.from('surveys').delete().eq('id', id);
    setSurveys(prev => prev.filter(s => s.id !== id));
    if (selectedSurvey?.id === id) { setView('list'); setSelectedSurvey(null); }
    showToast('Survey deleted');
  }

  function copyLink(token) {
    const url = `${window.location.origin}/survey/${token}`;
    navigator.clipboard.writeText(url);
    showToast('Survey link copied');
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
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>Surveys</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            Create post-activity surveys, share via link, and track responses.
          </p>
        </div>
        <button onClick={() => { setView('create'); setEditQuestions([]); }} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 20px', fontSize: 14, fontWeight: 600,
          color: 'var(--color-navy-900)', background: 'var(--color-gold-500)',
          border: 'none', borderRadius: 'var(--radius-md)',
        }}><Plus size={16} /> New survey</button>
      </div>

      {surveys.length === 0 ? (
        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', padding: 48, textAlign: 'center',
          fontSize: 14, color: 'var(--text-tertiary)', marginTop: 22,
        }}>No surveys yet. Create one to start collecting feedback.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 22 }}>
          {surveys.map(s => {
            const act = activities.find(a => a.id === s.activity_id);
            return (
              <div key={s.id} style={{
                background: 'var(--surface-card)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
                padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{s.title}</span>
                    {s.allow_anonymous && (
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                        background: 'var(--surface-muted)', color: 'var(--text-tertiary)',
                      }}>Anonymous</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {act ? act.title : 'No activity linked'} &middot; Created {fmtDate(s.created_at?.slice(0, 10))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                    background: s.status === 'active' ? '#E4F3E9' : s.status === 'closed' ? '#F9E4E2' : 'var(--surface-muted)',
                    color: s.status === 'active' ? 'var(--color-success)' : s.status === 'closed' ? 'var(--color-danger)' : 'var(--text-tertiary)',
                  }}>{s.status}</span>
                  <button onClick={() => copyLink(s.share_token)} title="Copy share link" style={{
                    background: 'none', border: 'none', color: 'var(--color-navy-700)', padding: 6,
                  }}><Copy size={16} /></button>
                  <button onClick={() => openDetail(s)} title="View results" style={{
                    background: 'none', border: 'none', color: 'var(--color-navy-700)', padding: 6,
                  }}><Eye size={16} /></button>
                  <button onClick={() => deleteSurvey(s.id)} title="Delete" style={{
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
      }}>&larr; Back to surveys</button>

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>Create survey</h2>

      <form onSubmit={createSurvey} style={{ marginTop: 22 }}>
        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '24px 28px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Survey title</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Post-training evaluation" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Description (optional)</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief instructions for respondents" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Link to activity (optional)</label>
              <select value={form.activity_id} onChange={e => setForm(f => ({ ...f, activity_id: e.target.value }))} style={inputStyle}>
                <option value="">No activity</option>
                {activities.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </div>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', borderRadius: 'var(--radius-sm)',
              border: '1.5px solid var(--border-default)', cursor: 'pointer',
              background: form.allow_anonymous ? 'var(--surface-muted)' : 'var(--surface-card)',
            }}>
              <input type="checkbox" checked={form.allow_anonymous}
                onChange={e => setForm(f => ({ ...f, allow_anonymous: e.target.checked }))}
                style={{ accentColor: 'var(--color-navy-900)', width: 16, height: 16 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Allow anonymous responses</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  Participants won't be asked for their name or email
                </div>
              </div>
            </label>
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
            }}>Add at least one question to create the survey.</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            {editQuestions.map((q, i) => (
              <div key={q.id} style={{
                background: 'var(--surface-card)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>Question {i + 1}</span>
                  <button type="button" onClick={() => removeQuestion(i)} style={{
                    background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: 13, fontWeight: 600,
                  }}>Remove</button>
                </div>
                <input
                  required
                  value={q.question_text}
                  onChange={e => updateQuestion(i, { question_text: e.target.value })}
                  placeholder="Enter your question"
                  style={{ ...inputStyle, marginBottom: 10 }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <select value={q.question_type} onChange={e => updateQuestion(i, { question_type: e.target.value, options: [] })} style={inputStyle}>
                    {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={q.required} onChange={e => updateQuestion(i, { required: e.target.checked })} />
                    Required
                  </label>
                </div>
                {q.question_type === 'multiple_choice' && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                      Options (one per line)
                    </label>
                    <textarea
                      value={(q.options || []).join('\n')}
                      onChange={e => updateQuestion(i, { options: e.target.value.split('\n').filter(o => o.trim()) })}
                      placeholder="Option 1&#10;Option 2&#10;Option 3"
                      rows={3} style={{ ...inputStyle, resize: 'vertical' }}
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

  // ---- DETAIL VIEW (results) ----
  if (view === 'detail' && selectedSurvey) return (
    <div>
      <button onClick={() => { setView('list'); setSelectedSurvey(null); }} style={{
        background: 'none', border: 'none', fontSize: 13, fontWeight: 600,
        color: 'var(--color-navy-700)', padding: 0, marginBottom: 14,
      }}>&larr; Back to surveys</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>{selectedSurvey.title}</h2>
          {selectedSurvey.description && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{selectedSurvey.description}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => toggleStatus(selectedSurvey)} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            background: 'transparent', border: '1.5px solid var(--border-default)',
            borderRadius: 'var(--radius-md)', color: 'var(--color-navy-700)',
          }}>{selectedSurvey.status === 'active' ? 'Close survey' : 'Reopen survey'}</button>
          <button onClick={() => copyLink(selectedSurvey.share_token)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            background: 'var(--color-navy-900)', color: '#FFFFFF',
            border: 'none', borderRadius: 'var(--radius-md)',
          }}><LinkIcon size={14} /> Copy link</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 22 }}>
        {[
          { label: 'Responses', value: responses.length },
          { label: 'Questions', value: questions.length },
          { label: 'Status', value: selectedSurvey.status.charAt(0).toUpperCase() + selectedSurvey.status.slice(1) },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--surface-card)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '20px 22px',
          }}>
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginTop: 8 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Question results */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Results by question</h3>
        {questions.map(q => {
          const answers = responses.map(r => r.answers?.[q.id]).filter(Boolean);
          return (
            <div key={q.id} style={{
              background: 'var(--surface-card)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
              padding: '20px 24px', marginBottom: 14,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{q.question_text}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {q.question_type} &middot; {answers.length} responses
              </div>
              <div style={{ marginTop: 12 }}>
                {q.question_type === 'rating' && answers.length > 0 && (() => {
                  const avg = (answers.reduce((s, v) => s + Number(v), 0) / answers.length).toFixed(1);
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Average rating</span>
                        <span style={{ fontWeight: 600 }}>{avg} / 5</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--surface-muted)', borderRadius: 999, marginTop: 7, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 999, background: 'var(--color-navy-700)', width: `${(avg / 5) * 100}%` }} />
                      </div>
                    </div>
                  );
                })()}
                {q.question_type === 'multiple_choice' && (() => {
                  const counts = {};
                  answers.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(q.options || []).map(opt => (
                        <div key={opt} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{opt}</span>
                          <span style={{ fontWeight: 600 }}>{counts[opt] || 0}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {q.question_type === 'yes_no' && (() => {
                  const yes = answers.filter(a => a === 'Yes').length;
                  const no = answers.filter(a => a === 'No').length;
                  return (
                    <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                      <span>Yes: <strong>{yes}</strong></span>
                      <span>No: <strong>{no}</strong></span>
                    </div>
                  );
                })()}
                {q.question_type === 'text' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {answers.slice(0, 10).map((a, i) => (
                      <div key={i} style={{
                        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55,
                        borderLeft: '2px solid var(--color-mist-200)', paddingLeft: 12,
                      }}>"{a}"</div>
                    ))}
                    {answers.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No responses yet</div>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Individual responses */}
      {responses.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Individual responses</h3>
          <div style={{
            background: 'var(--surface-card)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr',
              gap: 14, padding: '12px 22px', fontSize: 11, letterSpacing: '0.07em',
              textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600,
              background: 'var(--surface-muted)',
            }}>
              <div>Respondent</div><div>Email</div><div>Submitted</div>
            </div>
            {responses.map(r => (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr',
                gap: 14, padding: '11px 22px', borderTop: '1px solid var(--border-default)',
                fontSize: 13,
              }}>
                <div style={{ fontWeight: 600 }}>{r.respondent_name || 'Anonymous'}</div>
                <div style={{ color: 'var(--text-secondary)' }}>{r.respondent_email || '\u2014'}</div>
                <div style={{ color: 'var(--text-secondary)' }}>{fmtDate(r.submitted_at?.slice(0, 10))}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {toast && <Toast msg={toast} />}
    </div>
  );

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
