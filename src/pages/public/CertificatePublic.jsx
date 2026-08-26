import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PublicExperienceLayout, { PublicCard, PublicNotice } from '../../components/PublicExperienceLayout';

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtRange(certificate) {
  if (!certificate?.start_date) return '';
  if (certificate.start_date === certificate.end_date) return fmtDate(certificate.start_date);
  const start = new Date(`${certificate.start_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const end = new Date(`${certificate.end_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${start}–${end}`;
}

const labels = {
  completion: 'Certificate of Completion',
  attendance: 'Certificate of Attendance',
  appreciation: 'Certificate of Appreciation',
};

export default function CertificatePublic() {
  const { token } = useParams();
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/public-certificate/${encodeURIComponent(token)}`)
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Certificate unavailable');
        setCertificate(body.certificate);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <PublicExperienceLayout eyebrow="Certificate" title="Loading certificate…" />;
  if (!certificate) return <PublicExperienceLayout eyebrow="Certificate" title="Certificate unavailable" narrow><PublicNotice tone="error">{error}</PublicNotice></PublicExperienceLayout>;

  const type = labels[certificate.certificate_type] || labels.completion;
  const appreciation = certificate.certificate_type === 'appreciation';

  return (
    <PublicExperienceLayout eyebrow="Verified certificate" title={type} organizationName={certificate.organization_name} organizationLogo={certificate.organization_logo}>
      <PublicCard>
        <div id="certificate-print" style={{ border: '2px solid #002B54', padding: 10, background: '#fff' }}>
          <div style={{ border: '1px solid #FAB72D', padding: '42px 34px', textAlign: 'center' }}>
            {certificate.organization_logo && <img src={certificate.organization_logo} alt="" style={{ maxHeight: 60, maxWidth: 180, objectFit: 'contain', marginBottom: 12 }} />}
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#002B54' }}>{certificate.organization_name}</div>
            <div style={{ marginTop: 14, textTransform: 'uppercase', letterSpacing: '.16em', fontSize: 11, color: '#0E4C8F' }}>{type}</div>
            <div style={{ marginTop: 28, color: '#687587', fontSize: 14 }}>{appreciation ? 'This certificate is presented to' : 'This is to certify that'}</div>
            <div style={{ display: 'inline-block', marginTop: 10, padding: '0 24px 10px', borderBottom: '1px solid #FAB72D', fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: '#002B54' }}>{certificate.participant_name}</div>
            <div style={{ marginTop: 16, color: '#687587', fontSize: 14 }}>{appreciation ? 'in appreciation for participation in' : 'has successfully completed'}</div>
            <div style={{ marginTop: 8, fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 700, color: '#002B54' }}>{certificate.activity_title}</div>
            <div style={{ marginTop: 8, color: '#687587', fontSize: 13 }}>{fmtRange(certificate)}{certificate.venue ? ` · ${certificate.venue}` : ''}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginTop: 42, alignItems: 'flex-end' }}>
              <div style={{ textAlign: 'left', minWidth: 150 }}><div style={{ borderBottom: '1px solid #687587' }} /><div style={{ marginTop: 7, color: '#002B54', fontSize: 13, fontWeight: 600 }}>{certificate.facilitator || 'Facilitator'}</div><div style={{ color: '#8793a3', fontSize: 11 }}>Facilitator</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'monospace', color: '#002B54', fontSize: 12 }}>{certificate.cert_no}</div><div style={{ marginTop: 4, color: '#8793a3', fontSize: 11 }}>Issued {fmtDate(certificate.issued_date)}</div></div>
              <div style={{ textAlign: 'right', minWidth: 150 }}><div style={{ borderBottom: '1px solid #687587' }} /><div style={{ marginTop: 7, color: '#002B54', fontSize: 13, fontWeight: 600 }}>{certificate.organization_name}</div><div style={{ color: '#8793a3', fontSize: 11 }}>Issuing Organization</div></div>
            </div>
          </div>
        </div>
        <div className="lex-public-actions" style={{ marginTop: 18 }}>
          <button className="lex-public-button secondary" onClick={() => window.print()}>Download / Print PDF</button>
        </div>
        <PublicNotice tone="success">Certificate {certificate.cert_no} is a valid LexAMS-issued record.</PublicNotice>
      </PublicCard>
    </PublicExperienceLayout>
  );
}
