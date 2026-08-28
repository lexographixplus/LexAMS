export default function CertificateSignatureGrid({ signatories = [], signatureUrlFor }) {
  if (!Array.isArray(signatories) || !signatories.length) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 26, flexWrap: 'wrap', width: '100%' }}>
      {signatories.slice(0, 4).map((signatory, index) => {
        const name = String(signatory?.name || '');
        const signatureUrl = typeof signatureUrlFor === 'function'
          ? signatureUrlFor(signatory, index)
          : signatory?.signature_url;
        const showSignature = signatory?.show_signature !== false;
        const showName = signatory?.show_name !== false;
        const showTitle = signatory?.show_title !== false;
        const showOrganization = signatory?.show_organization === true;

        return (
          <div key={`${name}-${index}`} style={{ width: 180, textAlign: 'center' }}>
            <div style={{ height: 54, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: 4 }}>
              {showSignature && signatory?.signature_mode === 'uploaded' && signatureUrl && (
                <img src={signatureUrl} alt="" style={{ maxWidth: 165, maxHeight: 52, objectFit: 'contain' }} />
              )}
              {showSignature && signatory?.signature_mode !== 'uploaded' && name && (
                <div aria-label="Typed display signature" style={{ fontFamily: 'cursive', fontSize: 22, lineHeight: 1, color: '#002B54', transform: 'rotate(-2deg)' }}>{name}</div>
              )}
            </div>
            <div style={{ borderTop: '1px solid #687587', paddingTop: 7 }}>
              {showName && <div style={{ color: '#002B54', fontSize: 13, fontWeight: 700 }}>{name}</div>}
              {showTitle && signatory?.title && <div style={{ color: '#8793A3', fontSize: 11, marginTop: 2 }}>{signatory.title}</div>}
              {showOrganization && signatory?.organization && <div style={{ color: '#8793A3', fontSize: 10, marginTop: 2 }}>{signatory.organization}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
