import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { describe, expect, it } from 'vitest';
import type { ActionResponse, IntegrationsResponse } from '../../../shared/types/index.ts';
import { createApp } from '../app.ts';
import { parseEnv } from '../config/env.ts';
import { listActivity } from '../domain/activity.ts';
import { propose } from '../domain/approvals.ts';
import { createMcpServer } from '../mcp/createServer.ts';
import { GOOGLE_SCOPE } from '../sources/google/googleClient.ts';
import { fakeGoogle } from '../test/fakeGoogle.ts';
import { login, seededStore, TEST_NOW, testEnv } from '../test/helpers.ts';

const googleEnv = parseEnv({
  MCP_TOKEN: testEnv.MCP_TOKEN,
  DASHBOARD_PASSCODE: testEnv.DASHBOARD_PASSCODE,
  SESSION_SECRET: testEnv.SESSION_SECRET,
  PUBLIC_URL: testEnv.PUBLIC_URL,
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
});

async function setup(options: { configured?: boolean } = {}) {
  const google = fakeGoogle();
  const store = seededStore();
  const app = createApp(options.configured === false ? testEnv : googleEnv, {
    store,
    now: () => TEST_NOW,
    googleFetch: google.fetch,
  });
  const cookie = await login(app);
  const send = (path: string, method = 'GET', extra: Record<string, string> = {}) =>
    app.request(path, {
      method,
      headers: {
        Cookie: cookie,
        ...(method === 'GET' || method === 'DELETE' ? {} : { 'Content-Type': 'application/json' }),
        ...extra,
      },
      ...(method === 'POST' ? { body: '{}' } : {}),
    });
  const status = async () =>
    ((await (await send('/api/integrations')).json()) as IntegrationsResponse).integrations[0]
      ?.state;

  /** Full sign-in round trip; returns where the callback redirected. */
  async function connect(code = 'good-code') {
    const started = await send('/api/integrations/google/connect', 'POST');
    const { authUrl } = (await started.json()) as { authUrl: string };
    const stateCookie = started.headers.get('set-cookie')?.split(';')[0] ?? '';
    const state = new URL(authUrl).searchParams.get('state') ?? '';
    const back = await app.request(
      `/api/integrations/google/callback?state=${state}&code=${code}`,
      { headers: { Cookie: stateCookie } },
    );
    return { authUrl, started, back, location: back.headers.get('location'), state, stateCookie };
  }

  const reminder = (text = 'Submit the OS lab record') =>
    propose(
      store,
      {
        preview: {
          tool: 'create_reminder',
          reminder: { text, remindAt: '2026-11-27T18:00:00+05:30' },
        },
        reason: 'Student asked for a reminder.',
      },
      TEST_NOW,
    ).id;

  const approve = async (id: string) =>
    ((await (await send(`/api/approvals/${id}/approve`, 'POST')).json()) as ActionResponse).action;

  return { app, store, google, send, status, connect, reminder, approve };
}

describe('configuration', () => {
  it('treats empty values as not set, and needs both or neither', () => {
    const base = {
      MCP_TOKEN: 't'.repeat(40),
      DASHBOARD_PASSCODE: 'letmein',
      SESSION_SECRET: 's'.repeat(40),
    };
    expect(
      parseEnv({ ...base, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' }).GOOGLE_CLIENT_ID,
    ).toBeUndefined();
    expect(() => parseEnv({ ...base, GOOGLE_CLIENT_ID: 'only-one' })).toThrow(/both/);
  });
});

describe('when Google is not configured on the server', () => {
  it('says so, refuses to connect, and keeps reminders in CampusMate only', async () => {
    const { status, send, reminder, approve, google, store } = await setup({ configured: false });
    expect(await status()).toBe('not_configured');
    expect((await send('/api/integrations/google/connect', 'POST')).status).toBe(409);

    const action = await approve(reminder());
    expect(action).toMatchObject({ status: 'done', note: expect.stringContaining('not set up') });
    expect(store.count('reminders')).toBe(1);
    expect(google.calls).toHaveLength(0);
  });
});

describe('connecting Google Calendar', () => {
  it('asks only for the narrow scope, with a single-use state in a Lax cookie', async () => {
    const { connect, status } = await setup();
    const { authUrl, started, location } = await connect();
    const url = new URL(authUrl);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('scope')).toBe(GOOGLE_SCOPE);
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://campusmate.example.com/api/integrations/google/callback',
    );
    const cookie = started.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(location).toBe('/connect?google=connected');
    expect(await status()).toBe('connected');
  });

  it('needs a session to start', async () => {
    const { app } = await setup();
    const response = await app.request('/api/integrations/google/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBe(401);
  });

  it('stores the refresh token encrypted, never in plain text', async () => {
    const { connect, store } = await setup();
    await connect();
    const raw = JSON.stringify(store.db.prepare('SELECT * FROM integrations').all());
    expect(raw).not.toContain('refresh-secret-123');
    expect(raw).toContain('cal-campusmate');
  });

  it('rejects a callback without the matching state cookie, or a reused state', async () => {
    const { app, connect, status, google } = await setup();
    const first = await connect();
    const tokenCalls = google.calls.length;

    const noCookie = await app.request(
      `/api/integrations/google/callback?state=${first.state}&code=good-code`,
    );
    expect(noCookie.headers.get('location')).toBe('/connect?google=error');
    const reused = await app.request(
      `/api/integrations/google/callback?state=${first.state}&code=good-code`,
      {
        headers: { Cookie: first.stateCookie },
      },
    );
    expect(reused.headers.get('location')).toBe('/connect?google=error');
    expect(google.calls.length).toBe(tokenCalls);
    expect(await status()).toBe('connected');
  });

  it('handles the student declining on Google', async () => {
    const { app, send, status } = await setup();
    const started = await send('/api/integrations/google/connect', 'POST');
    const { authUrl } = (await started.json()) as { authUrl: string };
    const state = new URL(authUrl).searchParams.get('state');
    const back = await app.request(
      `/api/integrations/google/callback?state=${state}&error=access_denied`,
      {
        headers: { Cookie: started.headers.get('set-cookie')?.split(';')[0] ?? '' },
      },
    );
    expect(back.headers.get('location')).toBe('/connect?google=denied');
    expect(await status()).toBe('disconnected');
  });

  it('refuses to connect if calendar access was not granted, or no long-term access came back', async () => {
    const narrow = await setup();
    narrow.google.state.grantedScope = 'openid';
    expect((await narrow.connect()).location).toBe('/connect?google=error');
    expect(await narrow.status()).toBe('disconnected');

    const short = await setup();
    short.google.state.returnRefreshToken = false;
    expect((await short.connect()).location).toBe('/connect?google=error');
    expect(await short.status()).toBe('disconnected');
  });
});

describe('read-only operations never touch Google', () => {
  it('MCP reads and proposals make no Google calls', async () => {
    const { connect, store, google } = await setup();
    await connect();
    const before = google.calls.length;

    const server = createMcpServer({ store, now: () => TEST_NOW });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 't', version: '0' });
    await client.connect(clientTransport);
    await client.callTool({ name: 'get_today', arguments: {} });
    await client.callTool({
      name: 'create_reminder',
      arguments: {
        text: 'Revise CN',
        remindAt: '2026-11-24T19:00:00+05:30',
        reason: 'Quiz tomorrow.',
      },
    });
    expect(google.calls.length).toBe(before);
  });
});

