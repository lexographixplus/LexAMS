import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import NotFound from './pages/NotFound';
import AppLayout from './components/AppLayout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Activities = lazy(() => import('./pages/Activities'));
const ActivityDetailFrame = lazy(() => import('./pages/ActivityDetailFrame'));
const ParticipantsFrame = lazy(() => import('./pages/ParticipantsFrame'));
const Certificates = lazy(() => import('./pages/Certificates'));
const Communications = lazy(() => import('./pages/Communications'));
const Reports = lazy(() => import('./pages/Reports'));
const Surveys = lazy(() => import('./pages/Surveys'));
const Assessments = lazy(() => import('./pages/Assessments'));
const Settings = lazy(() => import('./pages/Settings'));
const Team = lazy(() => import('./pages/Team'));
const MyAccount = lazy(() => import('./pages/MyAccount'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const BillingAdmin = lazy(() => import('./pages/BillingAdmin'));
const BillingCheckout = lazy(() => import('./pages/BillingCheckout'));
const SurveyPublic = lazy(() => import('./pages/public/SurveyPublic'));
const AssessmentPublic = lazy(() => import('./pages/public/AssessmentPublic'));
const CertificatePublic = lazy(() => import('./pages/public/CertificatePublic'));
const RegisterPublic = lazy(() => import('./pages/public/RegisterPublic'));
const AttendancePublic = lazy(() => import('./pages/public/AttendancePublic'));
const ParticipantPassPublic = lazy(() => import('./pages/public/ParticipantPassPublic'));
const JoinTeam = lazy(() => import('./pages/public/JoinTeam'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const marketingPage = name => lazy(() => import('./pages/MarketingPages').then(module => ({ default: module[name] })));
const FeaturesPage = marketingPage('FeaturesPage');
const SolutionsIndex = marketingPage('SolutionsIndex');
const SolutionPage = marketingPage('SolutionPage');
const SecurityPage = marketingPage('SecurityPage');
const AboutPage = marketingPage('AboutPage');
const PrivacyPage = marketingPage('PrivacyPage');
const TermsPage = marketingPage('TermsPage');

function LoadingScreen() {
  return (
    <div className="lx-splash" role="status" aria-live="polite">
      <span className="lx-splash-mark">LexAMS</span>
      <span className="lx-visually-hidden">Loading your workspace</span>
    </div>
  );
}

/** Shown when the session could not be read at all, so the app never hangs. */
function SessionErrorScreen({ message }) {
  return (
    <main className="lx-message-page">
      <section className="lx-message-card" role="alert">
        <span className="lx-message-brand">LexAMS</span>
        <p className="lx-message-code">Connection problem</p>
        <h1>We could not load your workspace</h1>
        <p>{message}</p>
        <div className="lx-message-actions">
          <button type="button" className="lx-btn lx-btn-primary" onClick={() => window.location.reload()}>Try again</button>
          <a href="/" className="lx-btn lx-btn-secondary">Go to the home page</a>
        </div>
      </section>
    </main>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading, sessionError } = useAuth();
  if (loading) return <LoadingScreen />;
  if (sessionError) return <SessionErrorScreen message={sessionError} />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function ProRoute({ children }) {
  const { isPro, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return isPro ? children : <Navigate to="/app/checkout" replace />;
}

function UiPage({ name, children }) {
  return <div className={`lexams-ui-page lexams-ui-${name}`}>{children}</div>;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Marketing */}
        <Route path="/" element={<Landing />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/solutions" element={<SolutionsIndex />} />
        <Route path="/solutions/training-providers" element={<SolutionPage type="training" path="/solutions/training-providers" />} />
        <Route path="/solutions/ngos" element={<SolutionPage type="ngos" path="/solutions/ngos" />} />
        <Route path="/solutions/education" element={<SolutionPage type="education" path="/solutions/education" />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/billing" element={<Navigate to="/app/billing" replace />} />

        {/* Authentication */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Token-scoped public experiences */}
        <Route path="/survey/:token" element={<SurveyPublic />} />
        <Route path="/assessment/:token" element={<AssessmentPublic />} />
        <Route path="/certificate/:token" element={<CertificatePublic />} />
        <Route path="/register/:token" element={<RegisterPublic />} />
        <Route path="/checkin/:token" element={<AttendancePublic />} />
        <Route path="/pass/:token" element={<ParticipantPassPublic />} />
        <Route path="/join/:token" element={<JoinTeam />} />

        {/* Workspace */}
        <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<UiPage name="dashboard"><Dashboard /></UiPage>} />
          <Route path="activities" element={<UiPage name="activities"><Activities /></UiPage>} />
          <Route path="activities/:id" element={<UiPage name="activity-detail"><ActivityDetailFrame /></UiPage>} />
          <Route path="participants" element={<UiPage name="participants"><ParticipantsFrame /></UiPage>} />
          <Route path="certificates" element={<UiPage name="certificates"><Certificates /></UiPage>} />
          <Route path="communications" element={<ProRoute><UiPage name="communications"><Communications /></UiPage></ProRoute>} />
          <Route path="communication" element={<Navigate to="/app/communications" replace />} />
          <Route path="reports" element={<UiPage name="reports"><Reports /></UiPage>} />
          <Route path="surveys" element={<UiPage name="surveys"><Surveys /></UiPage>} />
          <Route path="assessments" element={<UiPage name="assessments"><Assessments /></UiPage>} />
          <Route path="settings" element={<UiPage name="settings"><Settings /></UiPage>} />
          <Route path="billing" element={<UiPage name="billing"><BillingPage /></UiPage>} />
          <Route path="account" element={<UiPage name="account"><MyAccount /></UiPage>} />
          <Route path="checkout" element={<UiPage name="checkout"><BillingCheckout /></UiPage>} />
          <Route path="team" element={<ProRoute><UiPage name="team"><Team /></UiPage></ProRoute>} />
          <Route path="admin/billing" element={<UiPage name="billing-admin"><BillingAdmin /></UiPage>} />
          <Route path="*" element={<UiPage name="not-found"><NotFound inWorkspace /></UiPage>} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
