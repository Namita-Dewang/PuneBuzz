import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { PageSkeleton } from './Skeletons';

// Wrap routes that need a logged-in user (optionally with a role):
//   <Route element={<ProtectedRoute roles={['organizer', 'admin']} />}>...</Route>
// Logged-out users go to /login and come back here afterwards.
export default function ProtectedRoute({ roles }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageSkeleton label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
