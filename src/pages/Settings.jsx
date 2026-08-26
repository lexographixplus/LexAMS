import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Upload, X } from 'lucide-react';

export default function Settings() {
  const { profile, refreshProfile, isAdmin, isPro } = useAuth();
  const [orgName, setOrgName] = useState(profile?.org_name || '');
  const [logoUrl, setLogoUrl] = useState(profile?.logo_url || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  async function handleLogoUpload(e) {
    if (!isPro) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Please select a PNG, JPG, or WebP image');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Logo must be under 2MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.id}/logo.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true });

      if (uploadErr) {
        showToast('Upload failed: ' + uploadErr.message);
        return;
      }

      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
      const url = urlData.publicUrl + '?t=' + Date.now();
      const { error: profileError } = await supabase.from('profiles').update({ logo_url: url }).eq('id', profile.id);
      if (profileError) {
        showToast('Could not save logo: ' + profileError.message);
        return;
      }

      setLogoUrl(url);
      await refreshProfile();
      showToast('Logo uploaded');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeLogo() {
    if (!isPro) return;
    const { error } = await supabase.from('profiles').update({ logo_url: null }).eq('id', profile.id);
    if (error) {
      showToast('Could not remove logo: ' + error.message);
      return;
    }
    setLogoUrl('');
    await refreshProfile();
    showToast('Logo removed');
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        org_name: orgName.trim(),
      }).eq('id', profile.id);
      if (error) {
        showToast('Error: ' + error.message);
        return;
      }
      await refreshProfile();
      showToast('Settings saved');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', fontSize: 16, color: 'var(--text-primary)',
    border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-card)', outline: 'none',
  };

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>Settings</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
        Manage workspace details{isPro ? ' and branding' : ''}. Personal account details live under My account.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: isPro ? '1fr 1fr' : 'minmax(0, 620px)', gap: 24, marginTop: 24 }}>
        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '24px 28px',
        }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Organization details</div>
          <form onSubmit={saveProfile} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Organization name</label>
              <input value={orgName} onChange={e => setOrgName(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={saving} style={{
                padding: '10px 24px', fontSize: 14, fontWeight: 600,
                background: 'var(--color-navy-900)', color: '#FFFFFF',
                border: 'none', borderRadius: 'var(--radius-md)',
                opacity: saving ? 0.7 : 1, cursor: 'pointer',
              }}>{saving ? 'Saving...' : 'Save changes'}</button>
            </div>
          </form>
        </div>

        {isPro && (
          <div style={{
            background: 'var(--surface-card)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '24px 28px',
          }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Organization logo</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
              This logo appears on certificates and branded Pro communications. Use a PNG, JPG, or WebP image under 2MB.
            </p>

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              {logoUrl ? (
                <div style={{ position: 'relative' }}>
                  <img src={logoUrl} alt="Organization logo" style={{ maxWidth: 200, maxHeight: 120, objectFit: 'contain', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 12, background: '#FFFFFF' }} />
                  <button onClick={removeLogo} title="Remove logo" style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 999, background: 'var(--color-danger)', color: '#FFFFFF', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12 }}><X size={14} /></button>
                </div>
              ) : (
                <div style={{ width: 200, height: 120, borderRadius: 'var(--radius-md)', border: '2px dashed var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No logo uploaded</div>
              )}

              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoUpload} style={{ display: 'none' }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, background: 'transparent', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--color-navy-700)', cursor: 'pointer', opacity: uploading ? 0.7 : 1 }}>
                <Upload size={16} />
                {uploading ? 'Uploading...' : logoUrl ? 'Replace logo' : 'Upload logo'}
              </button>
            </div>

            {logoUrl && (
              <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-muted)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Your organization logo will be used on generated certificates and branded communications.
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-navy-900)', color: '#FFFFFF', fontSize: 13, fontWeight: 500, padding: '11px 20px', borderRadius: 999, boxShadow: 'var(--shadow-raised)', zIndex: 300 }}>{toast}</div>
      )}
    </div>
  );
}
