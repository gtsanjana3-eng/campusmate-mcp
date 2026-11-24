import { useEffect, useState } from 'react';
import { APPROVALS_CHANGED, getPendingCount } from '@/services/approvalService';
import { usePolling } from './usePolling';

// null, not 0: a logged-out "count" must never become the baseline for announcements.
const none = async () => null;

/**
 * How many actions wait for approval: refreshed every 5 s, and immediately after the student
 * decides on one. Pass `enabled: false` when logged out. `announcement` says when new ones
 * arrive, for a screen-reader live region; the first count after loading is not announced.
 */
export function usePendingCount(enabled: boolean): { count: number; announcement: string } {
  const polled = usePolling(enabled ? getPendingCount : none);
  const { refresh } = polled;
  const count = polled.status === 'success' ? polled.data : null;
  const [seen, setSeen] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');

  // Adjusting state while rendering: React's pattern for reacting to a changed value.
  if (count !== seen) {
    setSeen(count);
    if (count !== null && seen !== null && count > seen) {
      const added = count - seen;
      setAnnouncement(
        `${added} new ${added === 1 ? 'approval' : 'approvals'} waiting for you, ${count} in total.`,
      );
    }
  }

  useEffect(() => {
    window.addEventListener(APPROVALS_CHANGED, refresh);
    return () => window.removeEventListener(APPROVALS_CHANGED, refresh);
  }, [refresh]);

  return { count: count ?? 0, announcement };
}
