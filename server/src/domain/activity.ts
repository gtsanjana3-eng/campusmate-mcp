import type { ActivityEntry } from '../../../shared/types/index.ts';
import type { Store } from '../data/store.ts';

export const MAX_ACTIVITY = 100;

/** Records something CampusMate did or refused, in a sentence the student can read. */
export function logActivity(store: Store, entry: Omit<ActivityEntry, 'id' | 'at'>): ActivityEntry {
  return store.addActivity({ ...entry, at: new Date().toISOString() });
}

export function listActivity(store: Store, limit = 50): ActivityEntry[] {
  return store.listActivity(Math.min(Math.max(Math.trunc(limit), 1), MAX_ACTIVITY));
}
