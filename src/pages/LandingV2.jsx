import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowRight, Award, BarChart3, CalendarRange, CheckCircle2,
  ClipboardCheck, QrCode, ShieldCheck, Users,
} from 'lucide-react';

const capabilities = [
  [CalendarRange, 'Plan', 'Activities with structure', 'Set up trainings, workshops, programmes and events with dates, venues, facilitators and registration controls.'],
  [Users, 'People', 'Reusable participant records', 'Keep participant details, registrations and activity assignments connected instead of rebuilding lists for every activity.'],
  [QrCode, 'Attendance', 'Simple public workflows', 'Share registration and check-in links that work cleanly on phones without exposing the internal workspace.'],
  [ClipboardCheck, 'Learning', 'Surveys and assessments', 'Collect feedback and learning results against the same activity record used for delivery.'],
  [Award, 'Recognition', 'Branded certificates', 'Issue completion, attendance and appreciation certificates using organization branding and activity details.'],
  [BarChart3, 'Evidence', 'Reporting-ready records', 'Bring participation, attendance and outcome information together for operational review and reporting.'],
];

const steps = [
  ['01', 'Create the activity', 'Define the programme, schedule, venue, facilitator and registration settings.'],
  ['02', 'Bring participants in', 'Use a public registration link or manage participants from the workspace.'],
  ['03', 'Track delivery', 'Record attendance and keep participation tied to the activity.'],
  ['04', 'Measure outcomes', 'Run surveys and assessments without separating evidence from delivery.'],
  ['05', 'Close the loop', 'Issue certificates and use the resulting records for follow-up and reporting.'],
];

