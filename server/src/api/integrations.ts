import { randomBytes } from 'node:crypto';
import { Hono, type MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type {
  ConnectIntegrationResponse,
  IntegrationsResponse,
} from '../../../shared/types/index.ts';
import type { CalendarIntegration } from '../domain/integrations.ts';
import { log } from '../lib/logger.ts';

const STATE_COOKIE = 'cm_oauth_state';
const STATE_TTL_MS = 10 * 60_000;

/**
 * Google Calendar connection, mounted at /api/integrations.
 *
 * The callback can't rely on the session cookie: it is SameSite=Strict, so the browser drops it on
 * the redirect back from Google. Instead, /connect (which needs a session) issues a single-use
 * random `state`, remembered here and in a short-lived Lax cookie; the callback must match both.
 */
export function createIntegrationRoutes(calendar: CalendarIntegration, session: MiddlewareHandler) {
  const api = new Hono();
  const pendingStates = new Map<string, number>();

  api.get('/', session, (c) => c.json<IntegrationsResponse>({ integrations: [calendar.status()] }));

  api.post('/google/connect', session, (c) => {
    const now = Date.now();
    for (const [state, expires] of pendingStates) if (expires < now) pendingStates.delete(state);

    const state = randomBytes(24).toString('base64url');
    const authUrl = calendar.authUrl(state); // throws 409 when Google isn't configured
    pendingStates.set(state, now + STATE_TTL_MS);
    setCookie(c, STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/api/integrations/google',
      maxAge: STATE_TTL_MS / 1000,
    });
    return c.json<ConnectIntegrationResponse>({ authUrl });
  });

  api.get('/google/callback', async (c) => {
    const { state, code, error } = c.req.query();
    const cookieState = getCookie(c, STATE_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: '/api/integrations/google', secure: true });

    const expires = state ? pendingStates.get(state) : undefined;
    if (state) pendingStates.delete(state);
    const isValid =
      Boolean(state) && state === cookieState && expires !== undefined && expires > Date.now();

    if (!isValid) {
      log.info('integration.callback_rejected', { reason: 'state' });
      return c.redirect('/connect?google=error');
    }
    if (error || !code) return c.redirect('/connect?google=denied');

    try {
      await calendar.complete(code);
      return c.redirect('/connect?google=connected');
    } catch (failure) {
      log.error('integration.callback_failed', failure);
      return c.redirect('/connect?google=error');
    }
  });

  api.delete('/google', session, async (c) => {
    await calendar.disconnect();
    return c.body(null, 204);
  });

  return api;
}
