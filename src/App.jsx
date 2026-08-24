import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Activities from './pages/Activities';
import ActivityDetailFrame from './pages/ActivityDetailFrame';
import Participants from './pages/Participants';
import Certificates from './pages/Certificates';
import Reports from './pages/Reports';
import Surveys from './pages/Surveys';
import Assessments from './pages/Assessments';
import Settings from './pages/Settings';
import Team from './pages/Team';
import SurveyPublic from './pages/public/SurveyPublic';
import AssessmentPublic from './pages/public/AssessmentPublic';
import RegisterPublic from './pages/public/RegisterPublic';
import AttendancePublic from './pages/public/AttendancePublic';
import JoinTeam from './pages/public/JoinTeam';
import AppLayout from './components/AppLayout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function LoadingScreen() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--color-navy-900)' }}>
        LexAMS
      </div>
    </div>
  );
}

function UiPage({ name, children }) {
  return <div className={`lexams-ui-page lexams-ui-${name}`}>{children}</div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Public submission pages (no auth required) */}
      <Route path="/survey/:token" element={<SurveyPublic />} />
      <Route path="/assessment/:token" element={<AssessmentPublic />} />
      <Route path="/register/:token" element={<RegisterPublic />} />
      <Route path="/checkin/:token" element={<AttendancePublic />} />
      <Route path="/join/:token" element={<JoinTeam />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<UiPage name="dashboard"><Dashboard /></UiPage>} />
        <Route path="activities" element={<UiPage name="activities"><Activities /></UiPage>} />
        <Route path="activities/:id" element={<UiPage name="activity-detail"><ActivityDetailFrame /></UiPage>} />
        <Route path="participants" element={<UiPage name="participants"><Participants /></UiPage>} />
        <Route path="certificates" element={<UiPage name="certificates"><Certificates /></UiPage>} />
        <Route path="reports" element={<UiPage name="reports"><Reports /></UiPage>} />
        <Route path="surveys" element={<UiPage name="surveys"><Surveys /></UiPage>} />
        <Route path="assessments" element={<UiPage name="assessments"><Assessments /></UiPage>} />
        <Route path="settings" element={<UiPage name="settings"><Settings /></UiPage>} />
        <Route path="team" element={<UiPage name="team"><Team /></UiPage>} />
      </Route>
    </Routes>
  );
}
