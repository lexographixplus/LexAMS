import { useEffect, useRef, useState } from 'react';
import CertificateSignatureGrid from './CertificateSignatureGrid';
import { isRecognitionCertificate, recognitionTitle } from '../../shared/recognition.js';
import { printCertificate } from '../lib/printCertificate.js';

const CERTIFICATE_WIDTH = 860;
const CERTIFICATE_HEIGHT = CERTIFICATE_WIDTH * 210 / 297;

function certificatePreviewScale() {
  if (typeof window === 'undefined') return 1;

  const mobile = window.innerWidth <= 720;
  const availableWidth = window.innerWidth - (mobile ? 24 : 64);
  const availableHeight = window.innerHeight - (mobile ? 104 : 96);
  return Math.min(1, availableWidth / CERTIFICATE_WIDTH, availableHeight / CERTIFICATE_HEIGHT);
}

export default function CertificatePreview({ cert, participant, activity, orgName, logoUrl, onClose, downloadEnabled = true }) {
  const dialogRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(certificatePreviewScale);
  const metadata = cert?.metadata || {};
  const signatories = Array.isArray(cert?.metadata?.signatories) ? cert.metadata.signatories.slice(0, 4) : [];
  const recognition = isRecognitionCertificate(cert);

  useEffect(() => {
    dialogRef.current?.focus();
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    function resizePreview() {
      setPreviewScale(certificatePreviewScale());
    }

    window.addEventListener('resize', resizePreview);
    return () => window.removeEventListener('resize', resizePreview);
  }, []);

  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function fmtRange(a) {
    if (!a) return '';
    const s = new Date(a.start_date + 'T00:00:00');
    const e = new Date(a.end_date + 'T00:00:00');
    if (a.start_date === a.end_date) return fmtDate(a.start_date);
    return s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '\u2013' + e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const certTypeLabel = {
    completion: 'Certificate of Completion',
    attendance: 'Certificate of Attendance',
    appreciation: 'Certificate of Appreciation',
  };
  const certificateLabel = recognition ? 'Certificate of Recognition' : (certTypeLabel[cert.certificate_type] || 'Certificate of Completion');
  const presentedLine = recognition || cert.certificate_type === 'appreciation' ? 'This certificate is proudly presented to' : 'This is to certify that';
  const achievementLine = recognition ? 'is hereby recognized with' : cert.certificate_type === 'appreciation' ? 'in appreciation for participation in' : 'has successfully completed';
  const mainTitle = recognition ? recognitionTitle(cert) : (activity?.title || metadata.activity_title || '');
  const contextLine = recognition
    ? [cert.citation, activity?.title || metadata.activity_title, cert.award_period].filter(Boolean).join(' · ')
    : [fmtRange(activity || (metadata.activity_start_date ? { start_date: metadata.activity_start_date, end_date: metadata.activity_end_date || metadata.activity_start_date } : null)), activity?.venue || metadata.activity_venue].filter(Boolean).join(' · ');

  function signatureUrl(_signatory, index) {
    if (!cert?.access_token) return '';
    return `/api/public-certificate-signature/${encodeURIComponent(cert.access_token)}/${index}`;
  }

  const activityForDisplay = activity || (metadata.activity_start_date ? {
    start_date: metadata.activity_start_date,
    end_date: metadata.activity_end_date || metadata.activity_start_date,
  } : null);

  return (
    <div className="certificate-preview-backdrop" onClick={onClose} role="presentation" style={{ position: 'fixed', inset: 0, background: 'rgba(0,43,84,0.45)', backdropFilter: 'blur(2px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div className="certificate-preview-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-label={`${certificateLabel} preview`} tabIndex={-1} onClick={e => e.stopPropagation()} style={{ maxWidth: '95vw', maxHeight: '95vh', display: 'flex', flexDirection: 'column', alignItems: 'center', outline: 'none' }}>
        <div className="certificate-preview-actions" style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {downloadEnabled && <button type="button" onClick={() => printCertificate(`${cert.cert_no || 'Certificate'} - ${participant?.name || cert.recipient_name || 'Recipient'}`)} style={{ padding: '10px 24px', fontSize: 14, fontWeight: 600, background: 'var(--color-gold-500)', color: 'var(--color-navy-900)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Print / Save PDF</button>}
          <button onClick={onClose} style={{ padding: '10px 24px', fontSize: 14, fontWeight: 600, background: 'rgba(255,255,255,0.9)', color: 'var(--text-secondary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Close</button>
        </div>

        <div className="certificate-preview-stage certificate-print-target" style={{ width: CERTIFICATE_WIDTH * previewScale, height: CERTIFICATE_HEIGHT * previewScale }}>
          <div className="certificate-preview-sheet" style={{ background: '#FFFFFF', border: '2.5px solid var(--color-navy-900)', borderRadius: 4, boxShadow: 'var(--shadow-raised)', width: CERTIFICATE_WIDTH, height: CERTIFICATE_HEIGHT, maxWidth: 'none', padding: 10, transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
            <div className="certificate-preview-content" style={{ border: '1px solid var(--color-gold-500)', height: '100%', padding: '38px 56px 30px', textAlign: 'center', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {logoUrl && <img src={logoUrl} alt="Logo" style={{ maxHeight: 60, maxWidth: 180, objectFit: 'contain', marginBottom: 12 }} />}
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-navy-900)' }}>{orgName || 'Organization'}</div>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-navy-700)', marginTop: 14 }}><span style={{ color: 'var(--color-gold-500)' }}>{'\u25CF'}</span>&nbsp;&nbsp;{certificateLabel}&nbsp;&nbsp;<span style={{ color: 'var(--color-gold-500)' }}>{'\u25CF'}</span></div>
            <div style={{ fontSize: 13, color: 'var(--color-ink-700)', marginTop: 24 }}>{presentedLine}</div>
            <div className="certificate-preview-recipient" style={{ display: 'inline-block', fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 700, color: 'var(--color-navy-900)', marginTop: 10, padding: '0 24px 10px', borderBottom: '1px solid var(--color-gold-500)' }}>{participant?.name || cert.recipient_name || ''}</div>
            <div style={{ fontSize: 13, color: 'var(--color-ink-700)', marginTop: 16 }}>{achievementLine}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--color-navy-900)', marginTop: 8 }}>{mainTitle}</div>
            <div style={{ fontSize: 13, color: 'var(--color-ink-700)', marginTop: 8, maxWidth: 680, marginInline: 'auto' }}>{contextLine || [fmtRange(activityForDisplay), activity?.venue || metadata.activity_venue || ''].filter(Boolean).join(' · ')}</div>

            {signatories.length > 0 ? (
              <>
                <div style={{ width: '100%', marginTop: 34 }}><CertificateSignatureGrid signatories={signatories} signatureUrlFor={signatureUrl} /></div>
                <div style={{ marginTop: 16, textAlign: 'center' }}><div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-navy-900)' }}>{cert.cert_no}</div><div style={{ fontSize: 11, color: 'var(--color-ink-500)', marginTop: 4 }}>Issued {fmtDate(cert.issued_date)}</div></div>
              </>
            ) : (
              <div className="certificate-preview-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', marginTop: 44 }}>
                <div className="certificate-preview-signature" style={{ textAlign: 'left' }}><div className="certificate-preview-signature-line" style={{ width: 180, borderBottom: '1px solid var(--color-ink-500)' }} /><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-navy-900)', marginTop: 8 }}>{activity?.facilitator || metadata.activity_facilitator || ''}</div><div style={{ fontSize: 11, color: 'var(--color-ink-500)' }}>Facilitator</div></div>
                <div className="certificate-preview-meta" style={{ textAlign: 'center' }}><div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-navy-900)' }}>{cert.cert_no}</div><div style={{ fontSize: 11, color: 'var(--color-ink-500)', marginTop: 4 }}>Issued {fmtDate(cert.issued_date)}</div></div>
                <div className="certificate-preview-signature" style={{ textAlign: 'right' }}><div className="certificate-preview-signature-line" style={{ width: 180, borderBottom: '1px solid var(--color-ink-500)', marginLeft: 'auto' }} /><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-navy-900)', marginTop: 8 }}>{orgName || ''}</div><div style={{ fontSize: 11, color: 'var(--color-ink-500)' }}>Issuing Organization</div></div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
