import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Landing from './pages/LandingV2';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Activities from './pages/Activities';
import ActivityDetail from './pages/ActivityDetail';
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
        <Route index element={<Dashboard />} />
        <Route path="activities" element={<Activities />} />
        <Route path="activities/:id" element={<ActivityDetail />} />
        <Route path="participants" element={<Participants />} />
        <Route path="certificates" element={<Certificates />} />
        <Route path="reports" element={<Reports />} />
        <Route path="surveys" element={<Surveys />} />
        <Route path="assessments" element={<Assessments />} />
        <Route path="settings" element={<Settings />} />
        <Route path="team" element={<Team />} />
      </Route>
    </Routes>
  );
}
