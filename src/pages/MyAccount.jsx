import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';

export default function MyAccount() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

  async function saveAccount(event) {
    event.preventDefault();
    if (!profile?.id) return;
    setSaving(true);
    try {
      const { error } = await apiClient.from('profiles').update({ full_name: fullName.trim() }).eq('id', profile.id);
      if (error) {
        showToast(`Could not save account details: ${error.message}`);
        return;
      }
      await refreshProfile();
      showToast('Account details saved');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', fontSize: 16, color: 'var(--text-primary)',
    border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-card)', outline: 'none',
  };
  const card = { background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '24px 28px' };

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>My account</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Manage your sign-in identity and personal details.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24, marginTop: 24 }}>
        <section style={card}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Personal details</div>
          <form onSubmit={saveAccount} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label htmlFor="account-full-name" style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Full name</label>
              <input id="account-full-name" value={fullName} onChange={event => setFullName(event.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--text-tertiary)' }}>Sign-in email</label>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '11px 0', overflowWrap: 'anywhere' }}>{user?.email || 'Managed by LexAMS passwordless sign-in'}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={saving} style={{ padding: '10px 24px', fontSize: 14, fontWeight: 600, background: 'var(--color-navy-900)', color: '#FFFFFF', border: 'none', borderRadius: 'var(--radius-md)', opacity: saving ? 0.7 : 1, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </section>

        <section style={card}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Workspace access</div>
          <div style={{ marginTop: 18, padding: 14, borderRadius: 'var(--radius-md)', background: '#F4FBF6', color: '#1B6A3A', display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, lineHeight: 1.5 }}>
            <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>You are signed in to <strong>{profile?.org_name || 'your LexAMS workspace'}</strong>.</span>
          </div>
          <div style={{ marginTop: 18, display: 'grid', gap: 10, fontSize: 13 }}>
            <div style={detailRow}><span>Workspace role</span><strong>{profile?.team_role || profile?.role || 'Workspace member'}</strong></div>
            <div style={detailRow}><span>Authentication</span><strong>Passwordless sign-in</strong></div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
            <Link to="/app/settings" style={secondaryButton}><Settings size={15} /> Organization settings</Link>
            <button onClick={signOut} style={secondaryButton}><LogOut size={15} /> Sign out</button>
          </div>
        </section>
      </div>

      {toast && <div role="status" style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-navy-900)', color: '#FFFFFF', fontSize: 13, fontWeight: 500, padding: '11px 20px', borderRadius: 999, boxShadow: 'var(--shadow-raised)', zIndex: 300 }}>{toast}</div>}
    </div>
  );
}

const detailRow = { display: 'flex', justifyContent: 'space-between', gap: 16, paddingBottom: 10, borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' };
const secondaryButton = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', color: 'var(--color-navy-800)', fontSize: 12, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' };
