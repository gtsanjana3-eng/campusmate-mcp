import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const COST = 16384;
const KEY_LENGTH = 32;

/** One-way hash for storage: `scrypt$<cost>$<salt>$<hash>`, all from node:crypto. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH, { N: COST });
  return ['scrypt', COST, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

/** Constant-time check of a password against a stored hash; false for anything malformed. */
export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, cost, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !cost || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  if (expected.length !== KEY_LENGTH) return false;
  const actual = scryptSync(password, Buffer.from(salt, 'base64url'), KEY_LENGTH, {
    N: Number(cost),
  });
  return timingSafeEqual(actual, expected);
}

/** Checked when an email is unknown, so a wrong email takes as long as a wrong password. */
export const UNUSED_HASH = hashPassword(randomBytes(16).toString('hex'));
