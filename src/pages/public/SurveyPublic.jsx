import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const anonClient = supabaseUrl ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function SurveyPublic() {
  const { token } = useParams();
  const [survey, setSurvey] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!anonClient) { setError('App not configured'); setLoading(false); return; }
    async function load() {
      const { data: s } = await anonClient.from('surveys').select('*').eq('share_token', token).single();
      if (!s) { setError('Survey not found'); setLoading(false); return; }
      if (s.status !== 'active') { setError('This survey is no longer accepting responses.'); setLoading(false); return; }
      setSurvey(s);
      const { data: qs } = await anonClient.from('survey_questions').select('*').eq('survey_id', s.id).order('sort_order');
      setQuestions(qs || []);
      setLoading(false);
    }
    load();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    // Validate required
    for (const q of questions) {
      if (q.required && !answers[q.id]) {
        setError(`Please answer: "${q.question_text}"`);
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    const { error: err } = await anonClient.from('survey_responses').insert({
      survey_id: survey.id,
      respondent_name: name.trim(),
      respondent_email: email.trim(),
      answers,
    });
    if (err) { setError(err.message); setSubmitting(false); return; }
    setSubmitted(true);
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', fontSize: 16, color: '#0F1B2B',
    border: '1.5px solid #E0E4E9', borderRadius: 6, background: '#FFFFFF', outline: 'none',
  };

  if (loading) return <PageShell><p style={{ textAlign: 'center', color: '#7A8699' }}>Loading survey...</p></PageShell>;
  if (error && !survey) return <PageShell><p style={{ textAlign: 'center', color: '#C0362C' }}>{error}</p></PageShell>;

  if (submitted) return (
    <PageShell>
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 999, background: '#E4F3E9', color: '#2E7D4F',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700,
        }}>&#10003;</div>
        <h2 style={{ fontFamily: "'Merriweather', serif", fontSize: 22, fontWeight: 700, marginTop: 16, color: '#002B54' }}>
          Thank you!
        </h2>
        <p style={{ fontSize: 14, color: '#5B6B80', marginTop: 8 }}>Your response has been recorded.</p>
      </div>
    </PageShell>
  );

  return (
    <PageShell>
      <h2 style={{ fontFamily: "'Merriweather', serif", fontSize: 24, fontWeight: 700, color: '#002B54' }}>
        {survey.title}
      </h2>
      {survey.description && (
        <p style={{ fontSize: 14, color: '#5B6B80', lineHeight: 1.6, marginTop: 8 }}>{survey.description}</p>
      )}

      {survey.allow_anonymous && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 999, marginTop: 12,
          background: '#E9EDF2', fontSize: 12, fontWeight: 600, color: '#5B6B80',
        }}>This survey is anonymous</div>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: survey.allow_anonymous ? 16 : 24 }}>
        {!survey.allow_anonymous && (
          <div style={{
            background: '#FFFFFF', border: '1px solid #E0E4E9', borderRadius: 12,
            boxShadow: '0 1px 2px rgba(0,43,84,0.06), 0 4px 16px rgba(0,43,84,0.06)',
            padding: '24px 28px', marginBottom: 16,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: '#002B54' }}>Your name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: '#002B54' }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.org" style={inputStyle} />
              </div>
            </div>
          </div>
        )}

        {questions.map((q, i) => (
          <div key={q.id} style={{
            background: '#FFFFFF', border: '1px solid #E0E4E9', borderRadius: 12,
            boxShadow: '0 1px 2px rgba(0,43,84,0.06), 0 4px 16px rgba(0,43,84,0.06)',
            padding: '24px 28px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#002B54' }}>
              {i + 1}. {q.question_text}
              {q.required && <span style={{ color: '#C0362C', marginLeft: 4 }}>*</span>}
            </div>
            <div style={{ marginTop: 14 }}>
              {q.question_type === 'rating' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map(v => (
                    <button key={v} type="button" onClick={() => setAnswers(a => ({ ...a, [q.id]: String(v) }))}
                      style={{
                        width: 48, height: 48, borderRadius: 8, fontSize: 18, fontWeight: 600,
                        border: answers[q.id] === String(v) ? '2px solid #002B54' : '1.5px solid #E0E4E9',
                        background: answers[q.id] === String(v) ? '#002B54' : '#FFFFFF',
                        color: answers[q.id] === String(v) ? '#FFFFFF' : '#5B6B80',
                        cursor: 'pointer',
                      }}>{v}</button>
                  ))}
                </div>
              )}
              {q.question_type === 'multiple_choice' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(q.options || []).map(opt => (
                    <label key={opt} style={{
                      display: 'flex', alignItems: 'center', gap: 10, fontSize: 14,
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      border: answers[q.id] === opt ? '1.5px solid #002B54' : '1.5px solid #E0E4E9',
                      background: answers[q.id] === opt ? '#E9EDF2' : '#FFFFFF',
                    }}>
                      <input type="radio" name={`q-${q.id}`} value={opt} checked={answers[q.id] === opt}
                        onChange={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                        style={{ accentColor: '#002B54' }} />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
              {q.question_type === 'yes_no' && (
                <div style={{ display: 'flex', gap: 10 }}>
                  {['Yes', 'No'].map(v => (
                    <button key={v} type="button" onClick={() => setAnswers(a => ({ ...a, [q.id]: v }))}
                      style={{
                        padding: '10px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                        border: answers[q.id] === v ? '2px solid #002B54' : '1.5px solid #E0E4E9',
                        background: answers[q.id] === v ? '#002B54' : '#FFFFFF',
                        color: answers[q.id] === v ? '#FFFFFF' : '#5B6B80',
                        cursor: 'pointer',
                      }}>{v}</button>
                  ))}
                </div>
              )}
              {q.question_type === 'text' && (
                <textarea value={answers[q.id] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                  placeholder="Your answer" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              )}
            </div>
          </div>
        ))}

        {error && <p style={{ color: '#C0362C', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button type="submit" disabled={submitting} style={{
          width: '100%', padding: '14px', fontSize: 16, fontWeight: 600,
          background: '#FAB72D', color: '#002B54', border: 'none', borderRadius: 8,
          opacity: submitting ? 0.7 : 1, cursor: 'pointer',
        }}>{submitting ? 'Submitting...' : 'Submit response'}</button>
      </form>
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', fontFamily: "'Inter', sans-serif", color: '#002B54' }}>
      <div style={{ background: '#002B54', padding: '20px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Merriweather', serif", fontWeight: 700, fontSize: 21, color: '#FFFFFF' }}>LexAMS</div>
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 64px' }}>
        {children}
      </div>
      <div style={{ textAlign: 'center', padding: 16, fontSize: 11, color: '#7A8699', borderTop: '1px solid #E0E4E9' }}>
        Powered by LexAMS &middot; LexoStudio
      </div>
    </div>
  );
}
