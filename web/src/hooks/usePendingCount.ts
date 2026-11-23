import { useEffect } from 'react';
import { APPROVALS_CHANGED, getPendingCount } from '@/services/approvalService';
import { usePolling } from './usePolling';

const none = async () => 0;

/**
 * How many actions wait for approval: refreshed every 5 s, and immediately after the student
 * decides on one. Pass `enabled: false` when logged out.
 */
export function usePendingCount(enabled: boolean): number {
  const count = usePolling(enabled ? getPendingCount : none);
  const { refresh } = count;

  useEffect(() => {
    window.addEventListener(APPROVALS_CHANGED, refresh);
    return () => window.removeEventListener(APPROVALS_CHANGED, refresh);
  }, [refresh]);

  return count.status === 'success' ? count.data : 0;
}
