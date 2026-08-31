import { Link } from 'react-router-dom';

export function PublicCard({ children, style }) {
  return <section className="lex-public-card" style={style}>{children}</section>;
}

export function PublicNotice({ tone = 'info', children }) {
  return <div className={`lex-public-notice lex-public-notice-${tone}`} role={tone === 'error' ? 'alert' : undefined}>{children}</div>;
}

export default function PublicExperienceLayout({
  eyebrow,
  title,
  description,
  organizationName,
  organizationLogo,
  children,
  narrow = false,
}) {
  return (
    <div className="lex-public-page">
      <style>{`
        .lex-public-page{--navy:#002B54;--navy2:#0E4C8F;--gold:#FAB72D;--ink:#122033;--muted:#687587;--line:#DDE3EA;min-height:100vh;background:linear-gradient(180deg,#F8F7F2 0%,#F3F6F8 100%);color:var(--ink);font-family:var(--font-body,Inter,sans-serif);display:flex;flex-direction:column}
        .lex-public-top{background:var(--navy);color:#fff;border-bottom:4px solid var(--gold)}
        .lex-public-top-inner{width:min(980px,calc(100% - 40px));margin:auto;min-height:88px;display:flex;align-items:center;justify-content:space-between;gap:24px}
        .lex-public-brand{color:#fff;text-decoration:none;font-family:var(--font-heading,Georgia,serif);font-size:24px;font-weight:700;letter-spacing:-.02em}
        .lex-public-org{display:flex;align-items:center;gap:10px;color:rgba(255,255,255,.82);font-size:12px;font-weight:600;text-align:right}.lex-public-org img{width:34px;height:34px;border-radius:8px;object-fit:contain;background:#fff;padding:3px}
        .lex-public-main{width:min(980px,calc(100% - 40px));margin:0 auto;flex:1;padding:48px 0 72px}.lex-public-main.narrow{max-width:620px}
        .lex-public-intro{margin-bottom:24px}.lex-public-eyebrow{color:var(--navy2);text-transform:uppercase;letter-spacing:.14em;font-size:12px;font-weight:800}.lex-public-intro h1{font-family:var(--font-heading,Georgia,serif);font-size:clamp(28px,5vw,42px);line-height:1.1;letter-spacing:-.025em;color:var(--navy);margin:8px 0 0}.lex-public-intro p{max-width:700px;font-size:15px;line-height:1.7;color:var(--muted);margin:12px 0 0}
        .lex-public-card{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 18px 50px rgba(0,43,84,.07);padding:28px}
        .lex-public-card+.lex-public-card{margin-top:16px}.lex-public-card h2,.lex-public-card h3{font-family:var(--font-heading,Georgia,serif);color:var(--navy);margin-top:0}
        .lex-public-input,.lex-public-select,.lex-public-textarea{width:100%;box-sizing:border-box;padding:12px 14px;font-size:16px;color:var(--ink);border:1.5px solid var(--line);border-radius:9px;background:#fff;outline:none;transition:.15s}.lex-public-input:focus,.lex-public-select:focus,.lex-public-textarea:focus{border-color:var(--navy2);box-shadow:0 0 0 3px rgba(14,76,143,.12)}
        .lex-public-label{display:block;font-size:13px;font-weight:700;color:var(--navy);margin-bottom:6px}.lex-public-fields{display:grid;gap:14px}.lex-public-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .lex-public-button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 20px;border-radius:9px;border:0;background:var(--gold);color:var(--navy);font-weight:800;font-size:14px;cursor:pointer;text-decoration:none}.lex-public-button.secondary{background:var(--navy);color:#fff}.lex-public-button.ghost{background:#fff;border:1px solid var(--line);color:var(--navy)}.lex-public-button:disabled{opacity:.6;cursor:not-allowed}
        .lex-public-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px;flex-wrap:wrap}
        .lex-public-notice{padding:12px 14px;border-radius:9px;font-size:13px;line-height:1.55;margin-top:14px}.lex-public-notice-error{background:#FBEAEA;color:#A42C27}.lex-public-notice-success{background:#EAF6EE;color:#24633D}.lex-public-notice-info{background:#EEF3F8;color:#31516F}
        .lex-public-progress{height:7px;border-radius:99px;background:#E7ECF1;overflow:hidden}.lex-public-progress span{display:block;height:100%;background:var(--gold)}
        .lex-public-footer{border-top:1px solid var(--line);padding:20px;color:#616C7D;text-align:center;font-size:12px;background:#fff}.lex-public-footer a{color:var(--navy2);text-decoration:none;font-weight:700}
        @media(max-width:640px){.lex-public-top-inner{min-height:72px}.lex-public-org{display:none}.lex-public-main{padding:32px 0 56px}.lex-public-card{padding:22px 18px;border-radius:13px}.lex-public-grid2{grid-template-columns:1fr}.lex-public-actions{flex-direction:column}.lex-public-button{width:100%}}
      `}</style>
      <header className="lex-public-top">
        <div className="lex-public-top-inner">
          <Link to="/" className="lex-public-brand">LexAMS</Link>
          {organizationName && <div className="lex-public-org">{organizationLogo && <img src={organizationLogo} alt="" />}<span>{organizationName}</span></div>}
        </div>
      </header>
      <main className={`lex-public-main ${narrow ? 'narrow' : ''}`}>
        {(eyebrow || title || description) && <div className="lex-public-intro">
          {eyebrow && <div className="lex-public-eyebrow">{eyebrow}</div>}
          {title && <h1>{title}</h1>}
          {description && <p>{description}</p>}
        </div>}
        {children}
      </main>
      <footer className="lex-public-footer">Powered by <Link to="/">LexAMS</Link> · A LexoGraphix Plus product</footer>
    </div>
  );
}
