import { useCallback, useEffect, useState } from 'react';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: Error };

/**
 * Runs an async function on mount and tracks loading/success/error.
 * `fn` must be stable (a module-level service function or wrapped in useCallback).
 */
export function useAsync<T>(fn: () => Promise<T>): AsyncState<T> & { retry: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isActive = true;
    fn().then(
      (data) => {
        if (isActive) setState({ status: 'success', data });
      },
      (error: unknown) => {
        if (isActive) {
          setState({
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      },
    );
    return () => {
      isActive = false;
    };
    // `attempt` is read by no code: changing it is what re-runs the effect on retry.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [fn, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
