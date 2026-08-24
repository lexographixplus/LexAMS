import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Globe2,
  Layers3,
  QrCode,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

const capabilities = [
  {
    icon: CalendarRange,
    eyebrow: 'Plan',
    title: 'Run activities with structure',
    text: 'Create programmes, trainings, workshops and events with dates, venues, facilitators, registration controls and clear ownership.',
  },
  {
    icon: Users,
    eyebrow: 'People',
    title: 'Keep participation in one place',
    text: 'Manage participant profiles, registrations and activity assignments without rebuilding the same records for every programme.',
  },
  {
    icon: QrCode,
    eyebrow: 'Attendance',
    title: 'Make check-in simple',
    text: 'Use shareable registration and attendance links so field teams can record participation without complicated setup.',
  },
  {
    icon: ClipboardCheck,
    eyebrow: 'Learning',
    title: 'Measure more than attendance',
    text: 'Collect survey feedback and assessment results alongside activity records so outcomes stay connected to delivery.',
  },
  {
    icon: Award,
    eyebrow: 'Recognition',
    title: 'Issue branded certificates',
    text: 'Generate completion, attendance and appreciation certificates using your organization name, logo and activity details.',
  },
  {
    icon: BarChart3,
    eyebrow: 'Reporting',
    title: 'Turn delivery into evidence',
    text: 'Bring programme activity, participation and outcome records together for clearer reporting and operational review.',
  },
];

const workflow = [
  ['01', 'Set up the activity', 'Define the programme, schedule, venue, facilitator and registration settings.'],
  ['02', 'Register participants', 'Use public registration links or add participants directly from the workspace.'],
  ['03', 'Track delivery', 'Record attendance, manage participant activity and capture operational updates.'],
  ['04', 'Measure outcomes', 'Run surveys and assessments connected to the activity.'],
  ['05', 'Close the loop', 'Issue certificates and use the resulting records for reporting and follow-up.'],
];

