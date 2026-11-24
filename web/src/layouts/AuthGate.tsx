import { Navigate, Outlet, useLocation } from 'react-router';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { ROUTES } from '@/config/routes';
import { DEMO_NOTICE } from '@/config/site';
import { useAsync } from '@/hooks/useAsync';
import { getSession } from '@/services/sessionService';
import styles from './AuthGate.module.css';

/**
 * Renders its child routes only for a logged-in student; otherwise sends them to log in.
 * Above every page it shows whose dashboard this is (from the server) and that the data is a demo.
 */
export function AuthGate() {
  const session = useAsync(getSession);
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
  const { name, college } = session.data.student;
  return (
    <>
      <section className={`container ${styles.strip}`} aria-label="Student">
        <span className={styles.avatar} aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className={styles.who}>
          <span className={styles.name}>{name}</span>
          {college && <span className={styles.college}>{college}</span>}
        </span>
        <p className={styles.demo}>
          <strong>Demo</strong> {DEMO_NOTICE}
        </p>
      </section>
      <Outlet />
    </>
  );
}
