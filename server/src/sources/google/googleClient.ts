/**
 * Minimal Google client for the one approved integration: adding approved reminders to a
 * "CampusMate" calendar. Uses only the `calendar.app.created` scope, so CampusMate can create its
 * own calendar and manage events in it, and cannot see the student's other calendars or events.
 * Docs: https://developers.google.com/calendar/api/auth
 */

export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

const TIMEOUT_MS = 8000;
const RETRY_DELAYS_MS = [300, 900];

/** Why a Google call failed, in terms the rest of CampusMate acts on. */
export class GoogleError extends Error {
  /** `reauth`: the student must reconnect (expired or revoked); `unavailable`: try again later. */
  readonly kind: 'reauth' | 'unavailable' | 'rejected';

  constructor(kind: GoogleError['kind'], message: string) {
    super(message);
    this.name = 'GoogleError';
    this.kind = kind;
  }
}

export type GoogleClientOptions = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Injected so tests can use a simulated Google; production uses the global fetch. */
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

export type Tokens = { accessToken: string; refreshToken?: string; scope: string };

export function createGoogleClient(options: GoogleClientOptions) {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  /** One HTTP call with a timeout; retries network errors, 429 and 5xx with backoff. */
  async function request(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      let response: Response | undefined;
      try {
        response = await doFetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
      } catch {
        response = undefined;
      }
      const retryable = !response || response.status === 429 || response.status >= 500;
      if (!retryable) return response as Response;
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) {
        throw new GoogleError('unavailable', 'Google Calendar is not responding right now.');
      }
      await sleep(delay);
    }
  }

  async function tokenRequest(params: Record<string, string>): Promise<Tokens> {
    const response = await request(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: options.clientId,
        client_secret: options.clientSecret,
        ...params,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      // invalid_grant = the refresh token expired (7 days in testing mode) or was revoked.
      if (body.error === 'invalid_grant') {
        throw new GoogleError('reauth', 'Google access expired or was revoked. Please reconnect.');
      }
      throw new GoogleError('rejected', 'Google did not accept the sign-in.');
    }
    return {
      accessToken: String(body.access_token),
      ...(typeof body.refresh_token === 'string' ? { refreshToken: body.refresh_token } : {}),
      scope: String(body.scope ?? ''),
    };
  }

  async function calendarCall<T>(accessToken: string, path: string, body: unknown): Promise<T> {
    const response = await request(`${CALENDAR_API}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.status === 401) throw new GoogleError('reauth', 'Google access token expired.');
    if (response.status === 403 || response.status === 404) {
      throw new GoogleError('reauth', 'CampusMate no longer has access to its Google calendar.');
    }
    if (!response.ok) throw new GoogleError('rejected', 'Google Calendar rejected the request.');
    return (await response.json()) as T;
  }

  return {
    /** Where to send the student to approve access. `state` ties the reply to this request. */
    authUrl(state: string): string {
      const params = new URLSearchParams({
        client_id: options.clientId,
        redirect_uri: options.redirectUri,
        response_type: 'code',
        scope: GOOGLE_SCOPE,
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'false',
        state,
      });
      return `${AUTH_URL}?${params}`;
    },

    exchangeCode: (code: string) =>
      tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: options.redirectUri }),

    refresh: (refreshToken: string) =>
      tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken }),

    async createCalendar(accessToken: string): Promise<{ id: string; summary: string }> {
      return calendarCall(accessToken, '/calendars', {
        summary: 'CampusMate',
        description: 'Reminders you approved in CampusMate.',
        timeZone: 'Asia/Kolkata',
      });
    },

    /** Only the reminder text and time are sent; no other student data. */
    async insertReminder(
      accessToken: string,
      calendarId: string,
      reminder: { text: string; remindAt: string },
    ): Promise<{ id: string }> {
      const end = new Date(Date.parse(reminder.remindAt) + 15 * 60_000).toISOString();
      return calendarCall(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
        summary: reminder.text,
        start: { dateTime: reminder.remindAt, timeZone: 'Asia/Kolkata' },
        end: { dateTime: end, timeZone: 'Asia/Kolkata' },
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
      });
    },

    /** Best effort: tell Google to drop the grant. */
    async revoke(token: string): Promise<void> {
      await request(REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      }).catch(() => undefined);
    },
  };
}

export type GoogleClient = ReturnType<typeof createGoogleClient>;
