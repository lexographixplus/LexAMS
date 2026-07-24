import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export default function JoinTeam() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('info'); // info | signup | done
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) { setError('App not configured'); setLoading(false); return; }
    async function load() {
      const { data: inv } = await supabase.from('team_invites').select('*').eq('token', token).single();
      if (!inv) { setError('Invalid or expired invite link.'); setLoading(false); return; }
      if (inv.status !== 'pending') { setError('This invitation has already been ' + inv.status + '.'); setLoading(false); return; }
      setInvite(inv);
      setForm(f => ({ ...f, email: inv.email }));

      // Get admin's org name
      const { data: admin } = await supabase.from('profiles').select('full_name, org_name').eq('id', inv.invited_by).single();
      setAdminProfile(admin);
      setLoading(false);
    }
    load();
  }, [token]);

  async function handleSignup(e) {
    e.preventDefault();
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError(null);
    setSubmitting(true);

    // Create account
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName, org_name: adminProfile?.org_name || '' } },
    });

    if (authErr) { setError(authErr.message); setSubmitting(false); return; }

    // Update profile to join the team
    if (authData?.user) {
      await supabase.from('profiles').update({
        team_id: invite.invited_by,
        team_role: 'member',
        org_name: adminProfile?.org_name || '',
      }).eq('id', authData.user.id);

      // Mark invite as accepted
      await supabase.from('team_invites').update({ status: 'accepted' }).eq('id', invite.id);
    }

    setStep('done');
    setSubmitting(false);
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', fontSize: 16, color: '#0F1B2B',
    border: '1.5px solid #E0E4E9', borderRadius: 6, background: '#FFFFFF', outline: 'none',
  };

  if (loading) return <Shell><p style={{ textAlign: 'center', color: '#7A8699' }}>Loading...</p></Shell>;
  if (error && !invite) return (
    <Shell>
      <div style={{
        background: '#FFFFFF', border: '1px solid #E0E4E9', borderRadius: 12,
        padding: '32px 28px', textAlign: 'center',
      }}>
        <p style={{ color: '#C0362C', fontSize: 14 }}>{error}</p>
        <Link to="/login" style={{
          display: 'inline-block', marginTop: 16, fontSize: 14, fontWeight: 600, color: '#0E4C8F',
        }}>Go to login</Link>
      </div>
    </Shell>
  );

  if (step === 'done') return (
    <Shell>
      <div style={{
        background: '#FFFFFF', border: '1px solid #E0E4E9', borderRadius: 12,
        padding: '32px 28px', textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 999, background: '#E4F3E9', color: '#2E7D4F',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700,
        }}>{'\u2713'}</div>
        <h2 style={{ fontFamily: "'Merriweather', serif", fontSize: 22, fontWeight: 700, marginTop: 16, color: '#002B54' }}>
          You've joined the team!
        </h2>
        <p style={{ fontSize: 14, color: '#5B6B80', marginTop: 8 }}>
          Welcome to {adminProfile?.org_name || 'the team'}. You can now sign in to start working.
        </p>
        <Link to="/login" style={{
          display: 'inline-block', marginTop: 20, padding: '12px 32px', fontSize: 15, fontWeight: 600,
          background: '#FAB72D', color: '#002B54', borderRadius: 8, textDecoration: 'none',
        }}>Sign in</Link>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <div style={{
        background: '#FFFFFF', border: '1px solid #E0E4E9', borderRadius: 12,
        boxShadow: '0 1px 2px rgba(0,43,84,0.06), 0 4px 16px rgba(0,43,84,0.06)',
        padding: '32px 28px',
      }}>
        <h2 style={{ fontFamily: "'Merriweather', serif", fontSize: 24, fontWeight: 700, color: '#002B54' }}>
          Join {adminProfile?.org_name || 'Team'}
        </h2>
        <p style={{ fontSize: 14, color: '#5B6B80', marginTop: 8, lineHeight: 1.6 }}>
          {adminProfile?.full_name || 'An administrator'} has invited you to join their team on LexAMS.
          Create your account to get started.
        </p>

        <form onSubmit={handleSignup} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: '#002B54' }}>Full name</label>
            <input required value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
              placeholder="Your full name" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: '#002B54' }}>Email</label>
            <input type="email" required value={form.email} readOnly style={{ ...inputStyle, background: '#F5F5F5', color: '#7A8699' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: '#002B54' }}>Password</label>
            <input type="password" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="At least 6 characters" style={inputStyle} />
          </div>
          {error && <p style={{ color: '#C0362C', fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={submitting} style={{
            width: '100%', padding: '14px', fontSize: 16, fontWeight: 600,
            background: '#FAB72D', color: '#002B54', border: 'none', borderRadius: 8,
            cursor: 'pointer', opacity: submitting ? 0.7 : 1, marginTop: 8,
          }}>{submitting ? 'Creating account...' : 'Create account & join'}</button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#7A8699' }}>
          Already have an account? <Link to="/login" style={{ fontWeight: 600, color: '#0E4C8F' }}>Sign in</Link>
        </div>
      </div>
    </Shell>
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
