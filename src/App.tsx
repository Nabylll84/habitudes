import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Layout } from '@/components/Layout';
import Login from '@/views/Login';
import Journal from '@/views/Journal';
import Habits from '@/views/Habits';
import Friends from '@/views/Friends';
import FriendProfile from '@/views/FriendProfile';
import Stats from '@/views/Stats';
import AuthCallback from '@/views/AuthCallback';

function Splash() {
  return (
    <div className="splash">
      <div className="splash-logo">⚡</div>
      <div className="splash-bar"><i /></div>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { search } = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to={`/auth${search}`} replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Journal />} />
        <Route path="/habits" element={<Habits />} />
        <Route path="/amis" element={<Friends />} />
        <Route path="/u/:id" element={<FriendProfile />} />
        <Route path="/stats" element={<Stats />} />
      </Route>
      <Route path="*" element={<Navigate to={loading || !user ? '/auth' : '/'} replace />} />
    </Routes>
  );
}