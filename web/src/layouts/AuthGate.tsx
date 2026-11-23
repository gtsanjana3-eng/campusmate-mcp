import { Navigate, Outlet, useLocation } from 'react-router';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { ROUTES } from '@/config/routes';
import { useAsync } from '@/hooks/useAsync';
import { isLoggedIn } from '@/services/sessionService';

/** Renders its child routes only for a logged-in student; otherwise sends them to log in. */
export function AuthGate() {
  const session = useAsync(isLoggedIn);
  const location = useLocation();

  if (session.status === 'loading') {
    return (
      <div className="container">
        <StatusMessage variant="loading" title="Checking your session…" />
      </div>
    );
  }
  if (session.status === 'error') {
    return (
      <div className="container">
        <StatusMessage variant="error" title="CampusMate couldn't be reached.">
          <p>Check your connection and reload the page.</p>
        </StatusMessage>
      </div>
    );
  }
  if (!session.data) {
    return <Navigate to={ROUTES.login} replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
