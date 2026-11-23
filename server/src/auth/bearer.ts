import { createHash, timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Requires `Authorization: Bearer <token>`. Hashing both sides first gives equal-length buffers,
 * so the comparison is constant-time and doesn't reveal the token's length.
 */
export function bearerAuth(expectedToken: string): MiddlewareHandler {
  const expected = digest(expectedToken);
  return async (c, next) => {
    const header = c.req.header('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    if (!token || !timingSafeEqual(digest(token), expected)) {
      return c.json({ error: { code: 'unauthorized', message: 'Missing or invalid token.' } }, 401);
    }
    await next();
  };
}
