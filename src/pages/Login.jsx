import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user && !loading) return <Navigate to="/app" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
      setSubmitting(false);
    } else {
      navigate('/app');
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface-page)', padding: '40px 20px',
    }}>
      <Link to="/" style={{
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: 26, color: 'var(--color-navy-900)',
        marginBottom: 8, textDecoration: 'none',
      }}>LexAMS</Link>
      <div style={{
        fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 32,
      }}>by LexoStudio</div>

      <div style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        padding: '36px 32px',
        width: '100%', maxWidth: 420,
      }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 24,
          fontWeight: 700, margin: 0,
        }}>Welcome back</h1>
        <p style={{
          fontSize: 14, color: 'var(--text-secondary)',
          marginTop: 8, lineHeight: 1.5,
        }}>Sign in to your account to continue.</p>

        {error && (
          <div style={{
            marginTop: 16, padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            background: '#F9E4E2', color: 'var(--color-danger)',
            fontSize: 13, fontWeight: 500,
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{
                display: 'block', fontSize: 14, fontWeight: 500,
                color: 'var(--text-primary)', marginBottom: 6,
              }}>Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.org"
                style={{
                  width: '100%', padding: '11px 14px',
                  fontSize: 16, color: 'var(--text-primary)',
                  border: '1.5px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-card)',
                  outline: 'none',
                  transition: 'border-color 200ms',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--color-navy-700)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
              />
            </div>
            <div>
              <label style={{
                display: 'block', fontSize: 14, fontWeight: 500,
                color: 'var(--text-primary)', marginBottom: 6,
              }}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%', padding: '11px 14px',
                  fontSize: 16, color: 'var(--text-primary)',
                  border: '1.5px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-card)',
                  outline: 'none',
                  transition: 'border-color 200ms',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--color-navy-700)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', marginTop: 24,
              padding: '12px 20px', fontSize: 15, fontWeight: 600,
              color: 'var(--color-navy-900)',
              background: 'var(--color-gold-500)',
              border: 'none', borderRadius: 'var(--radius-md)',
              opacity: submitting ? 0.7 : 1,
              transition: 'background 200ms',
            }}
          >{submitting ? 'Signing in...' : 'Sign in'}</button>
        </form>

        <div style={{
          marginTop: 20, textAlign: 'center',
          fontSize: 14, color: 'var(--text-secondary)',
        }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ fontWeight: 600, color: 'var(--color-navy-700)' }}>
            Sign up
          </Link>
        </div>
      </div>

    </div>
  );
}
