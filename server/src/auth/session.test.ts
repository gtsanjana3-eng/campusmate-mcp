import { describe, expect, it } from 'vitest';
import {
  createSessionValue,
  isValidSession,
  passcodeMatches,
  SESSION_TTL_SECONDS,
} from './session.ts';

const SECRET = 'x'.repeat(40);
const NOW = Date.UTC(2026, 10, 24);

describe('session cookie', () => {
  it('accepts a value it signed', () => {
    expect(isValidSession(createSessionValue(SECRET, NOW), SECRET, NOW)).toBe(true);
  });

  it('rejects a tampered expiry', () => {
    const [, signature] = createSessionValue(SECRET, NOW).split('.');
    expect(isValidSession(`99999999999.${signature}`, SECRET, NOW)).toBe(false);
  });

  it('rejects a value signed with another secret', () => {
    expect(isValidSession(createSessionValue('y'.repeat(40), NOW), SECRET, NOW)).toBe(false);
  });

  it('rejects an expired session', () => {
    const value = createSessionValue(SECRET, NOW);
    expect(isValidSession(value, SECRET, NOW + (SESSION_TTL_SECONDS + 1) * 1000)).toBe(false);
  });

  it('rejects missing and malformed values', () => {
    for (const value of [undefined, '', 'abc', '1.2.3', 'x.y']) {
      expect(isValidSession(value, SECRET, NOW)).toBe(false);
    }
  });
});

describe('passcode', () => {
  it('matches only the exact passcode', () => {
    expect(passcodeMatches('letmein', 'letmein')).toBe(true);
    expect(passcodeMatches('letmein ', 'letmein')).toBe(false);
    expect(passcodeMatches('', 'letmein')).toBe(false);
  });
});

describe('server-side revocation (audit M3)', () => {
  it('lasts 12 hours', () => {
    expect(SESSION_TTL_SECONDS).toBe(12 * 60 * 60);
  });

  it('rejects sessions issued before the revocation point, accepts newer ones', () => {
    const value = createSessionValue(SECRET, NOW);
    expect(isValidSession(value, SECRET, NOW + 1000, NOW + 1)).toBe(false);
    expect(isValidSession(value, SECRET, NOW + 1000, NOW)).toBe(true);
  });

  it('rejects a session claiming to be issued in the future', () => {
    expect(isValidSession(createSessionValue(SECRET, NOW + 60_000), SECRET, NOW)).toBe(false);
  });
});
