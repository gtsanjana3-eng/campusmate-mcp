import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ROUTES } from '@/config/routes';
import { logout } from '@/services/sessionService';

/** Ends the session and returns to the login page, even if the server is unreachable. */
export function useLogout() {
  const navigate = useNavigate();
  return useCallback(async () => {
    await logout().catch(() => undefined);
    await navigate(ROUTES.login, { replace: true });
  }, [navigate]);
}
