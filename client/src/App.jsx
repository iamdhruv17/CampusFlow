import { Navigate, Route, Routes, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthLayout from './components/AuthLayout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import StudentRequestsPage from './pages/student/StudentRequestsPage';
import NewRequestPage from './pages/student/NewRequestPage';
import RequestDetailsPage from './pages/student/RequestDetailsPage';
import ResubmitRequestPage from './pages/student/ResubmitRequestPage';
import StaffDashboardPage from './pages/staff/StaffDashboardPage';
import ApprovalDetailPage from './pages/staff/ApprovalDetailPage';

function WorkspaceLayout() {
  const { user, logout } = useAuth(); const navigate = useNavigate();
  const signOut = async () => { try { await logout(); navigate('/login', { replace: true }); } catch { navigate('/login', { replace: true }); } };
  return <div className="workspace"><header className="topbar"><Link to="/dashboard" className="brand"><span className="brand-mark">C</span> CampusFlow</Link><nav><Link to="/dashboard">Overview</Link>{user?.role === 'student' && <Link to="/student/requests">My requests</Link>}{['teacher','mentor','coordinator','hod','dean'].includes(user?.role) && <Link to="/staff/approvals">Approvals</Link>}<Link to="/profile">Profile</Link></nav><div className="user-menu"><span className="user-avatar">{user?.name?.charAt(0)?.toUpperCase()}</span><span className="user-name">{user?.name}</span><button className="logout-button" onClick={signOut}>Log out</button></div></header><main><Routes><Route path="/dashboard" element={<DashboardPage/>}/><Route path="/staff/approvals" element={<StaffDashboardPage/>}/><Route path="/staff/requests/:id" element={<ApprovalDetailPage/>}/><Route path="/profile" element={<ProfilePage/>}/><Route path="/student/requests" element={<StudentRequestsPage/>}/><Route path="/student/requests/new" element={<NewRequestPage/>}/><Route path="/student/requests/:id" element={<RequestDetailsPage/>}/><Route path="/student/requests/:id/resubmit" element={<ResubmitRequestPage/>}/></Routes></main><footer className="workspace-footer">CampusFlow · Academic Request & Approval System</footer></div>;
}
function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-center">Loading CampusFlow…</div>;
  return <Routes><Route element={<AuthLayout/>}><Route path="/login" element={user ? <Navigate to="/dashboard" replace/> : <LoginPage/>}/><Route path="/register" element={user ? <Navigate to="/dashboard" replace/> : <RegisterPage/>}/></Route><Route element={<ProtectedRoute/>}><Route path="/*" element={<WorkspaceLayout/>}/></Route><Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>;
}
export default function App() { return <AuthProvider><AppRoutes/></AuthProvider>; }
