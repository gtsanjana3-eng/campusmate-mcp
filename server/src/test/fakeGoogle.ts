import { GOOGLE_SCOPE } from '../sources/google/googleClient.ts';

type Call = { url: string; method: string; body: string; auth: string | null };

const json = (body: unknown, status = 200) => Response.json(body, { status });

/**
 * A simulated Google for tests: OAuth token, calendar and revoke endpoints, with switches to
 * reproduce expiry, revocation, outages and missing scopes. It records every call it receives.
 */
export function fakeGoogle() {
  const calls: Call[] = [];
  const state = {
    /** Access tokens Google currently accepts. */
    validAccess: new Set<string>(),
    issued: 0,
    refreshValid: true,
    grantedScope: GOOGLE_SCOPE,
    returnRefreshToken: true,
    /** Number of upcoming calendar calls that answer 503. */
    outages: 0,
    /** Calendar calls answer 403 (access removed in Google settings). */
    calendarRevoked: false,
    /** Calendar calls never answer; they end only when the caller's timeout aborts them. */
    hang: false,
  };

  const issue = () => {
    const token = `access-${++state.issued}`;
    state.validAccess.add(token);
    return token;
  };

  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? String(init.body) : '';
    const auth = new Headers(init?.headers).get('Authorization');
    calls.push({ url, method: init?.method ?? 'GET', body, auth });

    if (url === 'https://oauth2.googleapis.com/token') {
      const params = new URLSearchParams(body);
      if (params.get('grant_type') === 'authorization_code') {
        if (params.get('code') !== 'good-code') return json({ error: 'invalid_grant' }, 400);
        return json({
          access_token: issue(),
          expires_in: 3599,
          scope: state.grantedScope,
          ...(state.returnRefreshToken ? { refresh_token: 'refresh-secret-123' } : {}),
        });
      }
      if (!state.refreshValid || params.get('refresh_token') !== 'refresh-secret-123') {
        return json(
          { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' },
          400,
        );
      }
      return json({ access_token: issue(), expires_in: 3599, scope: state.grantedScope });
    }

    if (url === 'https://oauth2.googleapis.com/revoke') return new Response(null, { status: 200 });

    if (url.startsWith('https://www.googleapis.com/calendar/v3/')) {
      if (state.hang) {
        return new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        );
      }
      if (state.outages > 0) {
        state.outages--;
        return json({ error: { code: 503 } }, 503);
      }
      if (state.calendarRevoked) return json({ error: { code: 403 } }, 403);
      if (!auth || !state.validAccess.has(auth.replace('Bearer ', ''))) {
        return json({ error: { code: 401 } }, 401);
      }
      if (url.endsWith('/calendars')) return json({ id: 'cal-campusmate', summary: 'CampusMate' });
      if (url.endsWith('/events')) return json({ id: `event-${calls.length}` });
    }
    return json({ error: 'unexpected call' }, 500);
  }) as typeof globalThis.fetch;

  return {
    fetch,
    calls,
    state,
    /** Simulates the hourly access-token expiry. */
    expireAccessTokens: () => state.validAccess.clear(),
    eventCalls: () => calls.filter((c) => c.url.endsWith('/events')),
  };
}
