/**
 * Slows down passcode guessing (audit H2). Two limits over a sliding window:
 * - per client: after `perClient` failures, that client is locked out for `lockMs`;
 * - overall: after `overall` failures from anyone, every login is paused for `lockMs`, which also
 *   stops guessing spread over many addresses.
 * A successful login clears that client's failures. Counts live in memory (one server process).
 */
export function createLoginLimiter(
  options: {
    perClient?: number;
    overall?: number;
    windowMs?: number;
    lockMs?: number;
    now?: () => number;
  } = {},
) {
  const perClient = options.perClient ?? 5;
  const overall = options.overall ?? 30;
  const windowMs = options.windowMs ?? 15 * 60_000;
  const lockMs = options.lockMs ?? 15 * 60_000;
  const now = options.now ?? Date.now;

  const failures = new Map<string, number[]>();
  const lockedUntil = new Map<string, number>();
  let allFailures: number[] = [];
  let globalLockUntil = 0;

  const recent = (times: number[]) => times.filter((t) => now() - t < windowMs);

  return {
    /** Seconds to wait, or 0 if this client may try now. */
    retryAfterSeconds(client: string): number {
      const until = Math.max(lockedUntil.get(client) ?? 0, globalLockUntil);
      return until > now() ? Math.ceil((until - now()) / 1000) : 0;
    },

    recordFailure(client: string): void {
      const mine = [...recent(failures.get(client) ?? []), now()];
      failures.set(client, mine);
      if (mine.length >= perClient) lockedUntil.set(client, now() + lockMs);

      allFailures = [...recent(allFailures), now()];
      if (allFailures.length >= overall) globalLockUntil = now() + lockMs;
    },

    recordSuccess(client: string): void {
      failures.delete(client);
      lockedUntil.delete(client);
    },
  };
}

export type LoginLimiter = ReturnType<typeof createLoginLimiter>;
