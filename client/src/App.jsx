import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from './components/ui/tooltip';
import { ToastProvider } from './components/ui/use-toast';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import ParentDashboard from './pages/ParentDashboard';
import AthleteDashboard from './pages/AthleteDashboard';
import CoachDashboard from './pages/CoachDashboard';
import SponsorDashboard from './pages/SponsorDashboard';
import AcademyDashboard from './pages/AcademyDashboard';
import Login from './pages/Login';

const routeForRole = { parent: '/parent', athlete: '/athlete', coach: '/coach', sponsor: '/sponsor', academy: '/academy', admin: '/academy' };

function ProtectedApp() {
  const { user } = useAuth();
  const destination = routeForRole[user?.role] || '/parent';
  if (!user) return <Navigate to="/login" replace />;
  return <div className="app-shell"><Sidebar /><main className="app-main"><Routes>
    <Route path="/" element={<Navigate to={destination} replace />} />
    <Route path="/parent" element={user.role === 'parent' ? <ParentDashboard /> : <Navigate to={destination} replace />} />
    <Route path="/athlete" element={user.role === 'athlete' ? <AthleteDashboard /> : <Navigate to={destination} replace />} />
    <Route path="/coach" element={user.role === 'coach' ? <CoachDashboard /> : <Navigate to={destination} replace />} />
    <Route path="/sponsor" element={user.role === 'sponsor' ? <SponsorDashboard /> : <Navigate to={destination} replace />} />
    <Route path="/academy" element={['academy', 'admin'].includes(user.role) ? <AcademyDashboard /> : <Navigate to={destination} replace />} />
  </Routes></main></div>;
}

export default function App() {
  return <ToastProvider><TooltipProvider delayDuration={120}><BrowserRouter><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/*" element={<ProtectedApp />} />
  </Routes></BrowserRouter></TooltipProvider></ToastProvider>;
}
