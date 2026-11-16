import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Shell } from './components/Shell';
import { useMe } from './lib/auth';
import { LoginPage } from './pages/Login';
import { HomePage } from './pages/Home';
import { SchedulePage } from './pages/Schedule';
import { GradesPage } from './pages/Grades';
import { DisciplinePage } from './pages/Discipline';
import { RequestsPage } from './pages/Requests';
import { NewRequestPage } from './pages/NewRequest';
import { RequestPage } from './pages/Request';
import { DocumentPage } from './pages/Document';
import { VerifyPage } from './pages/Verify';
import { NotificationsPage } from './pages/Notifications';
import { ProfilePage } from './pages/Profile';
import { StaffInbox } from './pages/StaffInbox';
import { StaffRequest } from './pages/StaffRequest';
import { StaffAnnouncements } from './pages/StaffAnnouncements';
import { NotFound } from './pages/NotFound';
import { LogoMark } from './components/ui';

function Splash() {
  return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }} aria-busy="true"><div className="splash"><LogoMark size={52} /></div></div>;
}

function Guard({ role, children }: { role: 'student' | 'staff'; children: ReactNode }) {
  const me = useMe();
  const loc = useLocation();
  if (me.isLoading) return <Splash />;
  if (!me.data) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (me.data.role !== role) return <Navigate to={me.data.role === 'staff' ? '/staff' : '/'} replace />;
  return <>{children}</>;
}

export function App() {
  const nav = useNavigate();
  const qc = useQueryClient();
  useEffect(() => {
    const lost = () => { qc.clear(); nav('/login', { replace: true }); };
    window.addEventListener('auth:lost', lost);
    return () => window.removeEventListener('auth:lost', lost);
  }, [nav, qc]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify/:code" element={<VerifyPage />} />
      <Route path="/requests/:id/document" element={<Guard role="student"><DocumentPage /></Guard>} />
      <Route element={<Guard role="student"><Shell /></Guard>}>
        <Route index element={<HomePage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="grades" element={<GradesPage />} />
        <Route path="grades/:id" element={<DisciplinePage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="requests/new" element={<NewRequestPage />} />
        <Route path="requests/new/:type" element={<NewRequestPage />} />
        <Route path="requests/:id" element={<RequestPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route element={<Guard role="staff"><Shell /></Guard>}>
        <Route path="staff" element={<StaffInbox />} />
        <Route path="staff/requests/:id" element={<StaffRequest />} />
        <Route path="staff/announcements" element={<StaffAnnouncements />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
