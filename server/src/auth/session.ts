import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { AppError, unauthorized } from '../domain/errors.ts';

export const SESSION_COOKIE = 'cm_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const sign = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url');

const sameDigest = (a: string, b: string) =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

/** Cookie value: `<expiry seconds>.<HMAC of expiry>`. Holds no personal data. */
export function createSessionValue(secret: string, nowMs = Date.now()): string {
  const expires = String(Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS);
  return `${expires}.${sign(secret, expires)}`;
}

export function isValidSession(value: string | undefined, secret: string, nowMs = Date.now()) {
  if (!value) return false;
  const [expires, signature, extra] = value.split('.');
  if (!expires || !signature || extra !== undefined || !/^\d+$/.test(expires)) return false;
  if (!sameDigest(signature, sign(secret, expires))) return false;
  return Number(expires) * 1000 > nowMs;
}

export const passcodeMatches = (given: string, expected: string) => sameDigest(given, expected);

export function startSession(c: Context, secret: string) {
  setCookie(c, SESSION_COOKIE, createSessionValue(secret), {
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

export function requireSession(secret: string): MiddlewareHandler {
  return async (c, next) => {
    if (!isValidSession(getCookie(c, SESSION_COOKIE), secret)) throw unauthorized();
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
