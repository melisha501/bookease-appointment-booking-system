// ProtectedRoute — guards authenticated pages.
// Waits for session restore (token -> /api/auth/me) before redirecting.
// Optionally enforces a role (e.g. ADMIN for /admin routes).

import { Navigate, useLocation } from 'react-router-dom';
import { useDemo } from '../store/DemoContext';

export default function ProtectedRoute({ children, role }) {
  const { isLoggedIn, isAdmin, authLoading, user } = useDemo();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4 text-sm text-ink-soft">
        Checking your session…
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (role === 'ADMIN' && !isAdmin) {
    return <Navigate to="/customer" replace />;
  }

  if (role === 'CUSTOMER' && user?.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
