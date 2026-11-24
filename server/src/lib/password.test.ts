import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.ts';

describe('password hashing', () => {
  it('verifies the right password only, and never stores it in plain text', () => {
    const stored = hashPassword('correct horse battery');
    expect(stored.startsWith('scrypt$16384$')).toBe(true);
    expect(stored).not.toContain('correct horse battery');
    expect(verifyPassword('correct horse battery', stored)).toBe(true);
    expect(verifyPassword('correct horse batterY', stored)).toBe(false);
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });

  it('rejects malformed stored values', () => {
    expect(verifyPassword('x', 'plain-text')).toBe(false);
    expect(verifyPassword('x', 'md5$1$a$b')).toBe(false);
    expect(verifyPassword('x', 'scrypt$16384$c2FsdA$c2hvcnQ')).toBe(false);
  });
});
