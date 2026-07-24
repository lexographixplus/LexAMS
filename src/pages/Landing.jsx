import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  CalendarRange, Users, Award, BarChart3, QrCode, ClipboardCheck,
  ArrowRight, CheckCircle2, Sparkles, Shield, Globe, Zap,
  ChevronRight, Star, UsersRound, FileCheck,
} from 'lucide-react';

export default function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to="/app" replace />;

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', fontFamily: "var(--font-body)" }}>
      <style>{`
        .landing-nav-links { display: flex; align-items: center; gap: 32px; }
        .landing-hero { padding-top: 148px; padding-bottom: 100px; }
        .landing-hero-inner { max-width: 1200px; margin: 0 auto; padding: 0 40px; position: relative; }
        .landing-hero-text { max-width: 680px; }
        .landing-hero h1 { font-size: 56px; }
        .landing-hero-cta { display: flex; gap: 14px; margin-top: 40px; align-items: center; }
        .landing-mockup { position: absolute; top: 20px; right: -20px; width: 520px; }
        .landing-section { padding: 96px 40px; }
        .landing-section-inner { max-width: 1200px; margin: 0 auto; }
        .landing-bento { display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: auto auto; gap: 20px; }
        .landing-bento-large { grid-column: 1 / 3; }
        .landing-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; }
        .landing-testimonials { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .landing-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; text-align: center; }
        .landing-cta h2 { font-size: 40px; }
        .landing-footer-inner { display: flex; justify-content: space-between; align-items: flex-start; }
        .landing-footer-links { display: flex; gap: 48px; }
        .landing-nav-divider { width: 1px; height: 20px; background: #E0E4E9; }
        .landing-hero-proof { display: flex; align-items: center; gap: 14px; margin-top: 36px; }

        @media (max-width: 768px) {
          .landing-nav-links a[href^="#"], .landing-nav-divider { display: none !important; }
          .landing-nav-links { gap: 10px !important; }
          .landing-hero { padding-top: 90px !important; padding-bottom: 48px !important; }
          .landing-hero-inner { padding: 0 20px !important; }
          .landing-hero-text { max-width: 100% !important; }
          .landing-hero h1 { font-size: 30px !important; letter-spacing: -0.01em !important; }
          .landing-hero h1 br { display: none; }
          .landing-hero p { font-size: 16px !important; }
          .landing-hero-cta { flex-direction: column !important; align-items: stretch !important; }
          .landing-hero-cta a { text-align: center; justify-content: center; }
          .landing-mockup { display: none !important; }
          .landing-section { padding: 48px 20px !important; }
          .landing-bento { grid-template-columns: 1fr !important; }
          .landing-bento-large { grid-column: 1 !important; }
          .landing-steps { grid-template-columns: 1fr 1fr !important; gap: 24px !important; }
          .landing-testimonials { grid-template-columns: 1fr !important; }
          .landing-stats-grid { grid-template-columns: 1fr 1fr !important; gap: 16px !important; }
          .landing-cta h2 { font-size: 26px !important; }
          .landing-cta h2 br { display: none; }
          .landing-footer-inner { flex-direction: column !important; gap: 28px !important; }
          .landing-footer-links { gap: 28px !important; }
          .landing-hero-proof { flex-direction: column; gap: 8px; align-items: flex-start; }
          .landing-section h2 { font-size: 26px !important; }
          header > div { padding: 0 20px !important; }
          footer { padding: 32px 20px 24px !important; }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .landing-hero h1 { font-size: 40px !important; }
          .landing-mockup { display: none !important; }
          .landing-hero-text { max-width: 100% !important; }
          .landing-bento { grid-template-columns: 1fr 1fr !important; }
          .landing-bento-large { grid-column: 1 / 3 !important; }
          .landing-steps { grid-template-columns: 1fr 1fr !important; }
          .landing-testimonials { grid-template-columns: 1fr 1fr !important; }
          .landing-section { padding: 64px 32px !important; }
        }
      `}</style>
      {/* ─── NAVBAR ─── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(250,250,248,0.8)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(224,228,233,0.6)',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 40px',
          height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: '#002B54' }}>
              LexAMS
            </span>
            <span style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#7A8699', fontWeight: 600 }}>
              by LexoStudio
            </span>
          </div>
          <nav className="landing-nav-links">
            <a href="#features" style={{ fontSize: 14, fontWeight: 500, color: '#5B6B80', textDecoration: 'none' }}>Features</a>
            <a href="#how" style={{ fontSize: 14, fontWeight: 500, color: '#5B6B80', textDecoration: 'none' }}>How it works</a>
            <a href="#testimonials" style={{ fontSize: 14, fontWeight: 500, color: '#5B6B80', textDecoration: 'none' }}>Testimonials</a>
            <div className="landing-nav-divider" />
            <Link to="/login" style={{ fontSize: 14, fontWeight: 600, color: '#002B54', textDecoration: 'none' }}>
              Log in
            </Link>
            <Link to="/signup" style={{
              padding: '9px 22px', fontSize: 14, fontWeight: 600, borderRadius: 999,
              color: '#002B54', background: '#FAB72D', textDecoration: 'none',
              boxShadow: '0 1px 3px rgba(250,183,45,0.3)',
              transition: 'transform 150ms, box-shadow 150ms',
            }}>Get started free</Link>
          </nav>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="landing-hero" style={{
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Gradient orbs */}
        <div style={{
          position: 'absolute', top: -120, right: -180, width: 600, height: 600,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(250,183,45,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -200, left: -150, width: 500, height: 500,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,76,143,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div className="landing-hero-inner">
          <div className="landing-hero-text">
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '7px 16px 7px 10px', borderRadius: 999,
              background: '#FFFFFF', border: '1px solid #E0E4E9',
              boxShadow: '0 1px 3px rgba(0,43,84,0.04)',
              fontSize: 13, fontWeight: 500, color: '#5B6B80',
              marginBottom: 28,
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 999,
                background: '#002B54', color: '#FAB72D', fontSize: 11, fontWeight: 700,
              }}><Sparkles size={12} /> NEW</span>
              Team collaboration & approval workflows
              <ChevronRight size={14} style={{ color: '#B0B8C4' }} />
            </div>

            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 700,
              color: '#002B54', lineHeight: 1.1, margin: 0, letterSpacing: '-0.02em',
            }}>
              The smarter way to{' '}
              <span style={{
                background: 'linear-gradient(135deg, #FAB72D 0%, #E29F1E 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>manage activities</span>
            </h1>

            <p style={{
              fontSize: 20, color: '#5B6B80', lineHeight: 1.65, marginTop: 24,
              maxWidth: 540,
            }}>
              From participant registration to certificate issuance. LexAMS gives NGOs
              and training institutions one platform to run everything.
            </p>

            <div className="landing-hero-cta">
              <Link to="/signup" style={{
                padding: '16px 36px', fontSize: 16, fontWeight: 600, borderRadius: 12,
                color: '#002B54', background: '#FAB72D', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 10,
                boxShadow: '0 4px 14px rgba(250,183,45,0.35)',
                transition: 'transform 150ms, box-shadow 150ms',
              }}>
                Start free trial
                <ArrowRight size={18} />
              </Link>
              <Link to="/login" style={{
                padding: '16px 36px', fontSize: 16, fontWeight: 600, borderRadius: 12,
                color: '#002B54', background: '#FFFFFF', textDecoration: 'none',
                border: '1.5px solid #E0E4E9',
                display: 'inline-flex', alignItems: 'center',
                transition: 'border-color 150ms',
              }}>Sign in</Link>
            </div>

            {/* Social proof */}
            <div className="landing-hero-proof">
              <div style={{ display: 'flex' }}>
                {['#0E4C8F', '#2E7D4F', '#B45309', '#C0362C'].map((bg, i) => (
                  <div key={i} style={{
                    width: 32, height: 32, borderRadius: 999, background: bg,
                    border: '2px solid #FAFAF8', marginLeft: i > 0 ? -8 : 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#FFF', fontSize: 10, fontWeight: 700,
                  }}>{['AK', 'JN', 'SM', 'FW'][i]}</div>
                ))}
              </div>
              <div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1,2,3,4,5].map(i => <Star key={i} size={14} fill="#FAB72D" color="#FAB72D" />)}
                </div>
                <span style={{ fontSize: 12, color: '#7A8699' }}>Trusted by 500+ organizations</span>
              </div>
            </div>
          </div>

          {/* Dashboard mockup */}
          <div className="landing-mockup" style={{
            background: '#FFFFFF', borderRadius: 16, border: '1px solid #E0E4E9',
            boxShadow: '0 8px 40px rgba(0,43,84,0.08), 0 1px 3px rgba(0,43,84,0.04)',
            overflow: 'hidden', transform: 'perspective(1200px) rotateY(-6deg) rotateX(2deg)',
          }}>
            {/* Title bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px',
              background: '#002B54',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: '#FF6058' }} />
              <div style={{ width: 8, height: 8, borderRadius: 999, background: '#FFBD2E' }} />
              <div style={{ width: 8, height: 8, borderRadius: 999, background: '#28C840' }} />
              <span style={{ marginLeft: 12, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>LexAMS Dashboard</span>
            </div>
            {/* Mock content */}
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                {[{ l: 'Activities', v: '24' }, { l: 'Participants', v: '186' }, { l: 'Certificates', v: '93' }].map(k => (
                  <div key={k.l} style={{
                    padding: '14px 12px', borderRadius: 10, background: '#F7F8FA',
                    border: '1px solid #ECEEF2',
                  }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7A8699', fontWeight: 600 }}>{k.l}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#002B54', marginTop: 4 }}>{k.v}</div>
                  </div>
                ))}
              </div>
              {/* Mock chart */}
              <div style={{
                padding: '14px 16px', borderRadius: 10, background: '#F7F8FA',
                border: '1px solid #ECEEF2',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#5B6B80', marginBottom: 12 }}>Activities by month</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 60 }}>
                  {[35, 55, 25, 70, 45, 80, 60].map((h, i) => (
                    <div key={i} style={{
                      flex: 1, height: `${h}%`, borderRadius: '4px 4px 0 0',
                      background: i === 5 ? '#FAB72D' : '#0E4C8F', opacity: i === 5 ? 1 : 0.7,
                    }} />
                  ))}
                </div>
              </div>
              {/* Mock rows */}
              <div style={{ marginTop: 12 }}>
                {['Community Health Training', 'Youth Digital Bootcamp', 'WASH Workshop'].map((t, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: i < 2 ? '1px solid #ECEEF2' : 'none',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#002B54' }}>{t}</span>
                    <span style={{
                      fontSize: 9, padding: '2px 8px', borderRadius: 999,
                      background: i === 0 ? '#E4F3E9' : i === 1 ? '#FDF3DC' : '#E9EDF2',
                      color: i === 0 ? '#2E7D4F' : i === 1 ? '#8A6210' : '#5B6B80',
                      fontWeight: 600,
                    }}>{['Completed', 'Ongoing', 'Upcoming'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── LOGOS / STATS BAR ─── */}
      <section style={{
        borderTop: '1px solid #E0E4E9', borderBottom: '1px solid #E0E4E9',
        background: '#FFFFFF', padding: '32px 40px',
      }}>
        <div className="landing-stats-grid" style={{ maxWidth: 1200, margin: '0 auto' }}>
          {[
            { value: '500+', label: 'Organizations', icon: Globe },
            { value: '10k+', label: 'Activities managed', icon: CalendarRange },
            { value: '50k+', label: 'Certificates issued', icon: Award },
            { value: '99.9%', label: 'Uptime reliability', icon: Zap },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <s.icon size={18} style={{ color: '#B0B8C4', marginBottom: 4 }} />
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#002B54' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: '#7A8699' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="landing-section">
        <div className="landing-section-inner">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 999, background: '#E9EDF2',
              fontSize: 12, fontWeight: 600, color: '#0E4C8F', marginBottom: 16,
            }}>
              <Sparkles size={13} /> Features
            </div>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 700,
              color: '#002B54', lineHeight: 1.15, letterSpacing: '-0.01em',
            }}>
              Everything you need,<br />nothing you don't
            </h2>
            <p style={{
              fontSize: 17, color: '#5B6B80', marginTop: 16,
              maxWidth: 520, marginInline: 'auto', lineHeight: 1.6,
            }}>
              Built specifically for organizations that run trainings, workshops, and community programs.
            </p>
          </div>

          {/* Bento grid */}
          <div className="landing-bento">
            {/* Large card */}
            <div className="landing-bento-large" style={{
              gridRow: '1',
              background: '#002B54', borderRadius: 20, padding: '40px 44px',
              color: '#FFFFFF', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: -60, right: -60, width: 200, height: 200,
                borderRadius: '50%', background: 'rgba(250,183,45,0.1)',
              }} />
              <CalendarRange size={28} style={{ color: '#FAB72D' }} />
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginTop: 20, lineHeight: 1.3 }}>
                Activity management that actually works
              </h3>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, marginTop: 12, maxWidth: 440 }}>
                Create trainings, workshops, meetings, and community events. Track status, manage sessions,
                and generate shareable registration links — all from one dashboard.
              </p>
            </div>

            {/* Right card */}
            <div style={{
              background: '#FFFFFF', borderRadius: 20, padding: '32px 28px',
              border: '1px solid #E0E4E9', boxShadow: '0 2px 8px rgba(0,43,84,0.03)',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, background: '#FDF3DC',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B45309',
              }}><Award size={24} /></div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#002B54', marginTop: 18 }}>Branded certificates</h3>
              <p style={{ fontSize: 14, color: '#5B6B80', lineHeight: 1.6, marginTop: 8 }}>
                Issue completion, attendance, and appreciation certificates with your logo.
                Download as PDF, verify online.
              </p>
            </div>

            {/* Bottom row */}
            {[
              { icon: Users, title: 'Participant database', desc: 'Central registry with full engagement history, categories, and activity tracking across your organization.', bg: '#E4F3E9', iconColor: '#2E7D4F' },
              { icon: ClipboardCheck, title: 'Surveys & assessments', desc: 'Build surveys with ratings and MCQs. Create timed assessments with auto-grading. Share via link.', bg: '#E9EDF2', iconColor: '#0E4C8F' },
              { icon: UsersRound, title: 'Team & approvals', desc: 'Invite team members to collaborate. Members submit requests, admins approve certificates and participants.', bg: '#FEF2F2', iconColor: '#C0362C' },
            ].map(f => (
              <div key={f.title} style={{
                background: '#FFFFFF', borderRadius: 20, padding: '32px 28px',
                border: '1px solid #E0E4E9', boxShadow: '0 2px 8px rgba(0,43,84,0.03)',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, background: f.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.iconColor,
                }}><f.icon size={24} /></div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#002B54', marginTop: 18 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: '#5B6B80', lineHeight: 1.6, marginTop: 8 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how" className="landing-section" style={{
        background: '#FFFFFF',
        borderTop: '1px solid #E0E4E9', borderBottom: '1px solid #E0E4E9',
      }}>
        <div className="landing-section-inner">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 999, background: '#E9EDF2',
              fontSize: 12, fontWeight: 600, color: '#0E4C8F', marginBottom: 16,
            }}>
              <Zap size={13} /> Simple setup
            </div>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 700,
              color: '#002B54', letterSpacing: '-0.01em',
            }}>Up and running in minutes</h2>
          </div>

          <div className="landing-steps">
            {[
              { step: '01', title: 'Create an activity', desc: 'Set up your training, workshop, or event with dates, venue, and facilitator details.', icon: CalendarRange },
              { step: '02', title: 'Share registration link', desc: 'Participants register themselves through your branded link. Returning users are auto-recognized.', icon: Globe },
              { step: '03', title: 'Track attendance', desc: 'Participants check in daily via a unique link. The system auto-detects the correct session day.', icon: FileCheck },
              { step: '04', title: 'Issue certificates', desc: 'Generate branded PDF certificates for participants who meet your attendance threshold.', icon: Award },
            ].map(s => (
              <div key={s.step} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 999, margin: '0 auto 20px',
                  background: s.step === '01' ? '#002B54' : '#F7F8FA',
                  border: s.step === '01' ? 'none' : '1px solid #E0E4E9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: s.step === '01' ? '#FAB72D' : '#0E4C8F',
                }}><s.icon size={22} /></div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: '#FAB72D',
                  letterSpacing: '0.1em', marginBottom: 8,
                }}>STEP {s.step}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#002B54' }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: '#5B6B80', lineHeight: 1.6, marginTop: 8 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section id="testimonials" className="landing-section">
        <div className="landing-section-inner">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 999, background: '#E9EDF2',
              fontSize: 12, fontWeight: 600, color: '#0E4C8F', marginBottom: 16,
            }}>
              <Star size={13} /> Testimonials
            </div>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 700,
              color: '#002B54', letterSpacing: '-0.01em',
            }}>Loved by organizations</h2>
          </div>

          <div className="landing-testimonials">
            {[
              { quote: "LexAMS replaced our spreadsheets, manual registers, and WhatsApp groups. Now everything is in one place and our field officers love it.", name: 'Amina Y.', role: 'Program Director', org: 'Horizon Community Foundation' },
              { quote: "The certificate feature alone saved us weeks of work. Participants get a professional PDF certificate with our logo instantly.", name: 'Brian O.', role: 'Training Lead', org: 'Kenya Red Cross Youth' },
              { quote: "Being able to share a registration link and have participants self-register is a game changer for our community outreach events.", name: 'Janet M.', role: 'Field Coordinator', org: 'Nakuru County Health' },
            ].map((t, i) => (
              <div key={i} style={{
                background: '#FFFFFF', borderRadius: 20, padding: '32px 28px',
                border: '1px solid #E0E4E9', boxShadow: '0 2px 8px rgba(0,43,84,0.03)',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ display: 'flex', gap: 2, marginBottom: 16 }}>
                  {[1,2,3,4,5].map(j => <Star key={j} size={14} fill="#FAB72D" color="#FAB72D" />)}
                </div>
                <p style={{ fontSize: 15, color: '#5B6B80', lineHeight: 1.65, flex: 1 }}>"{t.quote}"</p>
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 999, background: '#002B54',
                    color: '#FAB72D', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                  }}>{t.name.split(' ').map(n => n[0]).join('')}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#002B54' }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: '#7A8699' }}>{t.role}, {t.org}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="landing-section landing-cta" style={{
        position: 'relative', overflow: 'hidden',
        background: '#002B54',
      }}>
        <div style={{
          position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)',
          width: 800, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(250,183,45,0.15) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700,
            color: '#FFFFFF', lineHeight: 1.2, letterSpacing: '-0.01em',
          }}>
            Ready to transform how you<br />manage activities?
          </h2>
          <p style={{
            fontSize: 17, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65, marginTop: 20,
          }}>
            Join hundreds of organizations already using LexAMS. Free to start, no credit card required.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 36 }}>
            <Link to="/signup" style={{
              padding: '16px 40px', fontSize: 17, fontWeight: 600, borderRadius: 12,
              color: '#002B54', background: '#FAB72D', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 10,
              boxShadow: '0 4px 20px rgba(250,183,45,0.3)',
            }}>
              Create your free account
              <ArrowRight size={18} />
            </Link>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 28, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={14} /> Free forever plan</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Shield size={14} /> No credit card</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Zap size={14} /> Setup in 2 minutes</span>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ background: '#0F1B2B', padding: '48px 40px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="landing-footer-inner">
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: '#FFFFFF' }}>LexAMS</span>
                <span style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>by LexoStudio</span>
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 10, maxWidth: 280, lineHeight: 1.6 }}>
                Activity management made simple for NGOs and community organizations.
              </p>
            </div>
            <div className="landing-footer-links">
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Product</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {['Features', 'How it works', 'Pricing'].map(l => (
                    <a key={l} href={`#${l.toLowerCase().replace(/\s/g, '-')}`} style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>{l}</a>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Account</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Link to="/login" style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Log in</Link>
                  <Link to="/signup" style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Sign up</Link>
                </div>
              </div>
            </div>
          </div>
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 36, paddingTop: 24,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>&copy; {new Date().getFullYear()} LexoStudio. All rights reserved.</span>
            <div style={{ display: 'flex', gap: 20 }}>
              {['Privacy', 'Terms'].map(l => (
                <a key={l} href="#" style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
