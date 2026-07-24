import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { fmtDate } from '../lib/format';
import CertificatePreview from '../components/CertificatePreview';
import { Eye } from 'lucide-react';

export default function Certificates() {
  const { certificates, loading, getActivity, getParticipant } = useData();
  const { profile } = useAuth();
  const [previewCert, setPreviewCert] = useState(null);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
        Loading certificates...
      </div>
    );
  }

  const uniqueActs = new Set(certificates.map(c => c.activity_id)).size;
  const orgName = profile?.org_name || 'Organization';

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>Certificates</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
        Registry of issued certificates. Click to preview and download as PDF.
      </p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 22 }}>
        {[
          { label: 'Total issued', value: certificates.length },
          { label: 'Activities covered', value: uniqueActs },
          { label: 'Unique recipients', value: new Set(certificates.map(c => c.participant_id)).size },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--surface-card)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '20px 22px',
          }}>
            <div style={{
              fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--text-tertiary)', fontWeight: 600,
            }}>{k.label}</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, marginTop: 8,
            }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--surface-card)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
        overflow: 'hidden', marginTop: 20,
      }}>
        <div className="table-scroll"><div style={{minWidth: 700}}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1.8fr 0.8fr 0.8fr 0.5fr',
          gap: 14, padding: '12px 22px', fontSize: 11, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600,
          background: 'var(--surface-muted)',
        }}>
          <div>Certificate no.</div><div>Participant</div><div>Activity</div><div>Type</div><div>Issued</div><div></div>
        </div>
        {certificates.map(c => {
          const p = getParticipant(c.participant_id);
          const a = getActivity(c.activity_id);
          return (
            <div key={c.cert_no || c.id} style={{
              display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1.8fr 0.8fr 0.8fr 0.5fr',
              gap: 14, alignItems: 'center', padding: '11px 22px',
              borderTop: '1px solid var(--border-default)',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{c.cert_no}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p?.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a?.title}</div>
              <div>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                  background: 'var(--surface-muted)', color: 'var(--text-secondary)',
                  textTransform: 'capitalize',
                }}>{c.certificate_type || 'completion'}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{fmtDate(c.issued_date)}</div>
              <div style={{ textAlign: 'right' }}>
                <button onClick={() => setPreviewCert(c)} title="View & download" style={{
                  background: 'none', border: 'none', color: 'var(--color-navy-700)',
                  cursor: 'pointer', padding: 4,
                }}><Eye size={16} /></button>
              </div>
            </div>
          );
        })}
        {certificates.length === 0 && (
          <div style={{
            padding: '36px 22px', textAlign: 'center', fontSize: 13,
            color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-default)',
          }}>No certificates issued yet.</div>
        )}
        </div></div>
      </div>

      {/* Certificate preview overlay */}
      {previewCert && (
        <CertificatePreview
          cert={previewCert}
          participant={getParticipant(previewCert.participant_id)}
          activity={getActivity(previewCert.activity_id)}
          orgName={orgName}
          logoUrl={profile?.logo_url}
          onClose={() => setPreviewCert(null)}
        />
      )}
    </div>
  );
}
