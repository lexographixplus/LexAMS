import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PublicExperienceLayout, { PublicCard, PublicNotice } from '../../components/PublicExperienceLayout';
import CertificateSignatureGrid from '../../components/CertificateSignatureGrid';
import { isRecognitionCertificate } from '../../../shared/recognition.js';

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtRange(certificate) {
  if (!certificate?.start_date) return '';
  const startDate = String(certificate.start_date).slice(0, 10);
  const endDate = String(certificate.end_date || certificate.start_date).slice(0, 10);
  if (startDate === endDate) return fmtDate(startDate);
  const start = new Date(`${startDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const end = new Date(`${endDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${start}–${end}`;
}

const labels = {
  completion: 'Certificate of Completion',
  attendance: 'Certificate of Attendance',
  appreciation: 'Certificate of Appreciation',
  recognition: 'Certificate of Recognition',
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

  const isAward = isRecognitionCertificate(certificate);
  const type = isAward ? (certificate.award_title || labels.recognition) : (labels[certificate.certificate_type] || labels.completion);
  const appreciation = certificate.certificate_type === 'appreciation';
  const inactive = certificate.status && certificate.status !== 'active';
  const activityLine = [certificate.activity_title, certificate.award_period].filter(Boolean).join(' · ');
  const detailsLine = [fmtRange(certificate), certificate.venue].filter(Boolean).join(' · ');
  const signatories = Array.isArray(certificate.signatories) ? certificate.signatories : [];

  return (
    <PublicExperienceLayout eyebrow={isAward ? 'Verified recognition' : 'Verified certificate'} title={type} organizationName={certificate.organization_name} organizationLogo={certificate.organization_logo}>
      <PublicCard>
        {inactive && <PublicNotice tone="error">This certificate is {certificate.status}. {certificate.revoke_reason || 'It is retained here only as part of the issuance audit trail.'}</PublicNotice>}
        <div id="certificate-print" style={{ border: '2px solid #002B54', padding: 10, background: '#fff', position: 'relative', opacity: inactive ? .72 : 1 }}>
          {inactive && <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none', zIndex: 3 }}><div style={{ transform: 'rotate(-24deg)', fontSize: 56, fontWeight: 900, letterSpacing: '.12em', color: 'rgba(155,44,44,.18)', textTransform: 'uppercase' }}>{certificate.status}</div></div>}
          <div style={{ border: '1px solid #FAB72D', padding: '42px 34px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            {certificate.organization_logo && <img src={certificate.organization_logo} alt="" style={{ maxHeight: 60, maxWidth: 180, objectFit: 'contain', marginBottom: 12 }} />}
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#002B54' }}>{certificate.organization_name}</div>
            <div style={{ marginTop: 14, textTransform: 'uppercase', letterSpacing: '.16em', fontSize: 11, color: '#0E4C8F' }}>{isAward ? (certificate.award_category || 'Certificate of Recognition') : type}</div>
            {isAward && <div style={{ marginTop: 12, fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: '#002B54' }}>{type}</div>}
            <div style={{ marginTop: isAward ? 20 : 28, color: '#687587', fontSize: 14 }}>{isAward || appreciation ? 'This certificate is proudly presented to' : 'This is to certify that'}</div>
            <div style={{ display: 'inline-block', marginTop: 10, padding: '0 24px 10px', borderBottom: '1px solid #FAB72D', fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: '#002B54' }}>{certificate.participant_name}</div>

            {isAward ? (
              <>
                <div style={{ maxWidth: 670, margin: '18px auto 0', color: '#687587', fontSize: 14, lineHeight: 1.65 }}>{certificate.citation || 'In recognition of outstanding achievement, participation and commitment.'}</div>
                {activityLine && <div style={{ marginTop: 13, fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#002B54' }}>{activityLine}</div>}
                {detailsLine && <div style={{ marginTop: 7, color: '#687587', fontSize: 13 }}>{detailsLine}</div>}
              </>
            ) : (
              <>
                <div style={{ marginTop: 16, color: '#687587', fontSize: 14 }}>{appreciation ? 'in appreciation for participation in' : 'has successfully completed'}</div>
                <div style={{ marginTop: 8, fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 700, color: '#002B54' }}>{certificate.activity_title}</div>
                <div style={{ marginTop: 8, color: '#687587', fontSize: 13 }}>{detailsLine}</div>
              </>
            )}

            {signatories.length > 0 ? (
              <>
                <div style={{ marginTop: 38 }}><CertificateSignatureGrid signatories={signatories} /></div>
                <div style={{ marginTop: 16, textAlign: 'center' }}><div style={{ fontFamily: 'monospace', color: '#002B54', fontSize: 12 }}>{certificate.cert_no}</div><div style={{ marginTop: 4, color: '#8793a3', fontSize: 11 }}>Issued {fmtDate(certificate.issued_date)}</div></div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginTop: 42, alignItems: 'flex-end' }}>
                <div style={{ textAlign: 'left', minWidth: 150 }}><div style={{ borderBottom: '1px solid #687587' }} /><div style={{ marginTop: 7, color: '#002B54', fontSize: 13, fontWeight: 600 }}>{certificate.facilitator || certificate.organization_name}</div><div style={{ color: '#8793a3', fontSize: 11 }}>{certificate.facilitator ? 'Facilitator' : 'Authorized Signatory'}</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'monospace', color: '#002B54', fontSize: 12 }}>{certificate.cert_no}</div><div style={{ marginTop: 4, color: '#8793a3', fontSize: 11 }}>Issued {fmtDate(certificate.issued_date)}</div></div>
                <div style={{ textAlign: 'right', minWidth: 150 }}><div style={{ borderBottom: '1px solid #687587' }} /><div style={{ marginTop: 7, color: '#002B54', fontSize: 13, fontWeight: 600 }}>{certificate.organization_name}</div><div style={{ color: '#8793a3', fontSize: 11 }}>Issuing Organization</div></div>
              </div>
            )}
          </div>
        </div>
        <div className="lex-public-actions" style={{ marginTop: 18 }}>
          <button className="lex-public-button secondary" onClick={() => window.print()}>Download / Print PDF</button>
        </div>
        {inactive
          ? <PublicNotice tone="error">Certificate {certificate.cert_no} is recorded by LexAMS but is no longer valid.</PublicNotice>
          : <PublicNotice tone="success">Certificate {certificate.cert_no} is a valid LexAMS-issued record.</PublicNotice>}
      </PublicCard>
    </PublicExperienceLayout>
  );
}
