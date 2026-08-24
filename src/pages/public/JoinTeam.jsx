import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function JoinTeam() {
  const { token } = useParams();
  const { user, loading: authLoading, signIn, refreshProfile } = useAuth();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/invite/${token}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || 'Invalid or expired invite link.');
        setLoading(false);
        return;
      }
      setInvite(body.invite);
      if (body.invite.status !== 'pending') setError(`This invitation has already been ${body.invite.status}.`);
      setLoading(false);
    }
    load();
  }, [token]);

  useEffect(() => {
    if (!invite || !user || authLoading || accepted || accepting || invite.status !== 'pending') return;
    acceptInvite();
  }, [invite, user, authLoading, accepted, accepting]);

  async function sendLink() {
    setSending(true);
    setError(null);
    const { error: authError } = await signIn(invite.email, `/join/${token}`);
    if (authError) setError(authError.message || 'Could not send sign-in link.');
    else setSent(true);
    setSending(false);
  }

  async function acceptInvite() {
    setAccepting(true);
    setError(null);
    const response = await fetch(`/api/invite/${token}`, { method: 'POST', credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Could not accept invitation.');
      setAccepting(false);
      return;
    }
    await refreshProfile();
    setAccepted(true);
    setAccepting(false);
  }

  if (loading || authLoading) return <Shell><p style={{ textAlign: 'center', color: '#7A8699' }}>Loading invitation...</p></Shell>;

  if (!invite) return (
    <Shell>
      <Card>
        <p style={{ color: '#C0362C', fontSize: 14 }}>{error || 'Invitation not found.'}</p>
        <Link to="/login" style={{ display: 'inline-block', marginTop: 16, fontSize: 14, fontWeight: 600, color: '#0E4C8F' }}>Go to sign in</Link>
      </Card>
    </Shell>
  );

  if (accepted) return (
    <Shell>
      <Card>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 999, background: '#E4F3E9', color: '#2E7D4F', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700 }}>✓</div>
          <h2 style={{ fontFamily: "'Merriweather', serif", fontSize: 22, fontWeight: 700, marginTop: 16, color: '#002B54' }}>You're in.</h2>
          <p style={{ fontSize: 14, color: '#5B6B80', marginTop: 8 }}>You've joined {invite.organization_name} on LexAMS.</p>
          <Link to="/app" style={{ display: 'inline-block', marginTop: 20, padding: '12px 32px', fontSize: 15, fontWeight: 600, background: '#FAB72D', color: '#002B54', borderRadius: 8, textDecoration: 'none' }}>Open workspace</Link>
        </div>
      </Card>
    </Shell>
  );

  return (
    <Shell>
      <Card>
        <h2 style={{ fontFamily: "'Merriweather', serif", fontSize: 24, fontWeight: 700, color: '#002B54' }}>Join {invite.organization_name}</h2>
        <p style={{ fontSize: 14, color: '#5B6B80', marginTop: 8, lineHeight: 1.6 }}>
          {invite.invited_by_name || 'An administrator'} invited <strong>{invite.email}</strong> to collaborate on LexAMS.
        </p>

        {error && <p style={{ color: '#C0362C', fontSize: 13, marginTop: 16 }}>{error}</p>}

        {user ? (
          <button onClick={acceptInvite} disabled={accepting || invite.status !== 'pending'} style={buttonStyle}>
            {accepting ? 'Joining workspace...' : 'Accept invitation'}
          </button>
        ) : sent ? (
          <div style={{ marginTop: 22, padding: '14px 16px', borderRadius: 8, background: '#E4F3E9', color: '#2E7D4F', fontSize: 14, lineHeight: 1.5 }}>
            Check <strong>{invite.email}</strong> for your secure LexAMS sign-in link. It will return you here to complete the invitation.
          </div>
        ) : (
          <button onClick={sendLink} disabled={sending || invite.status !== 'pending'} style={buttonStyle}>
            {sending ? 'Sending secure link...' : 'Continue with secure email link'}
          </button>
        )}

        <p style={{ fontSize: 12, color: '#7A8699', lineHeight: 1.5, marginTop: 16 }}>
          No password is required. LexAMS will verify your identity using the email address the invitation was sent to.
        </p>
      </Card>
    </Shell>
  );
}

const buttonStyle = {
  width: '100%', padding: '14px', fontSize: 15, fontWeight: 600,
  background: '#FAB72D', color: '#002B54', border: 'none', borderRadius: 8,
  cursor: 'pointer', marginTop: 22,
};

function Card({ children }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E0E4E9', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,43,84,0.06), 0 4px 16px rgba(0,43,84,0.06)', padding: '32px 28px' }}>
      {children}
    </div>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', fontFamily: "'Inter', sans-serif", color: '#002B54' }}>
      <div style={{ background: '#002B54', padding: '20px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Merriweather', serif", fontWeight: 700, fontSize: 21, color: '#FFFFFF' }}>LexAMS</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Team Invitation</div>
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px 64px' }}>{children}</div>
    </div>
  );
}
