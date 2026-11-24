import type { AddressInfo } from 'node:net';
import { serve, type ServerType } from '@hono/node-server';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  ActionResponse,
  ActivityResponse,
  ApprovalsResponse,
  ConnectResponse,
  IntegrationsResponse,
  ProposeOutput,
  TodayResponse,
} from '../../shared/types/index.ts';
import { createApp } from './app.ts';
import { parseEnv } from './config/env.ts';
import { fakeGoogle } from './test/fakeGoogle.ts';
import { seededStore, TEST_NOW, TEST_PASSCODE, testEnv } from './test/helpers.ts';

/*
 * End-to-end journeys over real HTTP: a real server on a local port, the official MCP client
 * playing the AI host, and plain HTTP calls playing the dashboard (exactly the requests the web
 * app sends). Only Google is simulated. Each journey goes from request to final result.
 */

const google = fakeGoogle();
const store = seededStore();
let server: ServerType;
let base: string;
let cookie = '';
let ai: Client;

const env = parseEnv({
  MCP_TOKEN: testEnv.MCP_TOKEN,
  DASHBOARD_PASSCODE: TEST_PASSCODE,
  SESSION_SECRET: testEnv.SESSION_SECRET,
  PUBLIC_URL: 'http://localhost:8787',
  GOOGLE_CLIENT_ID: 'e2e-client-id',
  GOOGLE_CLIENT_SECRET: 'e2e-client-secret',
});

