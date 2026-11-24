import { describe, expect, it } from 'vitest';
import {
  createSessionValue,
  isValidSession,
  secretMatches,
  sessionUserId,
  SESSION_TTL_SECONDS,
} from './session.ts';

const SECRET = 'x'.repeat(40);
const NOW = Date.UTC(2026, 10, 24);
const USER = 'u-1a2b3c';

describe('session cookie', () => {
  it('accepts a value it signed and says which user it belongs to', () => {
    expect(sessionUserId(createSessionValue(SECRET, USER, NOW), SECRET, NOW)).toBe(USER);
  });

  it('rejects a tampered user or issue time', () => {
    const [, issued, signature] = createSessionValue(SECRET, USER, NOW).split('.');
    expect(isValidSession(`u-other.${issued}.${signature}`, SECRET, NOW)).toBe(false);
    expect(isValidSession(`${USER}.99999999999.${signature}`, SECRET, NOW)).toBe(false);
  });

  it('rejects a value signed with another secret', () => {
    expect(isValidSession(createSessionValue('y'.repeat(40), USER, NOW), SECRET, NOW)).toBe(false);
  });

  it('rejects an expired session', () => {
    const value = createSessionValue(SECRET, USER, NOW);
    expect(isValidSession(value, SECRET, NOW + (SESSION_TTL_SECONDS + 1) * 1000)).toBe(false);
  });

  it('rejects missing and malformed values, including the old two-part format', () => {
    for (const value of [undefined, '', 'abc', '1.2', 'x.y.z.w', `${NOW}.sig`]) {
      expect(isValidSession(value, SECRET, NOW)).toBe(false);
    }
  });
});

describe('shared secrets', () => {
  it('match only exactly', () => {
    expect(secretMatches('letmein', 'letmein')).toBe(true);
    expect(secretMatches('letmein ', 'letmein')).toBe(false);
    expect(secretMatches('', 'letmein')).toBe(false);
  });
});

describe('server-side revocation (audit M3)', () => {
  it('lasts 12 hours', () => {
    expect(SESSION_TTL_SECONDS).toBe(12 * 60 * 60);
  });

  it('rejects sessions issued before the revocation point, accepts newer ones', () => {
    const value = createSessionValue(SECRET, USER, NOW);
    expect(isValidSession(value, SECRET, NOW + 1000, NOW + 1)).toBe(false);
    expect(isValidSession(value, SECRET, NOW + 1000, NOW)).toBe(true);
  });

  it('rejects a session claiming to be issued in the future', () => {
    expect(isValidSession(createSessionValue(SECRET, USER, NOW + 60_000), SECRET, NOW)).toBe(false);
  });
});
