import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { ROUTES } from '@/config/routes';
import { ApiError } from '@/services/apiClient';

type ErrorStateProps = {
  /** What failed to load, e.g. "Your approvals". */
  what: string;
  error: Error;
  onRetry?: () => void;
};

/** One consistent error panel: an expired session links to login; other errors offer a retry. */
export function ErrorState({ what, error, onRetry }: ErrorStateProps) {
  if (error instanceof ApiError && error.status === 401) {
    return (
      <StatusMessage variant="error" title="Your session has ended.">
        <Link to={ROUTES.login}>Log in again</Link>
      </StatusMessage>
    );
  }
  return (
    <StatusMessage variant="error" title={`${what} couldn't be loaded.`}>
      {error instanceof ApiError && <p>{error.message}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </StatusMessage>
  );
}
