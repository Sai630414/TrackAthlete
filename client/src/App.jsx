import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from './components/ui/tooltip';
import { ToastProvider } from './components/ui/use-toast';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import ParentDashboard from './pages/ParentDashboard';
import AthleteDashboard from './pages/AthleteDashboard';
import AthleteRecommendationsPage from './pages/AthleteRecommendationsPage';
import CoachDashboard from './pages/CoachDashboard';
import SponsorDashboard from './pages/SponsorDashboard';
import AcademyDashboard from './pages/AcademyDashboard';
import Login from './pages/Login';
import FederationLogin from './pages/FederationLogin';
import FederationDashboard from './pages/FederationDashboard';
import VerificationPortal from './pages/VerificationPortal';
import OrganizerLogin from './pages/OrganizerLogin';
import OrganizerDashboard from './pages/OrganizerDashboard';

import HomePage from './pages/HomePage';

const routeForRole = {
  parent: '/parent',
  athlete: '/athlete',
  coach: '/coach',
  sponsor: '/sponsor',
  academy: '/academy',
  admin: '/academy',
  federation: '/federation/dashboard',
  organizer: '/organizer'
};

function ProtectedApp() {
  const { user } = useAuth();
  const destination = routeForRole[user?.role] || '/parent';
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'federation') {
    return <FederationDashboard />;
  }
  if (user.role === 'organizer') return <OrganizerDashboard />;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/parent" element={user.role === 'parent' ? <ParentDashboard /> : <Navigate to={destination} replace />} />
          <Route path="/athlete" element={user.role === 'athlete' ? <AthleteDashboard /> : <Navigate to={destination} replace />} />
          <Route path="/athlete/recommendations" element={user.role === 'athlete' ? <AthleteRecommendationsPage /> : <Navigate to={destination} replace />} />
          <Route path="/coach" element={user.role === 'coach' ? <CoachDashboard /> : <Navigate to={destination} replace />} />
          <Route path="/sponsor" element={user.role === 'sponsor' ? <SponsorDashboard /> : <Navigate to={destination} replace />} />
          <Route path="/academy" element={['academy', 'admin'].includes(user.role) ? <AcademyDashboard /> : <Navigate to={destination} replace />} />
          <Route path="*" element={<Navigate to={destination} replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <TooltipProvider delayDuration={120}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Login initialMode="signup" />} />
            <Route path="/federation/login" element={<FederationLogin />} />
            <Route path="/federation/dashboard" element={<FederationDashboard />} />
            <Route path="/organizer/login" element={<OrganizerLogin />} />
            <Route path="/organizer" element={<OrganizerDashboard />} />
            <Route path="/verify/:recordId" element={<VerificationPortal />} />
            <Route path="/*" element={<ProtectedApp />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ToastProvider>
  );
}
