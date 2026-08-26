import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { fmtDate } from '../lib/format';
import CertificatePreview from '../components/CertificatePreview';
import { Eye, Mail, Send } from 'lucide-react';

export default function Certificates() {
  const { certificates, loading, getActivity, getParticipant } = useData();
  const { profile, isPro } = useAuth();
  const [previewCert, setPreviewCert] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>Loading certificates...</div>;

  const uniqueActs = new Set(certificates.map(c => c.activity_id)).size;
  const orgName = profile?.org_name || 'Organization';

  function toggle(id) {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function sendCertificates(ids) {
    if (!isPro || !ids.length) return;
    setSending(true);
    setNotice('');
    try {
      const response = await fetch('/api/communications', {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'send_certificates', certificateIds: ids }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not send certificates');
      setNotice(`${body.recipients} certificate${body.recipients === 1 ? '' : 's'} sent by email${body.skipped ? ` · ${body.skipped} skipped because no valid email was available` : ''}.`);
      setSelected(new Set());
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>Certificates</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{isPro ? 'Generate, view, download and deliver certificates to participants by email.' : 'Generate, view and download awarded certificates.'}</p>
        </div>
        {isPro && <span style={{ padding: '5px 10px', borderRadius: 999, background: '#E4F3E9', color: 'var(--color-success)', fontSize: 12, fontWeight: 800 }}>Email delivery active</span>}
      </div>

      {notice && <div style={{ marginTop: 16, padding: '11px 14px', borderRadius: 9, background: 'var(--surface-muted)', fontSize: 13 }}>{notice}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 22 }}>
        {[
          { label: 'Total issued', value: certificates.length },
          { label: 'Activities covered', value: uniqueActs },
          { label: 'Unique recipients', value: new Set(certificates.map(c => c.participant_id)).size },
        ].map(k => <div key={k.label} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '20px 22px' }}><div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>{k.label}</div><div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, marginTop: 8 }}>{k.value}</div></div>)}
      </div>

      {isPro && selected.size > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 18, padding: '12px 15px', background: '#EEF3F8', borderRadius: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{selected.size} certificate{selected.size === 1 ? '' : 's'} selected</span>
          <button onClick={() => sendCertificates([...selected])} disabled={sending} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', border: 0, borderRadius: 8, background: 'var(--color-navy-900)', color: '#fff', fontWeight: 800 }}><Send size={15}/>{sending ? 'Sending…' : 'Email selected'}</button>
        </div>
      )}

      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', marginTop: 20 }}>
        <div className="table-scroll"><div style={{minWidth: isPro ? 790 : 700}}>
        <div style={{ display: 'grid', gridTemplateColumns: isPro ? '0.35fr 1.2fr 1.4fr 1.8fr 0.8fr 0.8fr 0.75fr' : '1.2fr 1.4fr 1.8fr 0.8fr 0.8fr 0.5fr', gap: 14, padding: '12px 22px', fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600, background: 'var(--surface-muted)' }}>
          {isPro && <div>Select</div>}<div>Certificate no.</div><div>Participant</div><div>Activity</div><div>Type</div><div>Issued</div><div></div>
        </div>
        {certificates.map(c => {
          const p = getParticipant(c.participant_id);
          const a = getActivity(c.activity_id);
          return <div key={c.cert_no || c.id} style={{ display: 'grid', gridTemplateColumns: isPro ? '0.35fr 1.2fr 1.4fr 1.8fr 0.8fr 0.8fr 0.75fr' : '1.2fr 1.4fr 1.8fr 0.8fr 0.8fr 0.5fr', gap: 14, alignItems: 'center', padding: '11px 22px', borderTop: '1px solid var(--border-default)' }}>
            {isPro && <div><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.cert_no}`}/></div>}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{c.cert_no}</div>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>{p?.name}</div>{isPro && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{p?.email || 'No email'}</div>}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a?.title}</div>
            <div><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: 'var(--surface-muted)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{c.certificate_type || 'completion'}</span></div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{fmtDate(c.issued_date)}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 5 }}>
              <button onClick={() => setPreviewCert(c)} title="View & download" style={{ background: 'none', border: 'none', color: 'var(--color-navy-700)', cursor: 'pointer', padding: 4 }}><Eye size={16} /></button>
              {isPro && <button onClick={() => sendCertificates([c.id])} disabled={sending || !p?.email} title="Email certificate" style={{ background: 'none', border: 'none', color: 'var(--color-navy-700)', cursor: p?.email ? 'pointer' : 'not-allowed', opacity: p?.email ? 1 : .35, padding: 4 }}><Mail size={16}/></button>}
            </div>
          </div>;
        })}
        {certificates.length === 0 && <div style={{ padding: '36px 22px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-default)' }}>No certificates issued yet.</div>}
        </div></div>
      </div>

      {previewCert && <CertificatePreview cert={previewCert} participant={getParticipant(previewCert.participant_id)} activity={getActivity(previewCert.activity_id)} orgName={orgName} logoUrl={profile?.logo_url} onClose={() => setPreviewCert(null)} />}
    </div>
  );
}