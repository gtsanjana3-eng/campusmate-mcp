import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/services/apiClient';
import type { AsyncState } from './useAsync';

const isUnauthorized = (error: Error) => error instanceof ApiError && error.status === 401;

/**
 * Like useAsync, but refreshes every `intervalMs` while the tab is visible, so pages show what the
 * AI just proposed or did. It keeps showing the last data while refreshing (no flicker), and stops
 * polling after a 401 so a logged-out page doesn't keep asking.
 * `fn` must be stable (a module-level service function or wrapped in useCallback).
 */
export function usePolling<T>(
  fn: () => Promise<T>,
  intervalMs = 5000,
): AsyncState<T> & { refresh: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const isStopped = state.status === 'error' && isUnauthorized(state.error);

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
    // `tick` is read by no code: changing it is what re-runs the effect on refresh.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [fn, tick]);

  useEffect(() => {
    if (isStopped) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, isStopped, refresh]);

  return { ...state, refresh };
}