export default function LandingV2() {
  const { user } = useAuth();
  if (user) return <Navigate to="/app" replace />;

  return (
    <div className="lx-site">
      <style>{`
        .lx-site{--navy:#002B54;--navy2:#0E4C8F;--gold:#FAB72D;--paper:#F7F5EF;--paper2:#FCFBF8;--ink:#172437;--muted:#647184;--line:#DDE2E8;min-height:100vh;background:var(--paper2);color:var(--ink);font-family:var(--font-body)}
        .lx-site *{box-sizing:border-box}.lx-wrap{width:min(1180px,calc(100% - 48px));margin:auto}.lx-nav{position:fixed;inset:0 0 auto;z-index:50;background:rgba(252,251,248,.9);backdrop-filter:blur(18px);border-bottom:1px solid rgba(221,226,232,.8)}
        .lx-navin{height:70px;display:flex;align-items:center;justify-content:space-between}.lx-brand{font-family:var(--font-heading);font-weight:700;font-size:25px;color:var(--navy);letter-spacing:-.02em}.lx-links{display:flex;align-items:center;gap:28px}.lx-links a{text-decoration:none;font-size:13px;font-weight:650;color:#556377}.lx-links a:hover{color:var(--navy)}
        .lx-navcta{padding:10px 17px;border-radius:9px;background:var(--navy);color:#fff!important;box-shadow:0 8px 22px rgba(0,43,84,.14)}
        .lx-hero{padding:150px 0 92px;background:radial-gradient(circle at 84% 20%,rgba(250,183,45,.12),transparent 24%),linear-gradient(180deg,#FCFBF8,#F6F3EB);border-bottom:1px solid var(--line);overflow:hidden}.lx-herogrid{display:grid;grid-template-columns:.93fr 1.07fr;gap:68px;align-items:center}
        .lx-hero h1{font-family:var(--font-heading);font-size:clamp(48px,5.7vw,76px);line-height:1.01;letter-spacing:-.04em;color:var(--navy);margin:0;max-width:650px}.lx-hero h1 em{font-style:normal;color:var(--navy2)}.lx-copy{font-size:18px;line-height:1.75;color:#5F6D80;max-width:610px;margin:26px 0 0}.lx-actions{display:flex;gap:12px;margin-top:34px}.lx-btn{min-height:49px;padding:0 22px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;gap:9px;text-decoration:none;font-size:14px;font-weight:700}.lx-primary{background:var(--navy);color:#fff;box-shadow:0 10px 28px rgba(0,43,84,.17)}.lx-secondary{background:#fff;color:var(--navy);border:1px solid #D7DDE5}.lx-note{font-size:12px;color:#7C8796;margin-top:20px}.lx-heroart{position:relative}.lx-heroart img{width:100%;display:block;filter:drop-shadow(0 26px 44px rgba(0,43,84,.12))}
        .lx-strip{background:#fff;border-bottom:1px solid var(--line)}.lx-stripin{min-height:86px;display:flex;align-items:center;justify-content:space-between;gap:24px}.lx-striplabel{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#8993A0;font-weight:800}.lx-stripitems{display:flex;gap:26px;flex-wrap:wrap;justify-content:flex-end}.lx-stripitem{font-size:12px;color:#4E5D70;font-weight:650;display:flex;align-items:center;gap:8px}
        .lx-section{padding:104px 0}.lx-alt{background:var(--paper);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.lx-head{display:grid;grid-template-columns:.78fr 1.22fr;gap:78px;align-items:end;margin-bottom:48px}.lx-label{font-size:11px;text-transform:uppercase;letter-spacing:.15em;color:var(--navy2);font-weight:800}.lx-section h2{font-family:var(--font-heading);font-size:clamp(34px,4vw,52px);line-height:1.08;letter-spacing:-.028em;color:var(--navy);margin:10px 0 0}.lx-lede{font-size:16px;line-height:1.78;color:#667488;margin:0;max-width:620px}.lx-capgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:18px;overflow:hidden}.lx-card{background:#fff;padding:30px;min-height:260px}.lx-icon{width:44px;height:44px;border-radius:12px;background:#EEF3F8;color:var(--navy2);display:grid;place-items:center}.lx-eyebrow{margin-top:24px;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#9B7B2D;font-weight:800}.lx-card h3{font-family:var(--font-heading);font-size:21px;line-height:1.28;color:var(--navy);margin:8px 0 0}.lx-card p{font-size:13px;line-height:1.72;color:#687587;margin:12px 0 0}
        .lx-visualrow{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}.lx-artcard{padding:12px}.lx-artcard img{width:100%;display:block}.lx-copyblock p{font-size:15px;line-height:1.8;color:#667488;margin:22px 0 0}.lx-points{display:grid;gap:14px;margin-top:28px}.lx-point{display:flex;gap:12px;align-items:flex-start;font-size:13px;line-height:1.6;color:#526175}.lx-point svg{margin-top:2px;flex:none}
        .lx-workflow{display:grid;grid-template-columns:.82fr 1.18fr;gap:84px}.lx-workflowcopy{position:sticky;top:110px}.lx-workflowcopy p{font-size:15px;line-height:1.8;color:#667488;margin:22px 0 0}.lx-steps{border-top:1px solid #CBD2DA}.lx-step{display:grid;grid-template-columns:64px .82fr 1.18fr;gap:24px;padding:27px 0;border-bottom:1px solid #CBD2DA}.lx-num{font-family:var(--font-mono);font-size:12px;color:#9B844F;padding-top:3px}.lx-steptitle{font-size:14px;font-weight:750;color:var(--navy)}.lx-steptext{font-size:13px;line-height:1.65;color:#687587}
        .lx-cta{background:var(--navy);padding:94px 0;color:#fff;overflow:hidden;position:relative}.lx-cta:after{content:'';position:absolute;right:-120px;top:-180px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(250,183,45,.2),transparent 67%)}.lx-ctain{position:relative;z-index:2;display:grid;grid-template-columns:1.25fr .75fr;gap:60px;align-items:center}.lx-cta h2{font-family:var(--font-heading);font-size:clamp(36px,4vw,54px);line-height:1.08;margin:0}.lx-cta p{color:#C8D4DF;font-size:15px;line-height:1.75;margin:18px 0 0;max-width:620px}.lx-ctabtns{display:flex;gap:12px;justify-content:flex-end}.lx-gold{background:var(--gold);color:var(--navy)}.lx-outline{border:1px solid rgba(255,255,255,.28);color:#fff}
        .lx-footer{padding:42px 0 28px;background:#001C37;color:#C7D1DC}.lx-footin{display:flex;justify-content:space-between;gap:40px}.lx-footbrand{font-family:var(--font-heading);font-size:22px;color:#fff;font-weight:700}.lx-footcopy{font-size:12px;color:#91A0B0;margin-top:8px}.lx-footlinks{display:flex;gap:28px}.lx-footlinks a{text-decoration:none;color:#C7D1DC;font-size:12px}.lx-footbottom{border-top:1px solid rgba(255,255,255,.1);margin-top:30px;padding-top:20px;font-size:11px;color:#7F91A4}
        @media(max-width:900px){.lx-herogrid,.lx-head,.lx-visualrow,.lx-workflow,.lx-ctain{grid-template-columns:1fr}.lx-hero{padding-top:118px}.lx-workflowcopy{position:static}.lx-ctabtns{justify-content:flex-start}.lx-capgrid{grid-template-columns:1fr 1fr}.lx-links a[href^='#']{display:none}.lx-head{gap:20px}.lx-heroart{margin-top:16px}}
        @media(max-width:620px){.lx-wrap{width:min(100% - 36px,1180px)}.lx-links{gap:10px}.lx-links>a:not(.lx-navcta){display:none}.lx-hero{padding:108px 0 58px}.lx-hero h1{font-size:43px}.lx-copy{font-size:16px}.lx-actions{flex-direction:column}.lx-btn{width:100%}.lx-stripin{align-items:flex-start;flex-direction:column;padding:24px 0}.lx-stripitems{justify-content:flex-start}.lx-section{padding:70px 0}.lx-capgrid{grid-template-columns:1fr}.lx-step{grid-template-columns:44px 1fr;gap:14px}.lx-steptext{grid-column:2}.lx-footin{flex-direction:column}.lx-footlinks{flex-wrap:wrap}.lx-ctabtns{flex-direction:column}.lx-ctabtns .lx-btn{width:100%}}
      `}</style>

      <header className="lx-nav">
        <div className="lx-wrap lx-navin">
          <div className="lx-brand">LexAMS</div>
          <nav className="lx-links">
            <a href="#capabilities">Capabilities</a>
            <a href="#workflow">Workflow</a>
            <Link to="/login">Log in</Link>
            <Link className="lx-navcta" to="/signup">Create workspace</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="lx-hero">
          <div className="lx-wrap lx-herogrid">
            <div>
              <h1>Plan activities. Track participation. <em>Measure outcomes.</em></h1>
              <p className="lx-copy">LexAMS brings programme delivery into one focused workspace—from registration and attendance to surveys, assessments, certificates and reporting.</p>
              <div className="lx-actions">
                <Link className="lx-btn lx-primary" to="/signup">Create workspace <ArrowRight size={17}/></Link>
                <Link className="lx-btn lx-secondary" to="/login">Sign in</Link>
              </div>
              <div className="lx-note">Passwordless sign-in · Organization workspace · Public participation links</div>
            </div>
            <div className="lx-heroart">
              <img src="/assets/lexams-workflow-illustration.svg" alt="LexAMS activity workflow from planning through reporting" />
            </div>
          </div>
        </section>

        <section className="lx-strip" aria-label="Product focus">
          <div className="lx-wrap lx-stripin">
            <div className="lx-striplabel">Built around delivery work</div>
            <div className="lx-stripitems">
              <div className="lx-stripitem"><CheckCircle2 size={15} color="#2E7D4F"/> Organization-scoped records</div>
              <div className="lx-stripitem"><ShieldCheck size={15} color="#0E4C8F"/> Controlled team access</div>
              <div className="lx-stripitem"><QrCode size={15} color="#C58A13"/> Public registration & check-in</div>
            </div>
          </div>
        </section>

        <section id="capabilities" className="lx-section">
          <div className="lx-wrap">
            <div className="lx-head">
              <div><div className="lx-label">Core capabilities</div><h2>One workspace across the activity lifecycle.</h2></div>
              <p className="lx-lede">LexAMS is structured around the work programme teams already do. Each capability supports the same operational record rather than creating another disconnected spreadsheet or tool.</p>
            </div>
            <div className="lx-capgrid">
              {capabilities.map(([Icon, eyebrow, title, text]) => <article className="lx-card" key={title}>
                <div className="lx-icon"><Icon size={20}/></div><div className="lx-eyebrow">{eyebrow}</div><h3>{title}</h3><p>{text}</p>
              </article>)}
            </div>
          </div>
        </section>

        <section className="lx-section lx-alt">
          <div className="lx-wrap lx-visualrow">
            <div className="lx-artcard"><img src="/assets/lexams-outcomes-illustration.svg" alt="LexAMS surveys, assessments, reporting and certificate workflow" /></div>
            <div className="lx-copyblock">
              <div className="lx-label">From delivery to evidence</div>
              <h2>Participation is useful. Connected outcomes are better.</h2>
              <p>LexAMS is designed so the evidence generated after an activity does not live somewhere else. Feedback, assessment results and certificates remain tied to the people and activity that produced them.</p>
              <div className="lx-points">
                <div className="lx-point"><CheckCircle2 size={17} color="#2E7D4F"/><span>Survey and assessment records connected to the activity.</span></div>
                <div className="lx-point"><CheckCircle2 size={17} color="#2E7D4F"/><span>Server-side assessment scoring and controlled public submission links.</span></div>
                <div className="lx-point"><CheckCircle2 size={17} color="#2E7D4F"/><span>Organization-branded certificates and reporting-ready records.</span></div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="lx-section">
          <div className="lx-wrap lx-workflow">
            <div className="lx-workflowcopy"><div className="lx-label">Workflow</div><h2>A clear path from planning to evidence.</h2><p>The system follows the actual lifecycle of an activity. Teams can move through each stage without losing context or rebuilding the same records elsewhere.</p></div>
            <div className="lx-steps">{steps.map(([n,t,x])=><div className="lx-step" key={n}><div className="lx-num">{n}</div><div className="lx-steptitle">{t}</div><div className="lx-steptext">{x}</div></div>)}</div>
          </div>
        </section>

        <section className="lx-cta">
          <div className="lx-wrap lx-ctain"><div><h2>Build a cleaner operational record for every activity.</h2><p>Start a LexAMS workspace for your organization and bring planning, participation, learning evidence and recognition into one system.</p></div><div className="lx-ctabtns"><Link className="lx-btn lx-gold" to="/signup">Create workspace <ArrowRight size={17}/></Link><Link className="lx-btn lx-outline" to="/login">Sign in</Link></div></div>
        </section>
      </main>

      <footer className="lx-footer"><div className="lx-wrap"><div className="lx-footin"><div><div className="lx-footbrand">LexAMS</div><div className="lx-footcopy">LexAMS by LexoGraphix Plus</div></div><div className="lx-footlinks"><a href="#capabilities">Capabilities</a><a href="#workflow">Workflow</a><Link to="/login">Log in</Link></div></div><div className="lx-footbottom">Activity management, participation records and outcome tracking for programmes and training.</div></div></footer>
    </div>
  );
}
