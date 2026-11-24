import type { ActivityEntry } from '../../../shared/types/index.ts';
import type { Store } from '../data/store.ts';

export const MAX_ACTIVITY = 100;

/** Privacy: the log is for recent oversight, not a permanent record of what the student asked. */
export const ACTIVITY_RETENTION_MS = 30 * 24 * 3_600_000;

/**
 * Records something CampusMate did or refused, in a sentence the student can read, and drops
 * entries older than the retention period.
 */
export function logActivity(store: Store, entry: Omit<ActivityEntry, 'id' | 'at'>): ActivityEntry {
  const now = Date.now();
  store.pruneActivityBefore(new Date(now - ACTIVITY_RETENTION_MS).toISOString());
  return store.addActivity({ ...entry, at: new Date(now).toISOString() });
}

export function listActivity(store: Store, limit = 50): ActivityEntry[] {
  return store.listActivity(Math.min(Math.max(Math.trunc(limit), 1), MAX_ACTIVITY));
}
