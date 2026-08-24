import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { signIn, user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const initialParams = new URLSearchParams(window.location.search);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(initialParams.get('sent') === '1');
  const [accountNotFound, setAccountNotFound] = useState(initialParams.get('error') === 'AccessDenied');

  if (user && !loading) return <Navigate to="/app" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setEmailSent(false);
    setAccountNotFound(false);

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      setSubmitting(false);
      return;
    }

    setSubmitting(true);

    const { error: err, errorCode } = await signIn(normalizedEmail);
    if (errorCode === 'AccessDenied') setAccountNotFound(true);
    else if (err) setError(err.message || 'Could not send sign-in link. Please try again.');
    else setEmailSent(true);
    setSubmitting(false);
  }

  function useAnotherEmail() {
    setEmail('');
    setError(null);
    setEmailSent(false);
    setAccountNotFound(false);
    window.history.replaceState({}, '', '/login');
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface-page)', padding: '40px 20px',
    }}>
      <Link to="/" style={{
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: 26, color: 'var(--color-navy-900)', marginBottom: 8, textDecoration: 'none',
      }}>LexAMS</Link>
      <div style={{
        fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 32,
      }}>by LexoGraphix Plus</div>

      <div style={{
        background: 'var(--surface-card)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
        padding: '36px 32px', width: '100%', maxWidth: 420,
      }}>
        {accountNotFound ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 30, marginBottom: 16 }}>?</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>No LexAMS account found</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
              We couldn’t find an active LexAMS account for this email address.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
              <Link to="/signup" style={{ display: 'block', padding: '12px 20px', fontSize: 15, fontWeight: 600, color: 'var(--color-navy-900)', background: 'var(--color-gold-500)', borderRadius: 'var(--radius-md)' }}>
                Create workspace
              </Link>
              <button type="button" onClick={useAnotherEmail} style={{ width: '100%', padding: '11px 20px', fontSize: 14, fontWeight: 600, color: 'var(--color-navy-700)', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
                Use another email
              </button>
            </div>
          </div>
        ) : emailSent ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 30, marginBottom: 16 }}>&#9993;</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>Check your inbox</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
              If <strong style={{ color: 'var(--text-primary)' }}>{email || 'this email address'}</strong> is linked to a LexAMS account or invitation, a secure sign-in link will arrive shortly.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 12, lineHeight: 1.5 }}>
              New users should create a workspace or use the invitation link sent by their organization.
            </p>
          </div>
        ) : (
          <>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, margin: 0 }}>Welcome back</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
              Enter the email linked to your LexAMS account and we’ll send you a secure sign-in link.
            </p>

            {error && (
              <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: '#F9E4E2', color: 'var(--color-danger)', fontSize: 13, fontWeight: 500 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Email address</label>
              <input
                type="email" required value={email} onChange={e => { setEmail(e.target.value); setError(null); }}
                placeholder="name@example.org" autoComplete="email"
                style={{ width: '100%', padding: '11px 14px', fontSize: 16, color: 'var(--text-primary)', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)', outline: 'none' }}
              />
              <button type="submit" disabled={submitting} style={{ width: '100%', marginTop: 24, padding: '12px 20px', fontSize: 15, fontWeight: 600, color: 'var(--color-navy-900)', background: 'var(--color-gold-500)', border: 'none', borderRadius: 'var(--radius-md)', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Sending link...' : 'Email me a sign-in link'}
              </button>
            </form>

            <div style={{ marginTop: 20, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
              New to LexAMS? <Link to="/signup" style={{ fontWeight: 600, color: 'var(--color-navy-700)' }}>Create workspace</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