export default function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to="/app" replace />;

  return (
    <div className="lexams-site">
      <style>{`
        .lexams-site {
          --navy: #002B54;
          --navy-deep: #001C37;
          --navy-soft: #0E4C8F;
          --gold: #FAB72D;
          --paper: #F7F5EF;
          --paper-2: #FBFAF7;
          --ink: #122033;
          --muted: #647184;
          --line: #DDE2E8;
          min-height: 100vh;
          background: var(--paper-2);
          color: var(--ink);
          font-family: var(--font-body);
        }
        .lexams-site * { box-sizing: border-box; }
        .lexams-container { width: min(1180px, calc(100% - 48px)); margin: 0 auto; }
        .lexams-nav {
          position: fixed; inset: 0 0 auto 0; z-index: 50;
          border-bottom: 1px solid rgba(221,226,232,.72);
          background: rgba(251,250,247,.9);
          backdrop-filter: blur(18px);
        }
        .lexams-nav-inner { height: 70px; display: flex; align-items: center; justify-content: space-between; }
        .lexams-wordmark { font-family: var(--font-heading); color: var(--navy); font-size: 25px; font-weight: 700; letter-spacing: -.02em; }
        .lexams-nav-links { display: flex; align-items: center; gap: 28px; }
        .lexams-nav-links a { color: #536174; text-decoration: none; font-size: 13px; font-weight: 600; }
        .lexams-nav-links a:hover { color: var(--navy); }
        .lexams-login { padding-left: 26px; border-left: 1px solid var(--line); }
        .lexams-primary-link {
          display: inline-flex; align-items: center; justify-content: center; gap: 9px;
          padding: 11px 18px; border-radius: 8px; background: var(--navy); color: #fff !important;
          box-shadow: 0 8px 22px rgba(0,43,84,.14);
        }
        .lexams-primary-link:hover { background: var(--navy-deep); }
        .lexams-hero {
          padding: 148px 0 84px;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at 88% 18%, rgba(250,183,45,.13), transparent 24%),
            linear-gradient(180deg, #FBFAF7 0%, #F7F5EF 100%);
        }
        .lexams-hero:after {
          content: ''; position: absolute; inset: auto 0 0 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,43,84,.15), transparent);
        }
        .lexams-hero-grid { display: grid; grid-template-columns: 1.02fr .98fr; gap: 72px; align-items: center; }
        .lexams-kicker {
          display: inline-flex; align-items: center; gap: 8px; color: var(--navy-soft);
          font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
        }
        .lexams-kicker-line { width: 34px; height: 2px; background: var(--gold); }
        .lexams-hero h1 {
          margin: 22px 0 0; max-width: 700px; font-family: var(--font-heading); color: var(--navy);
          font-size: clamp(46px, 5.2vw, 72px); line-height: 1.02; letter-spacing: -.035em;
        }
        .lexams-hero h1 em { color: var(--navy-soft); font-style: normal; }
        .lexams-hero-copy { margin: 26px 0 0; max-width: 620px; color: #5F6D80; font-size: 18px; line-height: 1.75; }
        .lexams-hero-actions { display: flex; gap: 12px; margin-top: 34px; }
        .lexams-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 48px;
          padding: 0 22px; border-radius: 9px; text-decoration: none; font-size: 14px; font-weight: 700;
        }
        .lexams-btn-primary { background: var(--navy); color: white; box-shadow: 0 10px 28px rgba(0,43,84,.18); }
        .lexams-btn-primary:hover { background: var(--navy-deep); }
        .lexams-btn-secondary { border: 1px solid #D7DDE5; color: var(--navy); background: rgba(255,255,255,.68); }
        .lexams-note { margin-top: 24px; color: #748194; font-size: 12px; line-height: 1.6; }
        .lexams-product-frame {
          position: relative; border: 1px solid rgba(0,43,84,.16); border-radius: 20px;
          background: #fff; box-shadow: 0 32px 80px rgba(0,43,84,.13); overflow: hidden;
          transform: rotate(.5deg);
        }
        .lexams-frame-top { height: 46px; background: var(--navy); display: flex; align-items: center; padding: 0 16px; gap: 7px; }
        .lexams-frame-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.34); }
        .lexams-frame-title { margin-left: 8px; font-size: 10px; color: rgba(255,255,255,.62); letter-spacing: .06em; text-transform: uppercase; }
        .lexams-frame-body { display: grid; grid-template-columns: 118px 1fr; min-height: 420px; }
        .lexams-frame-side { background: #F5F7F9; border-right: 1px solid #E2E6EB; padding: 18px 12px; }
        .lexams-frame-brand { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 15px; margin-bottom: 22px; }
        .lexams-frame-nav { display: grid; gap: 8px; }
        .lexams-frame-nav div { height: 8px; border-radius: 6px; background: #DDE3E9; }
        .lexams-frame-nav div:first-child { width: 82%; background: rgba(14,76,143,.32); }
        .lexams-frame-main { padding: 26px; }
        .lexams-frame-heading { width: 46%; height: 14px; border-radius: 7px; background: var(--navy); opacity: .9; }
        .lexams-frame-sub { width: 66%; height: 8px; border-radius: 5px; background: #D8DEE5; margin-top: 10px; }
        .lexams-flow-board { margin-top: 30px; display: grid; gap: 12px; }
        .lexams-flow-row {
          display: grid; grid-template-columns: 34px 1fr 34px; align-items: center; gap: 13px;
          padding: 14px; border: 1px solid #E0E5EA; border-radius: 11px; background: #FCFCFB;
        }
        .lexams-flow-icon { width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; background: #EEF3F8; color: var(--navy-soft); }
        .lexams-flow-text { height: 9px; border-radius: 5px; background: #CBD4DE; width: 72%; }
        .lexams-flow-text:after { content: ''; display: block; width: 46%; height: 6px; margin-top: 8px; border-radius: 5px; background: #E2E6EA; }
        .lexams-flow-check { color: #2E7D4F; }
        .lexams-small-pill {
          position: absolute; right: -18px; bottom: 36px; display: flex; align-items: center; gap: 8px;
          padding: 10px 14px; background: #fff; border: 1px solid #E0E5EA; border-radius: 999px;
          box-shadow: 0 12px 30px rgba(0,43,84,.12); color: var(--navy); font-size: 11px; font-weight: 700;
        }
        .lexams-trust-strip { border-bottom: 1px solid var(--line); background: #fff; }
        .lexams-trust-inner { min-height: 84px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
        .lexams-trust-label { color: #748194; font-size: 12px; text-transform: uppercase; letter-spacing: .12em; font-weight: 700; }
        .lexams-trust-items { display: flex; align-items: center; gap: 26px; color: #46566B; font-size: 12px; font-weight: 600; flex-wrap: wrap; justify-content: flex-end; }
        .lexams-trust-item { display: flex; align-items: center; gap: 8px; }
        .lexams-section { padding: 104px 0; }
        .lexams-section-alt { background: var(--paper); border-top: 1px solid rgba(221,226,232,.72); border-bottom: 1px solid rgba(221,226,232,.72); }
        .lexams-section-head { display: grid; grid-template-columns: .72fr 1.28fr; gap: 80px; align-items: end; margin-bottom: 48px; }
        .lexams-section-label { color: var(--navy-soft); font-size: 11px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; }
        .lexams-section h2 { margin: 10px 0 0; font-family: var(--font-heading); font-size: clamp(34px, 4vw, 51px); line-height: 1.08; letter-spacing: -.025em; color: var(--navy); }
        .lexams-section-lede { color: #667488; font-size: 16px; line-height: 1.75; max-width: 610px; margin: 0; }
        .lexams-cap-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #DDE2E8; border: 1px solid #DDE2E8; border-radius: 16px; overflow: hidden; }
        .lexams-cap-card { min-height: 270px; padding: 30px; background: #fff; }
        .lexams-cap-icon { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 11px; background: #EEF3F8; color: var(--navy-soft); }
        .lexams-cap-eyebrow { margin-top: 24px; color: #8A7441; font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
        .lexams-cap-card h3 { margin: 8px 0 0; font-family: var(--font-heading); font-size: 21px; color: var(--navy); line-height: 1.3; }
        .lexams-cap-card p { margin: 12px 0 0; color: #687587; font-size: 13px; line-height: 1.7; }
        .lexams-workflow { display: grid; grid-template-columns: .8fr 1.2fr; gap: 84px; align-items: start; }
        .lexams-workflow-copy { position: sticky; top: 110px; }
        .lexams-workflow-copy p { color: #657386; font-size: 15px; line-height: 1.8; margin: 22px 0 0; }
        .lexams-step-list { border-top: 1px solid #CBD2DA; }
        .lexams-step { display: grid; grid-template-columns: 64px .82fr 1.18fr; gap: 24px; padding: 27px 0; border-bottom: 1px solid #CBD2DA; }
        .lexams-step-num { font-family: var(--font-mono); color: #9A844F; font-size: 12px; padding-top: 4px; }
        .lexams-step-title { color: var(--navy); font-weight: 700; font-size: 14px; }
        .lexams-step-text { color: #687587; font-size: 13px; line-height: 1.65; }
        .lexams-principles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
        .lexams-principle { border-top: 2px solid var(--gold); padding: 22px 4px 0; }
        .lexams-principle h3 { margin: 14px 0 0; color: var(--navy); font-family: var(--font-heading); font-size: 20px; }
        .lexams-principle p { margin: 10px 0 0; color: #697688; font-size: 13px; line-height: 1.75; }
        .lexams-cta { padding: 92px 0; background: var(--navy); color: white; position: relative; overflow: hidden; }
        .lexams-cta:before { content: ''; position: absolute; width: 480px; height: 480px; border-radius: 50%; right: -170px; top: -190px; background: rgba(250,183,45,.1); }
        .lexams-cta-grid { display: grid; grid-template-columns: 1.2fr .8fr; gap: 60px; align-items: end; position: relative; }
        .lexams-cta h2 { margin: 0; font-family: var(--font-heading); font-size: clamp(38px, 4vw, 54px); line-height: 1.06; letter-spacing: -.025em; }
        .lexams-cta p { color: rgba(255,255,255,.7); font-size: 15px; line-height: 1.75; margin: 18px 0 0; max-width: 660px; }
        .lexams-cta-actions { display: flex; justify-content: flex-end; gap: 10px; }
        .lexams-cta .lexams-btn-primary { background: var(--gold); color: var(--navy); box-shadow: none; }
        .lexams-cta .lexams-btn-secondary { color: white; border-color: rgba(255,255,255,.26); background: rgba(255,255,255,.06); }
        .lexams-footer { background: #001A32; color: rgba(255,255,255,.7); padding: 34px 0 28px; }
        .lexams-footer-top { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
        .lexams-footer-brand { color: white; font-family: var(--font-heading); font-size: 21px; font-weight: 700; }
        .lexams-footer-parent { margin-top: 5px; font-size: 11px; color: rgba(255,255,255,.5); letter-spacing: .04em; }
        .lexams-footer-links { display: flex; gap: 24px; }
        .lexams-footer-links a { color: rgba(255,255,255,.68); text-decoration: none; font-size: 12px; }
        .lexams-footer-bottom { margin-top: 26px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,.1); font-size: 10px; color: rgba(255,255,255,.4); }

        @media (max-width: 920px) {
          .lexams-nav-links a[href^='#'] { display: none; }
          .lexams-hero-grid, .lexams-section-head, .lexams-workflow, .lexams-cta-grid { grid-template-columns: 1fr; }
          .lexams-hero-grid { gap: 52px; }
          .lexams-product-frame { max-width: 680px; }
          .lexams-small-pill { right: 12px; }
          .lexams-section-head { gap: 18px; }
          .lexams-cap-grid { grid-template-columns: repeat(2, 1fr); }
          .lexams-workflow-copy { position: static; }
          .lexams-principles { grid-template-columns: 1fr; }
          .lexams-cta-actions { justify-content: flex-start; }
        }
        @media (max-width: 640px) {
          .lexams-container { width: min(100% - 32px, 1180px); }
          .lexams-nav-inner { height: 64px; }
          .lexams-nav-links { gap: 12px; }
          .lexams-login { border: 0; padding-left: 0; }
          .lexams-primary-link { padding: 9px 13px; font-size: 12px !important; }
          .lexams-hero { padding: 112px 0 62px; }
          .lexams-hero h1 { font-size: 42px; }
          .lexams-hero-copy { font-size: 16px; }
          .lexams-hero-actions { flex-direction: column; align-items: stretch; }
          .lexams-frame-body { grid-template-columns: 82px 1fr; min-height: 350px; }
          .lexams-frame-main { padding: 18px; }
          .lexams-trust-inner { padding: 20px 0; align-items: flex-start; flex-direction: column; }
          .lexams-trust-items { justify-content: flex-start; gap: 14px; }
          .lexams-section { padding: 72px 0; }
          .lexams-cap-grid { grid-template-columns: 1fr; }
          .lexams-cap-card { min-height: auto; }
          .lexams-step { grid-template-columns: 42px 1fr; gap: 12px; }
          .lexams-step-text { grid-column: 2; }
          .lexams-cta { padding: 72px 0; }
          .lexams-cta-actions { flex-direction: column; }
          .lexams-footer-top { align-items: flex-start; flex-direction: column; }
        }
      `}</style>

      <header className="lexams-nav">
        <div className="lexams-container lexams-nav-inner">
          <Link to="/" className="lexams-wordmark" style={{ textDecoration: 'none' }}>LexAMS</Link>
          <nav className="lexams-nav-links" aria-label="Primary navigation">
            <a href="#capabilities">Capabilities</a>
            <a href="#workflow">Workflow</a>
            <a href="#principles">Why LexAMS</a>
            <Link className="lexams-login" to="/login">Log in</Link>
            <Link className="lexams-primary-link" to="/signup">Create workspace <ArrowRight size={14} /></Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="lexams-hero">
          <div className="lexams-container lexams-hero-grid">
            <div>
              <div className="lexams-kicker"><span className="lexams-kicker-line" /> Activity management for programmes & training</div>
              <h1>Plan activities. Track participation. <em>Measure outcomes.</em></h1>
              <p className="lexams-hero-copy">
                LexAMS brings programme delivery into one focused workspace—from registration and attendance to surveys, assessments, certificates and reporting.
              </p>
              <div className="lexams-hero-actions">
                <Link className="lexams-btn lexams-btn-primary" to="/signup">Create your workspace <ArrowRight size={16} /></Link>
                <Link className="lexams-btn lexams-btn-secondary" to="/login">Sign in</Link>
              </div>
              <div className="lexams-note">Built for organizations that need reliable operational records without turning programme delivery into an IT project.</div>
            </div>

            <div style={{ position: 'relative' }} aria-label="LexAMS product workflow preview">
              <div className="lexams-product-frame">
                <div className="lexams-frame-top">
                  <span className="lexams-frame-dot" /><span className="lexams-frame-dot" /><span className="lexams-frame-dot" />
                  <span className="lexams-frame-title">Programme workspace</span>
                </div>
                <div className="lexams-frame-body">
                  <aside className="lexams-frame-side">
                    <div className="lexams-frame-brand">LexAMS</div>
                    <div className="lexams-frame-nav">
                      <div /><div /><div /><div /><div /><div />
                    </div>
                  </aside>
                  <div className="lexams-frame-main">
                    <div className="lexams-frame-heading" />
                    <div className="lexams-frame-sub" />
                    <div className="lexams-flow-board">
                      {[
                        [CalendarRange, 'Activity setup'],
                        [Users, 'Participant registration'],
                        [QrCode, 'Attendance'],
                        [ClipboardCheck, 'Feedback & assessment'],
                        [Award, 'Certificates'],
                      ].map(([Icon, label]) => (
                        <div className="lexams-flow-row" key={label}>
                          <div className="lexams-flow-icon"><Icon size={16} /></div>
                          <div className="lexams-flow-text" aria-label={label} />
                          <CheckCircle2 className="lexams-flow-check" size={17} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="lexams-small-pill"><Sparkles size={13} color="#E29F1E" /> One connected programme record</div>
            </div>
          </div>
        </section>

        <section className="lexams-trust-strip" aria-label="Product focus">
          <div className="lexams-container lexams-trust-inner">
            <div className="lexams-trust-label">Designed around real programme operations</div>
            <div className="lexams-trust-items">
              <span className="lexams-trust-item"><Activity size={14} /> Activities</span>
              <span className="lexams-trust-item"><Users size={14} /> Participation</span>
              <span className="lexams-trust-item"><ClipboardCheck size={14} /> Outcomes</span>
              <span className="lexams-trust-item"><FileCheck2 size={14} /> Evidence</span>
            </div>
          </div>
        </section>

        <section id="capabilities" className="lexams-section">
          <div className="lexams-container">
            <div className="lexams-section-head">
              <div>
                <div className="lexams-section-label">Core capabilities</div>
                <h2>One workspace across the activity lifecycle.</h2>
              </div>
              <p className="lexams-section-lede">
                LexAMS is structured around the work programme teams already do. Each feature supports the same operational record instead of creating another disconnected tool or spreadsheet.
              </p>
            </div>
            <div className="lexams-cap-grid">
              {capabilities.map(({ icon: Icon, eyebrow, title, text }) => (
                <article className="lexams-cap-card" key={title}>
                  <div className="lexams-cap-icon"><Icon size={20} /></div>
                  <div className="lexams-cap-eyebrow">{eyebrow}</div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="lexams-section lexams-section-alt">
          <div className="lexams-container lexams-workflow">
            <div className="lexams-workflow-copy">
              <div className="lexams-section-label">A clearer operating flow</div>
              <h2>From planning to proof, without rebuilding the record.</h2>
              <p>
                Instead of treating registration, attendance, feedback and certification as separate tasks, LexAMS keeps them tied to the same activity and organization workspace.
              </p>
            </div>
            <div className="lexams-step-list">
              {workflow.map(([number, title, text]) => (
                <div className="lexams-step" key={number}>
                  <div className="lexams-step-num">{number}</div>
                  <div className="lexams-step-title">{title}</div>
                  <div className="lexams-step-text">{text}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="principles" className="lexams-section">
          <div className="lexams-container">
            <div className="lexams-section-head">
              <div>
                <div className="lexams-section-label">Why LexAMS</div>
                <h2>Professional enough for reporting. Simple enough for delivery teams.</h2>
              </div>
              <p className="lexams-section-lede">
                The product is being built around a few practical principles: operational clarity, controlled access, useful public workflows and records that remain connected from start to finish.
              </p>
            </div>
            <div className="lexams-principles">
              <article className="lexams-principle">
                <ShieldCheck size={20} color="#0E4C8F" />
                <h3>Organization-scoped by design</h3>
                <p>Workspace membership, permissions and operational records are separated by organization so teams work inside the right context.</p>
              </article>
              <article className="lexams-principle">
                <Globe2 size={20} color="#0E4C8F" />
                <h3>Public where it should be</h3>
                <p>Registration, check-in, surveys and assessments can be shared through focused public links without opening the management workspace.</p>
              </article>
              <article className="lexams-principle">
                <Layers3 size={20} color="#0E4C8F" />
                <h3>Connected instead of fragmented</h3>
                <p>Activities, people, attendance, outcomes and certificates stay related so programme history can be understood as one operational story.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="lexams-cta">
          <div className="lexams-container lexams-cta-grid">
            <div>
              <h2>Build a cleaner record of the work your programmes already do.</h2>
              <p>Set up a LexAMS workspace and manage the activity lifecycle from one place.</p>
            </div>
            <div className="lexams-cta-actions">
              <Link className="lexams-btn lexams-btn-primary" to="/signup">Create workspace <ArrowRight size={16} /></Link>
              <Link className="lexams-btn lexams-btn-secondary" to="/login">Sign in</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lexams-footer">
        <div className="lexams-container">
          <div className="lexams-footer-top">
            <div>
              <div className="lexams-footer-brand">LexAMS</div>
              <div className="lexams-footer-parent">LexAMS by LexoGraphix Plus</div>
            </div>
            <div className="lexams-footer-links">
              <a href="#capabilities">Capabilities</a>
              <a href="#workflow">Workflow</a>
              <Link to="/login">Log in</Link>
            </div>
          </div>
          <div className="lexams-footer-bottom">Activity management for programmes, training and participation records.</div>
        </div>
      </footer>
    </div>
  );
}
