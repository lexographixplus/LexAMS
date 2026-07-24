import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const anonClient = supabaseUrl ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function AssessmentPublic() {
  const { token } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!anonClient) { setError('App not configured'); setLoading(false); return; }
    async function load() {
      const { data: a } = await anonClient.from('assessments').select('*').eq('share_token', token).single();
      if (!a) { setError('Assessment not found'); setLoading(false); return; }
      if (a.status !== 'active') { setError('This assessment is no longer accepting submissions.'); setLoading(false); return; }
      setAssessment(a);
      const { data: qs } = await anonClient.from('assessment_questions').select('*').eq('assessment_id', a.id).order('sort_order');
      setQuestions(qs || []);
      setLoading(false);
    }
    load();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [token]);

  function startAssessment() {
    setStarted(true);
    if (assessment.time_limit_minutes) {
      setTimeLeft(assessment.time_limit_minutes * 60);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleSubmit(null, true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }

  async function handleSubmit(e, autoSubmit = false) {
    if (e) e.preventDefault();
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitting(true);
    setError(null);

    // Grade
    let score = 0;
    const totalPoints = questions.reduce((s, q) => s + q.points, 0);
    questions.forEach(q => {
      if (q.question_type === 'multiple_choice' || q.question_type === 'true_false') {
        if (q.correct_answer && answers[q.id] === q.correct_answer) {
          score += q.points;
        }
      }
      // Short/long answers need manual grading - give full points for now if answered
    });

    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100 * 100) / 100 : 0;
    const passed = percentage >= (assessment.passing_score || 70);

    const { error: err } = await anonClient.from('assessment_submissions').insert({
      assessment_id: assessment.id,
      respondent_name: name.trim(),
      respondent_email: email.trim(),
      answers,
      score,
      total_points: totalPoints,
      percentage,
      passed,
      submitted_at: new Date().toISOString(),
    });

    if (err) { setError(err.message); setSubmitting(false); return; }
    setResult({ score, totalPoints, percentage, passed });
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', fontSize: 16, color: '#0F1B2B',
    border: '1.5px solid #E0E4E9', borderRadius: 6, background: '#FFFFFF', outline: 'none',
  };

  if (loading) return <PageShell><p style={{ textAlign: 'center', color: '#7A8699' }}>Loading assessment...</p></PageShell>;
  if (error && !assessment) return <PageShell><p style={{ textAlign: 'center', color: '#C0362C' }}>{error}</p></PageShell>;

  // Result screen
  if (result) return (
    <PageShell>
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 999,
          background: result.passed ? '#E4F3E9' : '#F9E4E2',
          color: result.passed ? '#2E7D4F' : '#C0362C',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 700,
        }}>{result.passed ? '\u2713' : '\u2717'}</div>
        <h2 style={{ fontFamily: "'Merriweather', serif", fontSize: 24, fontWeight: 700, marginTop: 16, color: '#002B54' }}>
          {result.passed ? 'Congratulations!' : 'Assessment complete'}
        </h2>
        <p style={{ fontSize: 16, color: '#5B6B80', marginTop: 8 }}>
          You scored <strong>{result.score}/{result.totalPoints}</strong> ({result.percentage}%)
        </p>
        <div style={{
          display: 'inline-block', padding: '8px 20px', borderRadius: 999, marginTop: 16,
          fontSize: 14, fontWeight: 600,
          background: result.passed ? '#E4F3E9' : '#F9E4E2',
          color: result.passed ? '#2E7D4F' : '#C0362C',
        }}>
          {result.passed ? 'PASSED' : 'DID NOT PASS'} (required: {assessment.passing_score}%)
        </div>
      </div>
    </PageShell>
  );

  // Start screen
  if (!started) return (
    <PageShell>
      <div style={{
        background: '#FFFFFF', border: '1px solid #E0E4E9', borderRadius: 12,
        boxShadow: '0 1px 2px rgba(0,43,84,0.06), 0 4px 16px rgba(0,43,84,0.06)',
        padding: '32px 28px', textAlign: 'center',
      }}>
        <h2 style={{ fontFamily: "'Merriweather', serif", fontSize: 24, fontWeight: 700, color: '#002B54' }}>
          {assessment.title}
        </h2>
        {assessment.description && (
          <p style={{ fontSize: 14, color: '#5B6B80', lineHeight: 1.6, marginTop: 10 }}>{assessment.description}</p>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 20, fontSize: 13, color: '#5B6B80' }}>
          <span>{questions.length} questions</span>
          <span>Pass: {assessment.passing_score}%</span>
          {assessment.time_limit_minutes && <span>Time: {assessment.time_limit_minutes} min</span>}
        </div>
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320, marginInline: 'auto' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" style={inputStyle} />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" style={inputStyle} />
        </div>
        <button onClick={startAssessment} style={{
          marginTop: 24, padding: '14px 40px', fontSize: 16, fontWeight: 600,
          background: '#FAB72D', color: '#002B54', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>Start assessment</button>
      </div>
    </PageShell>
  );

  // Assessment in progress
  return (
    <PageShell>
      {timeLeft !== null && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: timeLeft <= 60 ? '#F9E4E2' : '#E9EDF2',
          padding: '8px 16px', borderRadius: 8, textAlign: 'center',
          fontSize: 14, fontWeight: 600, marginBottom: 20,
          color: timeLeft <= 60 ? '#C0362C' : '#002B54',
        }}>
          Time remaining: {formatTime(timeLeft)}
        </div>
      )}

      <h2 style={{ fontFamily: "'Merriweather', serif", fontSize: 22, fontWeight: 700, color: '#002B54', marginBottom: 20 }}>
        {assessment.title}
      </h2>

      <form onSubmit={handleSubmit}>
        {questions.map((q, i) => (
          <div key={q.id} style={{
            background: '#FFFFFF', border: '1px solid #E0E4E9', borderRadius: 12,
            boxShadow: '0 1px 2px rgba(0,43,84,0.06), 0 4px 16px rgba(0,43,84,0.06)',
            padding: '24px 28px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#002B54' }}>
                {i + 1}. {q.question_text}
              </span>
              <span style={{ fontSize: 11, color: '#7A8699', fontWeight: 600 }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ marginTop: 14 }}>
              {(q.question_type === 'multiple_choice' || q.question_type === 'true_false') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(q.question_type === 'true_false' ? ['True', 'False'] : q.options || []).map(opt => (
                    <label key={opt} style={{
                      display: 'flex', alignItems: 'center', gap: 10, fontSize: 14,
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      border: answers[q.id] === opt ? '1.5px solid #002B54' : '1.5px solid #E0E4E9',
                      background: answers[q.id] === opt ? '#E9EDF2' : '#FFFFFF',
                    }}>
                      <input type="radio" name={`q-${q.id}`} value={opt} checked={answers[q.id] === opt}
                        onChange={() => setAnswers(a => ({ ...a, [q.id]: opt }))} style={{ accentColor: '#002B54' }} />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
              {q.question_type === 'short_answer' && (
                <input value={answers[q.id] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                  placeholder="Your answer" style={inputStyle} />
              )}
              {q.question_type === 'long_answer' && (
                <textarea value={answers[q.id] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                  placeholder="Your answer" rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
              )}
            </div>
          </div>
        ))}

        {error && <p style={{ color: '#C0362C', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button type="submit" disabled={submitting} style={{
          width: '100%', padding: '14px', fontSize: 16, fontWeight: 600,
          background: '#002B54', color: '#FFFFFF', border: 'none', borderRadius: 8,
          opacity: submitting ? 0.7 : 1, cursor: 'pointer',
        }}>{submitting ? 'Submitting...' : 'Submit assessment'}</button>
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