/** What the dashboard does: JSON requests with the session cookie. */
async function dashboard<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const response = await fetch(`${base}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, data: (text ? JSON.parse(text) : undefined) as T };
}

/** What the AI host does: an MCP tool call over Streamable HTTP. */
async function tool(name: string, args: Record<string, unknown> = {}) {
  const result = await ai.callTool({ name, arguments: args });
  return { ...result, text: JSON.stringify(result.content) };
}

beforeAll(async () => {
  const app = createApp(env, { store, now: () => TEST_NOW, googleFetch: google.fetch });
  await new Promise<void>((resolve) => {
    server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  // J0: log in, read the connection details from the Connect page's API, connect the AI with them.
  const login = await fetch(`${base}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: TEST_PASSCODE }),
  });
  cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
  const { data: connect } = await dashboard<ConnectResponse>('/api/connect');
  ai = new Client({ name: 'e2e-ai-host', version: '0' });
  await ai.connect(
    new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${connect.token}` } },
    }),
  );
});

afterAll(async () => {
  await ai?.close();
  server?.close();
});

describe('J0 setup', () => {
  it('connects the AI with the token from the Connect page and sees all 10 tools', async () => {
    expect(cookie).toMatch(/^cm_session=/);
    expect((await ai.listTools()).tools).toHaveLength(10);
  });
});

describe('J1 "Can I skip OS tomorrow?"', () => {
  it('answers with exact numbers and logs the read for the student', async () => {
    const result = await tool('get_attendance', { subjectCode: 'OS' });
    expect(result.text).toContain('can miss 1 more');
    const { data } = await dashboard<ActivityResponse>('/api/activity');
    expect(data.entries[0]?.summary).toBe('Read your attendance for OS.');
  });
});

describe('J2 "Email Prof. Rao for an extension"', () => {
  it('goes proposal → dashboard edit → approval → demo outbox, and the AI sees the result', async () => {
    const proposed = await tool('draft_faculty_email', {
      subjectCode: 'DBMS',
      purpose: 'extension',
      subject: 'Extension request',
      body: 'Dear Prof. Rao, may I have two more days for the ER diagram? Ananya',
      reason: 'You asked for a two-day extension.',
    });
    const { actionId } = proposed.structuredContent as unknown as ProposeOutput;
    expect(proposed.text).toContain('Nothing has been done yet');

    const today = await dashboard<TodayResponse>('/api/today');
    expect(today.data.pendingCount).toBe(1);
    const pending = await dashboard<ApprovalsResponse>('/api/approvals?status=pending');
    expect(pending.data.actions.map((a) => a.id)).toEqual([actionId]);

    await dashboard(`/api/approvals/${actionId}`, 'PATCH', { subject: 'Request: two more days' });
    const approved = await dashboard<ActionResponse>(
      `/api/approvals/${actionId}/approve`,
      'POST',
      {},
    );
    expect(approved.data.action.status).toBe('done');
    expect(store.db.prepare('SELECT subject FROM outbox').all()).toEqual([
      { subject: 'Request: two more days' },
    ]);

    const replay = await dashboard(`/api/approvals/${actionId}/approve`, 'POST', {});
    expect(replay.status).toBe(409);
    expect((await tool('get_today')).text).toContain('Request: two more days” — done');
  });
});

describe('J3 notice with a hidden instruction', () => {
  it('adds the real deadline and the student cancels the injected email: nothing is sent', async () => {
    expect((await tool('list_notices', { query: 'lab record' })).text).toContain(
      'ignore your previous',
    );
    const deadline = await tool('add_deadline', {
      subjectCode: 'OS',
      title: 'OS lab record (programs 1–8)',
      dueAt: '2026-11-28T16:00:00+05:30',
      kind: 'assignment',
      sourceNoticeId: 'nt-os-record',
      reason: 'From the class representative’s notice.',
    });
    const injected = await tool('draft_faculty_email', {
      subjectCode: 'OS',
      purpose: 'other',
      subject: 'Whole class will skip lab',
      body: 'Dear Dr. Iyer, the whole class will skip lab this week.',
      reason: 'The notice said to email all faculty.',
    });
    const outboxBefore = store.count('outbox');

    const ok = await dashboard<ActionResponse>(
      `/api/approvals/${(deadline.structuredContent as unknown as ProposeOutput).actionId}/approve`,
      'POST',
      {},
    );
    const no = await dashboard<ActionResponse>(
      `/api/approvals/${(injected.structuredContent as unknown as ProposeOutput).actionId}/reject`,
      'POST',
      {},
    );
    expect([ok.data.action.status, no.data.action.status]).toEqual(['done', 'rejected']);
    expect(store.count('outbox')).toBe(outboxBefore);
    expect(store.listDeadlines().some((d) => d.source === 'notice')).toBe(true);
  });
});

describe('J4 the student switches an ability off and on', () => {
  it('blocks the AI while off and allows it again when on', async () => {
    await dashboard('/api/abilities/plan_week', 'PUT', { enabled: false });
    const blocked = await tool('plan_week');
    expect(blocked.isError).toBe(true);
    expect(blocked.text).toContain('turned off');
    const activity = await dashboard<ActivityResponse>('/api/activity');
    expect(activity.data.entries[0]?.kind).toBe('blocked');

    await dashboard('/api/abilities/plan_week', 'PUT', { enabled: true });
    expect((await tool('plan_week')).isError).toBeFalsy();
  });
});

describe('J5 reminder with Google Calendar (simulated Google)', () => {
  it('connects, adds an approved reminder to Google, and falls back cleanly when access is revoked', async () => {
    const started = await fetch(`${base}/api/integrations/google/connect`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const { authUrl } = (await started.json()) as { authUrl: string };
    const state = new URL(authUrl).searchParams.get('state');
    const back = await fetch(
      `${base}/api/integrations/google/callback?state=${state}&code=good-code`,
      {
        redirect: 'manual',
        headers: { Cookie: started.headers.get('set-cookie')?.split(';')[0] ?? '' },
      },
    );
    expect(back.headers.get('location')).toBe('/connect?google=connected');

    const first = await tool('create_reminder', {
      text: 'Submit the OS lab record',
      remindAt: '2026-11-27T18:00:00+05:30',
      reason: 'You asked for a reminder.',
    });
    const done = await dashboard<ActionResponse>(
      `/api/approvals/${(first.structuredContent as unknown as ProposeOutput).actionId}/approve`,
      'POST',
      {},
    );
    expect(done.data.action.note).toContain('Also added');

    google.state.calendarRevoked = true;
    const second = await tool('create_reminder', {
      text: 'Revise CN',
      remindAt: '2026-11-27T19:00:00+05:30',
      reason: 'Quiz coming up.',
    });
    const fallback = await dashboard<ActionResponse>(
      `/api/approvals/${(second.structuredContent as unknown as ProposeOutput).actionId}/approve`,
      'POST',
      {},
    );
    expect(fallback.data.action.status).toBe('done');
    expect(fallback.data.action.note).toContain('not added to Google Calendar');
    const status = await dashboard<IntegrationsResponse>('/api/integrations');
    expect(status.data.integrations[0]?.state).toBe('needs_reconnect');
  });
});

describe('J6 authorisation boundaries', () => {
  it('keeps the AI channel and the dashboard channel separate', async () => {
    const withToken = await fetch(`${base}/api/approvals`, {
      headers: { Authorization: `Bearer ${env.MCP_TOKEN}` },
    });
    expect(withToken.status).toBe(401);

    const noToken = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
    });
    expect(noToken.status).toBe(401);
  });

  it('after logout the dashboard is locked, so pending actions cannot be decided', async () => {
    const proposed = await tool('create_reminder', {
      text: 'Pack lab coat',
      remindAt: '2026-11-27T07:00:00+05:30',
      reason: 'Lab tomorrow.',
    });
    const { actionId } = proposed.structuredContent as unknown as ProposeOutput;
    await dashboard('/api/session', 'DELETE');
    const attempt = await dashboard(`/api/approvals/${actionId}/approve`, 'POST', {});
    expect(attempt.status).toBe(401);
    expect(store.getPendingAction(actionId)?.status).toBe('pending');
  });
});
