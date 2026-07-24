import { useRef } from 'react';

export default function CertificatePreview({ cert, participant, activity, orgName, logoUrl, onClose }) {
  const certRef = useRef(null);

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

  async function downloadPdf() {
    const el = certRef.current;
    if (!el) return;

    // Use browser print to generate PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${cert.cert_no} - ${participant?.name || 'Certificate'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@400;700&display=swap" rel="stylesheet">
        <style>
          @page { size: landscape A4; margin: 0; }
          body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; }
          .cert-wrapper { width: 297mm; height: 210mm; padding: 12mm; box-sizing: border-box; }
          .cert-inner {
            width: 100%; height: 100%;
            border: 2.5px solid #002B54; border-radius: 4px; padding: 10px;
            box-sizing: border-box;
          }
          .cert-content {
            border: 1px solid #FAB72D; width: 100%; height: 100%;
            padding: 44px 56px 36px; text-align: center;
            font-family: 'Inter', sans-serif; box-sizing: border-box;
            display: flex; flex-direction: column; justify-content: center;
          }
          .logo-img { max-height: 60px; max-width: 180px; object-fit: contain; margin-bottom: 12px; }
          .org { font-family: 'Merriweather', serif; font-size: 22px; font-weight: 700; color: #002B54; }
          .type-label { font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #0E4C8F; margin-top: 16px; }
          .dot { color: #FAB72D; }
          .presented-to { font-size: 14px; color: #5B6B80; margin-top: 32px; }
          .name { font-family: 'Merriweather', serif; font-size: 40px; font-weight: 700; color: #002B54; margin-top: 12px;
                   padding: 0 24px 12px; border-bottom: 1px solid #FAB72D; display: inline-block; }
          .for-label { font-size: 14px; color: #5B6B80; margin-top: 18px; }
          .activity-title { font-family: 'Merriweather', serif; font-size: 24px; font-weight: 700; color: #002B54; margin-top: 10px; }
          .details { font-size: 14px; color: #5B6B80; margin-top: 10px; }
          .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 48px; padding: 0 20px; }
          .sig-line { width: 180px; border-bottom: 1px solid #5B6B80; }
          .sig-name { font-size: 14px; font-weight: 600; color: #002B54; margin-top: 8px; }
          .sig-role { font-size: 12px; color: #5B6B80; }
          .cert-no { font-family: 'Consolas', monospace; font-size: 13px; color: #002B54; }
          .cert-date { font-size: 12px; color: #5B6B80; margin-top: 4px; }
        </style>
      </head>
      <body>
        <div class="cert-wrapper">
          <div class="cert-inner">
            <div class="cert-content">
              ${logoUrl ? `<img src="${logoUrl}" class="logo-img" alt="Logo" />` : ''}
              <div class="org">${orgName || 'Organization'}</div>
              <div class="type-label"><span class="dot">\u25CF</span>&nbsp;&nbsp;${certTypeLabel[cert.certificate_type] || 'Certificate of Completion'}&nbsp;&nbsp;<span class="dot">\u25CF</span></div>
              <div class="presented-to">${cert.certificate_type === 'appreciation' ? 'This certificate is presented to' : 'This is to certify that'}</div>
              <div class="name">${participant?.name || ''}</div>
              <div class="for-label">${cert.certificate_type === 'appreciation' ? 'in appreciation for participation in' : 'has successfully completed'}</div>
              <div class="activity-title">${activity?.title || ''}</div>
              <div class="details">${fmtRange(activity)} &middot; ${activity?.venue || ''}</div>
              <div class="footer">
                <div style="text-align:left">
                  <div class="sig-line"></div>
                  <div class="sig-name">${activity?.facilitator || ''}</div>
                  <div class="sig-role">Facilitator</div>
                </div>
                <div style="text-align:center">
                  <div class="cert-no">${cert.cert_no}</div>
                  <div class="cert-date">Issued ${fmtDate(cert.issued_date)}</div>
                </div>
                <div style="text-align:right">
                  <div class="sig-line" style="margin-left:auto"></div>
                  <div class="sig-name">${orgName || ''}</div>
                  <div class="sig-role">Issuing Organization</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,43,84,0.45)',
      backdropFilter: 'blur(2px)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32,
    }}>
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: '95vw', maxHeight: '95vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button onClick={downloadPdf} style={{
            padding: '10px 24px', fontSize: 14, fontWeight: 600,
            background: 'var(--color-gold-500)', color: 'var(--color-navy-900)',
            border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          }}>Download PDF</button>
          <button onClick={onClose} style={{
            padding: '10px 24px', fontSize: 14, fontWeight: 600,
            background: 'rgba(255,255,255,0.9)', color: 'var(--text-secondary)',
            border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          }}>Close</button>
        </div>

        {/* Certificate preview */}
        <div ref={certRef} style={{
          background: '#FFFFFF', border: '2.5px solid var(--color-navy-900)',
          borderRadius: 4, boxShadow: 'var(--shadow-raised)',
          width: 860, maxWidth: '95vw', padding: 10,
        }}>
          <div style={{
            border: '1px solid var(--color-gold-500)',
            padding: '44px 56px 36px', textAlign: 'center',
            fontFamily: 'var(--font-body)',
          }}>
            {logoUrl && (
              <img src={logoUrl} alt="Logo" style={{
                maxHeight: 60, maxWidth: 180, objectFit: 'contain', marginBottom: 12,
              }} />
            )}
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700,
              color: 'var(--color-navy-900)',
            }}>{orgName || 'Organization'}</div>

            <div style={{
              fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'var(--color-navy-700)', marginTop: 14,
            }}>
              <span style={{ color: 'var(--color-gold-500)' }}>{'\u25CF'}</span>
              &nbsp;&nbsp;{certTypeLabel[cert.certificate_type] || 'Certificate of Completion'}&nbsp;&nbsp;
              <span style={{ color: 'var(--color-gold-500)' }}>{'\u25CF'}</span>
            </div>

            <div style={{ fontSize: 13, color: 'var(--color-ink-700)', marginTop: 28 }}>
              {cert.certificate_type === 'appreciation' ? 'This certificate is presented to' : 'This is to certify that'}
            </div>

            <div style={{
              display: 'inline-block', fontFamily: 'var(--font-display)',
              fontSize: 38, fontWeight: 700, color: 'var(--color-navy-900)',
              marginTop: 10, padding: '0 24px 10px',
              borderBottom: '1px solid var(--color-gold-500)',
            }}>{participant?.name || ''}</div>

            <div style={{ fontSize: 13, color: 'var(--color-ink-700)', marginTop: 16 }}>
              {cert.certificate_type === 'appreciation' ? 'in appreciation for participation in' : 'has successfully completed'}
            </div>

            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700,
              color: 'var(--color-navy-900)', marginTop: 8,
            }}>{activity?.title || ''}</div>

            <div style={{ fontSize: 13, color: 'var(--color-ink-700)', marginTop: 8 }}>
              {fmtRange(activity)} &middot; {activity?.venue || ''}
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-end', marginTop: 44,
            }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ width: 180, borderBottom: '1px solid var(--color-ink-500)' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-navy-900)', marginTop: 8 }}>
                  {activity?.facilitator || ''}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-ink-500)' }}>Facilitator</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  color: 'var(--color-navy-900)',
                }}>{cert.cert_no}</div>
                <div style={{ fontSize: 11, color: 'var(--color-ink-500)', marginTop: 4 }}>
                  Issued {fmtDate(cert.issued_date)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ width: 180, borderBottom: '1px solid var(--color-ink-500)', marginLeft: 'auto' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-navy-900)', marginTop: 8 }}>
                  {orgName || ''}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-ink-500)' }}>Issuing Organization</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
