import { useEffect, useRef } from 'react';
import CertificateSignatureGrid from './CertificateSignatureGrid';
import { isRecognitionCertificate, recognitionTitle } from '../../shared/recognition.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export default function CertificatePreview({ cert, participant, activity, orgName, logoUrl, onClose, downloadEnabled = true }) {
  const certRef = useRef(null);
  const dialogRef = useRef(null);
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

  function downloadPdf() {
    if (!certRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.opener = null;

    const safeOrgName = escapeHtml(orgName || 'Organization');
    const safeParticipant = escapeHtml(participant?.name || cert.recipient_name || '');
    const safeMainTitle = escapeHtml(mainTitle);
    const safeContextLine = escapeHtml(contextLine);
    const safeVenue = escapeHtml(activity?.venue || metadata.activity_venue || '');
    const safeFacilitator = escapeHtml(activity?.facilitator || metadata.activity_facilitator || '');
    const safeCertNo = escapeHtml(cert.cert_no || '');
    const safeCertType = escapeHtml(certificateLabel);
    const safeDate = escapeHtml(fmtDate(cert.issued_date));
    const safeRange = escapeHtml(fmtRange(activity || (metadata.activity_start_date ? {
      start_date: metadata.activity_start_date,
      end_date: metadata.activity_end_date || metadata.activity_start_date,
    } : null)));
    const safeLogo = logoUrl ? escapeHtml(logoUrl) : '';
    const safeTitle = `${safeCertNo} - ${safeParticipant || 'Certificate'}`;

    const signatureHtml = signatories.length
      ? `<div class="signature-grid">${signatories.map((signatory, index) => {
          const name = escapeHtml(signatory?.name || '');
          const title = escapeHtml(signatory?.title || '');
          const organization = escapeHtml(signatory?.organization || '');
          const uploadedUrl = signatory?.signature_mode === 'uploaded' && signatory?.signature_key && cert?.access_token
            ? escapeHtml(signatureUrl(signatory, index))
            : '';
          const signatureMark = signatory?.show_signature === false
            ? ''
            : uploadedUrl
              ? `<img src="${uploadedUrl}" class="signature-img" alt="" />`
              : `<div class="typed-signature">${name}</div>`;
          return `<div class="signature-block"><div class="signature-mark">${signatureMark}</div><div class="signature-line"></div>${signatory?.show_name === false ? '' : `<div class="signature-name">${name}</div>`}${signatory?.show_title === false || !title ? '' : `<div class="signature-role">${title}</div>`}${signatory?.show_organization === true && organization ? `<div class="signature-org">${organization}</div>` : ''}</div>`;
        }).join('')}</div><div class="certificate-meta"><div class="cert-no">${safeCertNo}</div><div class="cert-date">Issued ${safeDate}</div></div>`
      : `<div class="footer"><div style="text-align:left"><div class="sig-line"></div><div class="sig-name">${safeFacilitator}</div><div class="sig-role">Facilitator</div></div><div style="text-align:center"><div class="cert-no">${safeCertNo}</div><div class="cert-date">Issued ${safeDate}</div></div><div style="text-align:right"><div class="sig-line" style="margin-left:auto"></div><div class="sig-name">${safeOrgName}</div><div class="sig-role">Issuing Organization</div></div></div>`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${safeTitle}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@400;700&display=swap" rel="stylesheet">
        <style>
          @page { size: landscape A4; margin: 0; }
          body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; }
          .cert-wrapper { width: 297mm; height: 210mm; padding: 12mm; box-sizing: border-box; }
          .cert-inner { width: 100%; height: 100%; border: 2.5px solid #002B54; border-radius: 4px; padding: 10px; box-sizing: border-box; }
          .cert-content { border: 1px solid #FAB72D; width: 100%; height: 100%; padding: 38px 56px 30px; text-align: center; font-family: 'Inter', sans-serif; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; }
          .logo-img { max-height: 60px; max-width: 180px; object-fit: contain; margin-bottom: 12px; }
          .org { font-family: 'Merriweather', serif; font-size: 22px; font-weight: 700; color: #002B54; }
          .type-label { font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: #0E4C8F; margin-top: 16px; }
          .dot { color: #FAB72D; }
          .presented-to { font-size: 14px; color: #5B6B80; margin-top: 26px; }
          .name { font-family: 'Merriweather', serif; font-size: 40px; font-weight: 700; color: #002B54; margin-top: 12px; padding: 0 24px 12px; border-bottom: 1px solid #FAB72D; display: inline-block; }
          .for-label { font-size: 14px; color: #5B6B80; margin-top: 16px; }
          .activity-title { font-family: 'Merriweather', serif; font-size: 24px; font-weight: 700; color: #002B54; margin-top: 10px; }
          .details { font-size: 14px; color: #5B6B80; margin-top: 10px; }
          .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 42px; padding: 0 20px; }
          .sig-line { width: 180px; border-bottom: 1px solid #5B6B80; }
          .sig-name { font-size: 14px; font-weight: 600; color: #002B54; margin-top: 8px; }
          .sig-role, .cert-date { font-size: 12px; color: #5B6B80; }
          .cert-no { font-family: Consolas, monospace; font-size: 13px; color: #002B54; }
          .signature-grid { display: flex; justify-content: center; align-items: flex-end; gap: 28px; margin-top: 34px; }
          .signature-block { width: 180px; text-align: center; }
          .signature-mark { height: 48px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 3px; }
          .signature-img { max-width: 165px; max-height: 46px; object-fit: contain; }
          .typed-signature { font-family: cursive; font-size: 22px; line-height: 1; color: #002B54; transform: rotate(-2deg); }
          .signature-line { border-top: 1px solid #5B6B80; }
          .signature-name { font-size: 13px; font-weight: 700; color: #002B54; margin-top: 7px; }
          .signature-role { font-size: 11px; color: #5B6B80; margin-top: 2px; }
          .signature-org { font-size: 10px; color: #788699; margin-top: 2px; }
          .certificate-meta { margin-top: 16px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="cert-wrapper"><div class="cert-inner"><div class="cert-content">
          ${safeLogo ? `<img src="${safeLogo}" class="logo-img" alt="Logo" />` : ''}
          <div class="org">${safeOrgName}</div>
          <div class="type-label"><span class="dot">\u25CF</span>&nbsp;&nbsp;${safeCertType}&nbsp;&nbsp;<span class="dot">\u25CF</span></div>
          <div class="presented-to">${escapeHtml(presentedLine)}</div>
          <div class="name">${safeParticipant}</div>
          <div class="for-label">${escapeHtml(achievementLine)}</div>
          <div class="activity-title">${safeMainTitle}</div>
          <div class="details">${safeContextLine || [safeRange, safeVenue].filter(Boolean).join(' &middot; ')}</div>
          ${signatureHtml}
        </div></div></div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  }

  const activityForDisplay = activity || (metadata.activity_start_date ? {
    start_date: metadata.activity_start_date,
    end_date: metadata.activity_end_date || metadata.activity_start_date,
  } : null);

  return (
    <div onClick={onClose} role="presentation" style={{ position: 'fixed', inset: 0, background: 'rgba(0,43,84,0.45)', backdropFilter: 'blur(2px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`${certificateLabel} preview`} tabIndex={-1} onClick={e => e.stopPropagation()} style={{ maxWidth: '95vw', maxHeight: '95vh', display: 'flex', flexDirection: 'column', alignItems: 'center', outline: 'none' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {downloadEnabled && <button onClick={downloadPdf} style={{ padding: '10px 24px', fontSize: 14, fontWeight: 600, background: 'var(--color-gold-500)', color: 'var(--color-navy-900)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Download PDF</button>}
          <button onClick={onClose} style={{ padding: '10px 24px', fontSize: 14, fontWeight: 600, background: 'rgba(255,255,255,0.9)', color: 'var(--text-secondary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Close</button>
        </div>

        <div ref={certRef} style={{ background: '#FFFFFF', border: '2.5px solid var(--color-navy-900)', borderRadius: 4, boxShadow: 'var(--shadow-raised)', width: 860, maxWidth: '95vw', padding: 10 }}>
          <div style={{ border: '1px solid var(--color-gold-500)', padding: '38px 56px 30px', textAlign: 'center', fontFamily: 'var(--font-body)' }}>
            {logoUrl && <img src={logoUrl} alt="Logo" style={{ maxHeight: 60, maxWidth: 180, objectFit: 'contain', marginBottom: 12 }} />}
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-navy-900)' }}>{orgName || 'Organization'}</div>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-navy-700)', marginTop: 14 }}><span style={{ color: 'var(--color-gold-500)' }}>{'\u25CF'}</span>&nbsp;&nbsp;{certificateLabel}&nbsp;&nbsp;<span style={{ color: 'var(--color-gold-500)' }}>{'\u25CF'}</span></div>
            <div style={{ fontSize: 13, color: 'var(--color-ink-700)', marginTop: 24 }}>{presentedLine}</div>
            <div style={{ display: 'inline-block', fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 700, color: 'var(--color-navy-900)', marginTop: 10, padding: '0 24px 10px', borderBottom: '1px solid var(--color-gold-500)' }}>{participant?.name || cert.recipient_name || ''}</div>
            <div style={{ fontSize: 13, color: 'var(--color-ink-700)', marginTop: 16 }}>{achievementLine}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--color-navy-900)', marginTop: 8 }}>{mainTitle}</div>
            <div style={{ fontSize: 13, color: 'var(--color-ink-700)', marginTop: 8, maxWidth: 680, marginInline: 'auto' }}>{contextLine || [fmtRange(activityForDisplay), activity?.venue || metadata.activity_venue || ''].filter(Boolean).join(' · ')}</div>

            {signatories.length > 0 ? (
              <>
                <div style={{ marginTop: 34 }}><CertificateSignatureGrid signatories={signatories} signatureUrlFor={signatureUrl} /></div>
                <div style={{ marginTop: 16, textAlign: 'center' }}><div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-navy-900)' }}>{cert.cert_no}</div><div style={{ fontSize: 11, color: 'var(--color-ink-500)', marginTop: 4 }}>Issued {fmtDate(cert.issued_date)}</div></div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 44 }}>
                <div style={{ textAlign: 'left' }}><div style={{ width: 180, borderBottom: '1px solid var(--color-ink-500)' }} /><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-navy-900)', marginTop: 8 }}>{activity?.facilitator || metadata.activity_facilitator || ''}</div><div style={{ fontSize: 11, color: 'var(--color-ink-500)' }}>Facilitator</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-navy-900)' }}>{cert.cert_no}</div><div style={{ fontSize: 11, color: 'var(--color-ink-500)', marginTop: 4 }}>Issued {fmtDate(cert.issued_date)}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ width: 180, borderBottom: '1px solid var(--color-ink-500)', marginLeft: 'auto' }} /><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-navy-900)', marginTop: 8 }}>{orgName || ''}</div><div style={{ fontSize: 11, color: 'var(--color-ink-500)' }}>Issuing Organization</div></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
