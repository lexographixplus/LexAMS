import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Signup() {
  const { signUp, user, loading } = useAuth();
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  if (user && !loading) return <Navigate to="/app" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await signUp(email, null, fullName, orgName);
    if (err) setError(err.message || 'Could not start your account. Please try again.');
    else setEmailSent(true);
    setSubmitting(false);
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', fontSize: 16,
    color: 'var(--text-primary)', border: '1.5px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)', outline: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-page)', padding: '40px 20px' }}>
      <Link to="/" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color: 'var(--color-navy-900)', marginBottom: 8, textDecoration: 'none' }}>LexAMS</Link>
      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 32 }}>by LexoStudio</div>

      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '36px 32px', width: '100%', maxWidth: 420 }}>
        {emailSent ? (
          <div style={{ textAlign: 'center', padding: '18px 0' }}>
            <div style={{ fontSize: 30, marginBottom: 16 }}>&#9993;</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>Check your inbox</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 10 }}>
              We sent a secure setup link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: 12 }}>
              Open it to finish creating your LexAMS workspace. No password is required.
            </p>
          </div>
        ) : (
          <>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, margin: 0 }}>Create your workspace</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>Set up your organization, then verify your email with a secure link.</p>

            {error && <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: '#F9E4E2', color: 'var(--color-danger)', fontSize: 13, fontWeight: 500 }}>{error}</div>}

            <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Full name</label>
                  <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Organization name</label>
                  <input type="text" required value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. Horizon Community Foundation" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Email address</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.org" autoComplete="email" style={inputStyle} />
                </div>
              </div>

              <button type="submit" disabled={submitting} style={{ width: '100%', marginTop: 24, padding: '12px 20px', fontSize: 15, fontWeight: 600, color: 'var(--color-navy-900)', background: 'var(--color-gold-500)', border: 'none', borderRadius: 'var(--radius-md)', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Sending setup link...' : 'Create workspace'}
              </button>
            </form>

            <div style={{ marginTop: 20, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
              Already have an account? <Link to="/login" style={{ fontWeight: 600, color: 'var(--color-navy-700)' }}>Sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
