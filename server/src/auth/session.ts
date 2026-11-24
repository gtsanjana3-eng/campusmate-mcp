import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { AppError, unauthorized } from '../domain/errors.ts';

export const SESSION_COOKIE = 'cm_session';
/** Sessions last 12 hours (audit M3: was 7 days). */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

const sign = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url');

const sameDigest = (a: string, b: string) =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

/** Cookie value: `<issued at, ms>.<HMAC of issued at>`. Holds no personal data. */
export function createSessionValue(secret: string, nowMs = Date.now()): string {
  const issued = String(nowMs);
  return `${issued}.${sign(secret, issued)}`;
}

/**
 * Valid when correctly signed, younger than the TTL, and issued at or after `validFromMs`. Logging
 * out moves `validFromMs` forward on the server, so a copied cookie stops working (audit M3).
 */
export function isValidSession(
  value: string | undefined,
  secret: string,
  nowMs = Date.now(),
  validFromMs = 0,
) {
  if (!value) return false;
  const [issued, signature, extra] = value.split('.');
  if (!issued || !signature || extra !== undefined || !/^\d+$/.test(issued)) return false;
  if (!sameDigest(signature, sign(secret, issued))) return false;
  const issuedMs = Number(issued);
  return (
    issuedMs >= validFromMs && issuedMs + SESSION_TTL_SECONDS * 1000 > nowMs && issuedMs <= nowMs
  );
}

export const passcodeMatches = (given: string, expected: string) => sameDigest(given, expected);

export function startSession(c: Context, secret: string, nowMs = Date.now()) {
  setCookie(c, SESSION_COOKIE, createSessionValue(secret, nowMs), {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function endSession(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true });
}

/** `validFromMs` reads the server-side revocation point (see logout). */
export function requireSession(secret: string, validFromMs: () => number): MiddlewareHandler {
  return async (c, next) => {
    if (!isValidSession(getCookie(c, SESSION_COOKIE), secret, Date.now(), validFromMs())) {
      throw unauthorized();
    }
    await next();
  };
}

/**
 * State-changing requests must be JSON. Browsers can't send cross-site JSON without a CORS
 * preflight, so together with SameSite=Strict this blocks cross-site request forgery.
 */
export const requireJsonForWrites: MiddlewareHandler = async (c, next) => {
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method);
  const isJson = c.req.header('Content-Type')?.toLowerCase().startsWith('application/json');
  const hasBody = c.req.method !== 'DELETE';
  if (isWrite && hasBody && !isJson) {
    throw new AppError('unsupported_media_type', 415, 'Requests must be JSON.');
  }
  await next();
};
