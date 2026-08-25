import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ContactForm from '../components/ContactForm';
import {
  ArrowRight,
  Award,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Globe2,
  QrCode,
  ShieldCheck,
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
          --paper: #F6F3EC;
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
          background: rgba(251,250,247,.92);
          backdrop-filter: blur(18px);
        }
        .lexams-nav-inner { height: 70px; display: flex; align-items: center; justify-content: space-between; }
        .lexams-wordmark { font-family: var(--font-heading); color: var(--navy); font-size: 25px; font-weight: 700; letter-spacing: -.02em; }
        .lexams-nav-links { display: flex; align-items: center; gap: 28px; }
        .lexams-nav-links a { color: #536174; text-decoration: none; font-size: 13px; font-weight: 600; }
        .lexams-login { padding-left: 26px; border-left: 1px solid var(--line); }
        .lexams-primary-link { padding: 11px 18px; border-radius: 8px; background: var(--navy); color: #fff !important; }
        .lexams-hero {
          padding: 148px 0 92px;
          background: radial-gradient(circle at 86% 16%, rgba(250,183,45,.14), transparent 26%), linear-gradient(180deg,#FBFAF7 0%,#F6F3EC 100%);
          border-bottom: 1px solid var(--line);
        }
        .lexams-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: center; }
        .lexams-hero h1 {
          margin: 0; max-width: 700px; font-family: var(--font-heading); color: var(--navy);
          font-size: clamp(46px,5.1vw,72px); line-height: 1.02; letter-spacing: -.035em;
        }
        .lexams-hero h1 em { color: var(--navy-soft); font-style: normal; }
        .lexams-hero-copy { margin: 26px 0 0; max-width: 620px; color: #5F6D80; font-size: 18px; line-height: 1.75; }
        .lexams-hero-actions { display: flex; gap: 12px; margin-top: 34px; }
        .lexams-btn { display: inline-flex; align-items: center; gap: 9px; min-height: 48px; padding: 0 22px; border-radius: 9px; text-decoration: none; font-size: 14px; font-weight: 700; }
        .lexams-btn-primary { background: var(--navy); color: #fff; box-shadow: 0 10px 28px rgba(0,43,84,.18); }
        .lexams-btn-secondary { border: 1px solid #D7DDE5; color: var(--navy); background: rgba(255,255,255,.78); }
        .lexams-note { margin-top: 22px; color: #748194; font-size: 12px; line-height: 1.6; }
        .lexams-hero-visual { position: relative; }
        .lexams-hero-visual img { width: 100%; display: block; filter: drop-shadow(0 24px 40px rgba(0,43,84,.10)); }
        .lexams-trust-strip { background: #fff; border-bottom: 1px solid var(--line); }
        .lexams-trust-inner { min-height: 84px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
        .lexams-trust-label { color: #748194; font-size: 11px; text-transform: uppercase; letter-spacing: .14em; font-weight: 800; }
        .lexams-trust-items { display: flex; gap: 24px; flex-wrap: wrap; justify-content: flex-end; color: #46566B; font-size: 12px; font-weight: 600; }
        .lexams-trust-item { display: flex; align-items: center; gap: 8px; }
        .lexams-section { padding: 104px 0; }
        .lexams-section-alt { background: var(--paper); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
        .lexams-section-head { display: grid; grid-template-columns: .72fr 1.28fr; gap: 80px; align-items: end; margin-bottom: 48px; }
        .lexams-section-label { color: var(--navy-soft); font-size: 11px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; }
        .lexams-section h2 { margin: 10px 0 0; font-family: var(--font-heading); font-size: clamp(34px,4vw,51px); line-height: 1.08; letter-spacing: -.025em; color: var(--navy); }
        .lexams-section-lede { color: #667488; font-size: 16px; line-height: 1.75; max-width: 610px; margin: 0; }
        .lexams-cap-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
        .lexams-cap-card { min-height: 270px; padding: 30px; background: #fff; }
        .lexams-cap-icon { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 11px; background: #EEF3F8; color: var(--navy-soft); }
        .lexams-cap-eyebrow { margin-top: 24px; color: #8A7441; font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
        .lexams-cap-card h3 { margin: 8px 0 0; font-family: var(--font-heading); font-size: 21px; color: var(--navy); line-height: 1.3; }
        .lexams-cap-card p { margin: 12px 0 0; color: #687587; font-size: 13px; line-height: 1.7; }
        .lexams-story { display: grid; grid-template-columns: .95fr 1.05fr; gap: 72px; align-items: center; }
        .lexams-story-visual { border: 1px solid var(--line); border-radius: 22px; background: #fff; padding: 24px; box-shadow: 0 24px 60px rgba(0,43,84,.08); }
        .lexams-story-visual img { width: 100%; display: block; }
        .lexams-step-list { border-top: 1px solid #CBD2DA; }
        .lexams-step { display: grid; grid-template-columns: 54px .82fr 1.18fr; gap: 24px; padding: 25px 0; border-bottom: 1px solid #CBD2DA; }
        .lexams-step-num { font-family: var(--font-mono); color: #9A844F; font-size: 12px; padding-top: 3px; }
        .lexams-step-title { color: var(--navy); font-weight: 700; font-size: 14px; }
        .lexams-step-text { color: #687587; font-size: 13px; line-height: 1.65; }
        .lexams-principles { display: grid; grid-template-columns: repeat(3,1fr); gap: 22px; }
        .lexams-principle { border-top: 2px solid var(--gold); padding: 22px 4px 0; }
        .lexams-principle h3 { margin: 14px 0 0; color: var(--navy); font-family: var(--font-heading); font-size: 20px; }
        .lexams-principle p { margin: 10px 0 0; color: #697688; font-size: 13px; line-height: 1.75; }
        .lexams-pricing { background: #F1F5F8; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
        .lexams-pricing-grid { display: grid; grid-template-columns: 1fr 1.08fr; gap: 22px; align-items: stretch; }
        .lexams-price-card { padding: 32px; border: 1px solid var(--line); border-radius: 18px; background: #fff; }
        .lexams-price-card-pro { border: 2px solid var(--gold); box-shadow: 0 18px 44px rgba(0,43,84,.10); position: relative; }
        .lexams-price-tag { display: inline-flex; padding: 6px 10px; border-radius: 99px; background: #FFF2CF; color: #735305; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
        .lexams-price-card h3 { margin: 14px 0 0; font: 700 28px var(--font-heading); color: var(--navy); }
        .lexams-price { margin-top: 12px; color: var(--navy); font: 700 38px var(--font-heading); letter-spacing: -.035em; }
        .lexams-price small { font: 600 13px var(--font-body); color: #687587; letter-spacing: 0; }
        .lexams-price-copy { min-height: 46px; margin: 12px 0 0; color: #687587; font-size: 13px; line-height: 1.6; }
        .lexams-price-list { display: grid; gap: 11px; margin: 24px 0 28px; padding: 0; list-style: none; color: #425269; font-size: 13px; }
        .lexams-price-list li { display: flex; gap: 9px; align-items: flex-start; }
        .lexams-price-list svg { flex: 0 0 auto; color: var(--navy-soft); margin-top: 1px; }
        .lexams-price-card .lexams-btn { width: 100%; justify-content: center; }
        .lexams-institutional { margin: 26px 0 0; color: #687587; font-size: 13px; text-align: center; }
        .lexams-institutional a { color: var(--navy); font-weight: 700; }
        .lexams-cta { padding: 92px 0; background: var(--navy); color: white; }
        .lexams-cta-inner { display: flex; align-items: center; justify-content: space-between; gap: 44px; }
        .lexams-cta h2 { margin: 0; max-width: 700px; font-family: var(--font-heading); font-size: clamp(34px,4vw,50px); line-height: 1.08; }
        .lexams-footer { padding: 40px 0 30px; background: #001C37; color: rgba(255,255,255,.72); }
        .lexams-footer-top { display: flex; justify-content: space-between; gap: 36px; }
        .lexams-footer-brand { font-family: var(--font-heading); color: #fff; font-size: 24px; font-weight: 700; }
        .lexams-footer-bottom { margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,.12); font-size: 12px; display: flex; justify-content: space-between; gap: 20px; }
        @media (max-width: 900px) {
          .lexams-nav-links a[href^="#"], .lexams-login { display: none; }
          .lexams-hero-grid, .lexams-section-head, .lexams-story { grid-template-columns: 1fr; gap: 36px; }
          .lexams-cap-grid, .lexams-principles { grid-template-columns: 1fr 1fr; }
          .lexams-pricing-grid { grid-template-columns: 1fr; max-width: 620px; }
          .lexams-section-head { align-items: start; }
          .lexams-cta-inner { align-items: flex-start; flex-direction: column; }
        }
        @media (max-width: 620px) {
          .lexams-container { width: min(100% - 32px, 1180px); }
          .lexams-nav-inner { height: 64px; }
          .lexams-nav-links { gap: 10px; }
          .lexams-primary-link { padding: 9px 12px; }
          .lexams-hero { padding: 110px 0 64px; }
          .lexams-hero h1 { font-size: 40px; }
          .lexams-hero-copy { font-size: 16px; }
          .lexams-hero-actions { flex-direction: column; align-items: stretch; }
          .lexams-btn { justify-content: center; }
          .lexams-trust-inner { align-items: flex-start; flex-direction: column; padding: 22px 0; }
          .lexams-trust-items { justify-content: flex-start; }
          .lexams-section { padding: 72px 0; }
          .lexams-cap-grid, .lexams-principles { grid-template-columns: 1fr; }
          .lexams-price-card { padding: 24px; }
          .lexams-step { grid-template-columns: 38px 1fr; }
          .lexams-step-text { grid-column: 2; }
          .lexams-footer-top, .lexams-footer-bottom { flex-direction: column; }
          .lexams-contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <header className="lexams-nav">
        <div className="lexams-container lexams-nav-inner">
          <div className="lexams-wordmark">LexAMS</div>
          <nav className="lexams-nav-links">
            <a href="#capabilities">Capabilities</a>
            <a href="#workflow">Workflow</a>
            <a href="#pricing">Pricing</a>
            <a href="#contact">Contact</a>
            <a href="#principles">Why LexAMS</a>
            <Link className="lexams-login" to="/login">Log in</Link>
            <Link className="lexams-primary-link" to="/signup">Create workspace</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="lexams-hero">
          <div className="lexams-container lexams-hero-grid">
            <div>
              <h1>Plan activities. Track participation. <em>Measure outcomes.</em></h1>
              <p className="lexams-hero-copy">
                LexAMS brings programme delivery into one focused workspace, from registration and attendance to surveys, assessments, certificates and reporting.
              </p>
              <div className="lexams-hero-actions">
                <Link className="lexams-btn lexams-btn-primary" to="/signup">Create your workspace <ArrowRight size={16} /></Link>
                <Link className="lexams-btn lexams-btn-secondary" to="/login">Sign in</Link>
              </div>
              <div className="lexams-note">Designed for programme teams, training providers, NGOs and organizations that need clear participation records.</div>
            </div>
            <div className="lexams-hero-visual" aria-hidden="true">
              <img
                src="/assets/lexams-workflow-v2.svg"
                alt=""
                onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
              />
            </div>
          </div>
        </section>

        <section className="lexams-trust-strip" aria-label="Product focus">
          <div className="lexams-container lexams-trust-inner">
            <div className="lexams-trust-label">Built around real delivery work</div>
            <div className="lexams-trust-items">
              <span className="lexams-trust-item"><ShieldCheck size={15} /> Tenant-scoped workspace</span>
              <span className="lexams-trust-item"><Globe2 size={15} /> Public registration and check-in</span>
              <span className="lexams-trust-item"><FileCheck2 size={15} /> Connected outcome records</span>
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
                LexAMS is structured around the work programme teams already do. Each capability supports the same operational record instead of creating another disconnected tool or spreadsheet.
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
          <div className="lexams-container lexams-story">
            <div>
              <div className="lexams-section-label">Workflow</div>
              <h2>Follow the work from setup to evidence.</h2>
              <p className="lexams-section-lede" style={{ marginTop: 20 }}>
                The product keeps planning, participation, learning and follow-up close together so teams can see what happened and what comes next.
              </p>
              <div className="lexams-step-list" style={{ marginTop: 34 }}>
                {workflow.map(([num, title, text]) => (
                  <div className="lexams-step" key={num}>
                    <div className="lexams-step-num">{num}</div>
                    <div className="lexams-step-title">{title}</div>
                    <div className="lexams-step-text">{text}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lexams-story-visual" aria-hidden="true">
              <img
                src="/assets/lexams-outcomes-illustration.svg?v=2"
                alt=""
                onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
              />
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
                LexAMS focuses on operational clarity, controlled access, useful public workflows and records that remain connected from start to finish.
              </p>
            </div>
            <div className="lexams-principles">
              <article className="lexams-principle">
                <ShieldCheck size={20} color="#0E4C8F" />
                <h3>Clear access and ownership</h3>
                <p>Organization membership and server-side controls keep workspace data tied to the right team and role.</p>
              </article>
              <article className="lexams-principle">
                <Globe2 size={20} color="#0E4C8F" />
                <h3>Useful outside the office</h3>
                <p>Share registration, attendance, survey and assessment links without forcing participants into an internal workspace.</p>
              </article>
              <article className="lexams-principle">
                <FileCheck2 size={20} color="#0E4C8F" />
                <h3>Evidence stays connected</h3>
                <p>Participation, attendance, outcomes and certificates remain tied to the activity record that produced them.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="pricing" className="lexams-section lexams-pricing">
          <div className="lexams-container">
            <div className="lexams-section-head">
              <div>
                <div className="lexams-section-label">Free and Pro</div>
                <h2>Start with the work. Upgrade for organisational scale.</h2>
              </div>
              <p className="lexams-section-lede">Free remains useful for small programmes. Pro gives organisations the capacity, team controls and professional outputs needed for regular delivery.</p>
            </div>
            <div className="lexams-pricing-grid">
              <article className="lexams-price-card">
                <div className="lexams-price-tag" style={{ background: '#EEF3F8', color: '#34516E' }}>For individuals</div>
                <h3>Free</h3>
                <div className="lexams-price">GMD 0 <small>free to use</small></div>
                <p className="lexams-price-copy">Run a small programme yourself with essential registration, attendance and participant tools.</p>
                <ul className="lexams-price-list">
                  <li><CheckCircle2 size={16} />1 workspace and 1 primary user</li>
                  <li><CheckCircle2 size={16} />2 active activities and up to 50 participants</li>
                  <li><CheckCircle2 size={16} />Registration, check-in and basic reporting</li>
                  <li><CheckCircle2 size={16} />Limited surveys, assessments and LexAMS-branded certificates</li>
                </ul>
                <Link className="lexams-btn lexams-btn-secondary" to="/signup">Start Free <ArrowRight size={16} /></Link>
              </article>
              <article className="lexams-price-card lexams-price-card-pro">
                <div className="lexams-price-tag">Recommended for organisations</div>
                <h3>Pro</h3>
                <div className="lexams-price">GMD 1,000 <small>per month</small></div>
                <p className="lexams-price-copy"><strong>GMD 10,200/year</strong> · GMD 850/month equivalent · save 15% with annual billing.</p>
                <ul className="lexams-price-list">
                  <li><CheckCircle2 size={16} />Multiple team members, roles and approvals</li>
                  <li><CheckCircle2 size={16} />Higher programme and participant capacity</li>
                  <li><CheckCircle2 size={16} />Full surveys, assessments, timed tests and CSV export</li>
                  <li><CheckCircle2 size={16} />Professional certificates and organisation branding</li>
                </ul>
                <Link className="lexams-btn lexams-btn-primary" to="/signup?plan=pro">Choose Pro <ArrowRight size={16} /></Link>
              </article>
            </div>
            <p className="lexams-institutional">Need a larger institutional rollout or onboarding support? <a href="mailto:hello@lexographixplus.com?subject=LexAMS%20institutional%20enquiry">Talk to LexoGraphix Plus</a>.</p>
          </div>
        </section>

        <section id="contact" className="lexams-section">
          <div className="lexams-container">
            <div className="lexams-section-head">
              <div>
                <div className="lexams-section-label">Contact LexAMS</div>
                <h2>Let’s talk about your programme needs.</h2>
              </div>
              <p className="lexams-section-lede">Send an enquiry about LexAMS, implementation support or a larger institutional rollout. Our team will respond by email.</p>
            </div>
            <ContactForm />
          </div>
        </section>

        <section className="lexams-cta">
          <div className="lexams-container lexams-cta-inner">
            <h2>Bring your programme delivery into one clear workspace.</h2>
            <Link className="lexams-btn" style={{ background: '#FAB72D', color: '#002B54' }} to="/signup">Create workspace <ArrowRight size={16} /></Link>
          </div>
        </section>
      </main>

      <footer className="lexams-footer">
        <div className="lexams-container">
          <div className="lexams-footer-top">
            <div>
              <div className="lexams-footer-brand">LexAMS</div>
              <div style={{ marginTop: 8, fontSize: 13 }}>Activity management and participation records for programme teams.</div>
            </div>
            <div style={{ fontSize: 13 }}>LexAMS by LexoGraphix Plus</div>
          </div>
          <div className="lexams-footer-bottom">
            <span>© {new Date().getFullYear()} LexoGraphix Plus</span>
            <span>LexAMS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