describe('approved reminders', () => {
  it('are added to the CampusMate calendar with only the reminder text and time', async () => {
    const { connect, reminder, approve, google, store } = await setup();
    await connect();
    const action = await approve(reminder());

    expect(action).toMatchObject({ status: 'done', note: expect.stringContaining('Also added') });
    const [event] = google.eventCalls();
    expect(event?.url).toContain('/calendars/cal-campusmate/events');
    const body = JSON.parse(event?.body ?? '{}') as Record<string, unknown>;
    expect(Object.keys(body).toSorted()).toEqual(['end', 'reminders', 'start', 'summary']);
    expect(body.summary).toBe('Submit the OS lab record');
    expect(store.count('reminders')).toBe(1);
    expect(listActivity(store)[0]).toMatchObject({
      kind: 'approved',
      summary: expect.stringContaining('Google Calendar'),
    });
  });

  it('are not sent to Google unless the student approves them', async () => {
    const { connect, reminder, send, google } = await setup();
    await connect();
    const id = reminder();
    await send(`/api/approvals/${id}/reject`, 'POST');
    expect(google.eventCalls()).toHaveLength(0);
  });

  it('refresh an expired access token and retry once', async () => {
    const { connect, reminder, approve, google } = await setup();
    await connect();
    google.expireAccessTokens();
    const action = await approve(reminder());
    expect(action.note).toContain('Also added');
    expect(google.eventCalls()).toHaveLength(2);
  });

  it('mark the connection for reconnecting when access expired or was revoked, and still save the reminder', async () => {
    const { connect, reminder, approve, google, store, status } = await setup();
    await connect();
    google.expireAccessTokens();
    google.state.refreshValid = false; // e.g. the 7-day testing-mode expiry

    const action = await approve(reminder());
    expect(action.status).toBe('done');
    expect(action.note).toMatch(/not added to Google Calendar: access expired/);
    expect(await status()).toBe('needs_reconnect');
    expect(store.count('reminders')).toBe(1);

    const callsBefore = google.calls.length;
    const next = await approve(reminder('Another one'));
    expect(next.note).toContain('Reconnect Google Calendar');
    expect(google.calls.length).toBe(callsBefore);
  });

  it('treat calendar access removed in Google settings as needing reconnect', async () => {
    const { connect, reminder, approve, google, status } = await setup();
    await connect();
    google.state.calendarRevoked = true;
    expect((await approve(reminder())).note).toMatch(/access expired or was removed/);
    expect(await status()).toBe('needs_reconnect');
  });

  it('retry a brief Google outage, and report a longer one without losing the reminder', async () => {
    const brief = await setup();
    await brief.connect();
    brief.google.state.outages = 2;
    expect((await brief.approve(brief.reminder())).note).toContain('Also added');

    const long = await setup();
    await long.connect();
    long.google.state.outages = 10;
    const action = await long.approve(long.reminder());
    expect(action.note).toContain('could not be reached');
    expect(long.store.count('reminders')).toBe(1);
    expect(await long.status()).toBe('connected');
  });
});

describe('disconnecting', () => {
  it('revokes the grant at Google and forgets the token', async () => {
    const { connect, send, status, google, store } = await setup();
    await connect();
    expect((await send('/api/integrations/google', 'DELETE')).status).toBe(204);
    expect(google.calls.some((c) => c.url.endsWith('/revoke'))).toBe(true);
    expect(await status()).toBe('disconnected');
    expect(store.db.prepare('SELECT COUNT(*) AS n FROM integrations').get()).toEqual({ n: 0 });
  });
});
