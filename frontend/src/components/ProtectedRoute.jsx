// ProtectedRoute — guards authenticated pages.
// Waits for session restore (token -> /api/auth/me) before redirecting.
// Optionally enforces a role (e.g. ADMIN for /admin routes).

import { Navigate, useLocation } from 'react-router-dom';
import { useDemo } from '../store/DemoContext';

function SessionSkeleton() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4" aria-busy="true" aria-live="polite">
      <div className="w-full max-w-md space-y-4 text-center">
        <span className="sr-only">Checking your session…</span>
        <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-slate-200" />
        <div className="mx-auto h-3 w-40 animate-pulse rounded-full bg-slate-200" />
        <div className="mx-auto h-3 w-56 animate-pulse rounded-full bg-slate-100" />
        <p className="text-sm text-ink-soft">Checking your session…</p>
      </div>
    </div>
  );
}

function dashboardForRole(role) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'PROVIDER') return '/provider';
  return '/customer';
}

export default function ProtectedRoute({ children, role }) {
  const { isLoggedIn, authLoading, user } = useDemo();
  const location = useLocation();

  if (authLoading) return <SessionSkeleton />;

  if (!isLoggedIn) {
    const loginTo = role === 'PROVIDER' ? '/provider/login' : '/login';
    return <Navigate to={loginTo} replace state={{ from: location }} />;
  }

  if (role && user?.role !== role) {
    return <Navigate to={dashboardForRole(user?.role)} replace />;
  }

  return children;
}
