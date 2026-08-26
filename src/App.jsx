import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Activities from './pages/Activities';
import ActivityDetailFrame from './pages/ActivityDetailFrame';
import ParticipantsFrame from './pages/ParticipantsFrame';
import Certificates from './pages/Certificates';
import Communications from './pages/Communications';
import Reports from './pages/Reports';
import Surveys from './pages/Surveys';
import Assessments from './pages/Assessments';
import Settings from './pages/Settings';
import Team from './pages/Team';
import MyAccount from './pages/MyAccount';
import BillingPage from './pages/BillingPage';
import BillingAdmin from './pages/BillingAdmin';
import BillingCheckout from './pages/BillingCheckout';
import SurveyPublic from './pages/public/SurveyPublic';
import AssessmentPublic from './pages/public/AssessmentPublic';
import CertificatePublic from './pages/public/CertificatePublic';
import RegisterPublic from './pages/public/RegisterPublic';
import AttendancePublic from './pages/public/AttendancePublic';
import JoinTeam from './pages/public/JoinTeam';
import AppLayout from './components/AppLayout';
import ContactPage from './pages/ContactPage';
import PricingPage from './pages/PricingPage';
import { FeaturesPage, SolutionsIndex, SolutionPage, SecurityPage, AboutPage, PrivacyPage, TermsPage } from './pages/MarketingPages';

function ProtectedRoute({ children }) { const { user, loading } = useAuth(); if (loading) return <LoadingScreen />; if (!user) return <Navigate to="/login" replace />; return children; }
function LoadingScreen(){return <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:700,color:'var(--color-navy-900)'}}>LexAMS</div></div>}
function UiPage({name,children}){return <div className={`lexams-ui-page lexams-ui-${name}`}>{children}</div>}

export default function App(){return <Routes>
<Route path="/" element={<Landing/>}/><Route path="/features" element={<FeaturesPage/>}/><Route path="/pricing" element={<PricingPage/>}/><Route path="/solutions" element={<SolutionsIndex/>}/><Route path="/solutions/training-providers" element={<SolutionPage type="training" path="/solutions/training-providers"/>}/><Route path="/solutions/ngos" element={<SolutionPage type="ngos" path="/solutions/ngos"/>}/><Route path="/solutions/education" element={<SolutionPage type="education" path="/solutions/education"/>}/><Route path="/security" element={<SecurityPage/>}/><Route path="/about" element={<AboutPage/>}/><Route path="/contact" element={<ContactPage/>}/><Route path="/privacy" element={<PrivacyPage/>}/><Route path="/terms" element={<TermsPage/>}/>
<Route path="/login" element={<Login/>}/><Route path="/signup" element={<Signup/>}/>
<Route path="/survey/:token" element={<SurveyPublic/>}/><Route path="/assessment/:token" element={<AssessmentPublic/>}/><Route path="/certificate/:token" element={<CertificatePublic/>}/><Route path="/register/:token" element={<RegisterPublic/>}/><Route path="/checkin/:token" element={<AttendancePublic/>}/><Route path="/join/:token" element={<JoinTeam/>}/>
<Route path="/app" element={<ProtectedRoute><AppLayout/></ProtectedRoute>}><Route index element={<UiPage name="dashboard"><Dashboard/></UiPage>}/><Route path="activities" element={<UiPage name="activities"><Activities/></UiPage>}/><Route path="activities/:id" element={<UiPage name="activity-detail"><ActivityDetailFrame/></UiPage>}/><Route path="participants" element={<UiPage name="participants"><ParticipantsFrame/></UiPage>}/><Route path="certificates" element={<UiPage name="certificates"><Certificates/></UiPage>}/><Route path="communications" element={<UiPage name="communications"><Communications/></UiPage>}/><Route path="communication" element={<Navigate to="/app/communications" replace/>}/><Route path="reports" element={<UiPage name="reports"><Reports/></UiPage>}/><Route path="surveys" element={<UiPage name="surveys"><Surveys/></UiPage>}/><Route path="assessments" element={<UiPage name="assessments"><Assessments/></UiPage>}/><Route path="settings" element={<UiPage name="settings"><Settings/></UiPage>}/><Route path="billing" element={<UiPage name="billing"><BillingPage/></UiPage>}/><Route path="account" element={<UiPage name="account"><MyAccount/></UiPage>}/><Route path="checkout" element={<UiPage name="checkout"><BillingCheckout/></UiPage>}/><Route path="team" element={<UiPage name="team"><Team/></UiPage>}/><Route path="admin/billing" element={<UiPage name="billing-admin"><BillingAdmin/></UiPage>}/></Route>
</Routes>}
