import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import {
  LayoutDashboard, CalendarRange, Users, Award, FileBarChart,
  ClipboardCheck, GraduationCap, Settings, UsersRound,
  LogOut, Menu, ShieldCheck, X,
} from 'lucide-react';

const navItems = [
  { to: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/app/activities', icon: CalendarRange, label: 'Activities' },
  { to: '/app/participants', icon: Users, label: 'Participants' },
  { to: '/app/surveys', icon: ClipboardCheck, label: 'Surveys' },
  { to: '/app/assessments', icon: GraduationCap, label: 'Assessments' },
  { to: '/app/certificates', icon: Award, label: 'Certificates' },
  { to: '/app/reports', icon: FileBarChart, label: 'Reports' },
  { to: '/app/team', icon: UsersRound, label: 'Team' },
  { to: '/app/settings', icon: Settings, label: 'Settings' },
];

const pageTitles = {
  '/app': 'Dashboard',
  '/app/activities': 'Activities',
  '/app/participants': 'Participants',
  '/app/surveys': 'Surveys',
  '/app/assessments': 'Assessments',
  '/app/certificates': 'Certificates',
  '/app/reports': 'Reports',
  '/app/team': 'Team',
  '/app/settings': 'Settings',
  '/app/admin/billing': 'Billing administration',
};

export default function AppLayout() {
  const { user, profile, signOut } = useAuth();
  const { activities, participants, certificates, surveys, assessments } = useData();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const orgName = profile?.org_name || 'Horizon Community Foundation';
  const userName = profile?.full_name || user?.user_metadata?.full_name || 'Admin User';
  const role = profile?.role || 'Institution Administrator';
  const visibleNavItems = profile?.platform_admin
    ? [...navItems, { to: '/app/admin/billing', icon: ShieldCheck, label: 'Billing admin' }]
    : navItems;
  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const pageTitle = pageTitles[location.pathname] ||
    (location.pathname.startsWith('/app/activities/') ? 'Activity Detail' : 'LexAMS');

  const counts = {
    Activities: activities.length,
    Participants: participants.length,
    Surveys: surveys.length,
    Assessments: assessments.length,
    Certificates: certificates.length,
  };

  const sidebarContent = (
    <>
      <div style={{ padding: '26px 24px 22px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: '#FFFFFF', lineHeight: 1.1 }}>LexAMS</div>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>by LexoStudio</div>
          </div>
          {/* Close button - mobile only */}
          <button onClick={() => setSidebarOpen(false)} className="mobile-only" style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', padding: 4, cursor: 'pointer',
          }}><X size={20} /></button>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '14px 12px', flex: 1, overflowY: 'auto' }}>
        {visibleNavItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', borderRadius: 'var(--radius-md)',
              fontSize: 14, fontWeight: 600, textDecoration: 'none',
              color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.65)',
              background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
            })}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <item.icon size={18} />
              {item.label}
            </span>
            {counts[item.label] !== undefined && (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>{counts[item.label]}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '18px 24px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{orgName}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>Activity Management System</div>
        <button onClick={signOut} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginTop: 12, fontSize: 12, fontWeight: 600,
          color: 'var(--color-gold-500)', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        }}><LogOut size={14} /> Sign out</button>
      </div>
    </>
  );

  return (
    <>
      <style>{`
        .desktop-sidebar { display: flex; }
        .mobile-overlay { display: none; }
        .mobile-sidebar { display: none; }
        .mobile-only { display: none !important; }
        .hamburger { display: none; }
        .desktop-user { display: flex; }
        .content-pad { padding: 30px 40px 72px; }
        .topbar-pad { padding: 14px 40px; }

        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-only { display: flex !important; }
          .hamburger { display: flex !important; }
          .desktop-user { display: none !important; }
          .content-pad { padding: 20px 16px 60px; }
          .topbar-pad { padding: 12px 16px; }
          .mobile-overlay {
            display: block; position: fixed; inset: 0;
            background: rgba(0,43,84,0.4); z-index: 200;
          }
          .mobile-sidebar {
            display: flex; position: fixed; top: 0; left: 0; bottom: 0;
            width: 270px; z-index: 210; flex-direction: column;
            background: var(--surface-inverse);
            box-shadow: var(--shadow-raised);
          }
        }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* Desktop sidebar */}
        <div className="desktop-sidebar" style={{
          width: 232, flexShrink: 0, background: 'var(--surface-inverse)',
          flexDirection: 'column',
        }}>
          {sidebarContent}
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <>
            <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />
            <div className="mobile-sidebar">{sidebarContent}</div>
          </>
        )}

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Top bar */}
          <div className="topbar-pad" style={{
            background: 'var(--surface-card)',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="hamburger" onClick={() => setSidebarOpen(true)} style={{
                background: 'none', border: 'none', padding: 4, color: 'var(--text-primary)',
                cursor: 'pointer', alignItems: 'center',
              }}><Menu size={22} /></button>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 19,
                fontWeight: 700, color: 'var(--text-primary)',
              }}>{pageTitle}</div>
            </div>
            <div className="desktop-user" style={{ alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 999,
                background: 'var(--color-navy-900)', color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600,
              }}>{initials}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{userName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.3 }}>{role}</div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div className="content-pad" style={{ maxWidth: 1180, margin: '0 auto' }}>
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
