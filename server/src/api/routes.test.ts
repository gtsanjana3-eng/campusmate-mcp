import { describe, expect, it } from 'vitest';
import type {
  AbilitiesResponse,
  AbilityResponse,
  AttendanceResponse,
  TodayResponse,
} from '../../../shared/types/index.ts';
import { login, TEST_HOST, TEST_PASSCODE, TEST_TOKEN, testApp } from '../test/helpers.ts';

const json = (body: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('session API', () => {
  it('refuses a wrong passcode', async () => {
    const { app } = testApp();
    const response = await app.request('/api/session', {
      method: 'POST',
      ...json({ passcode: 'nope' }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('sets a hardened cookie on the right passcode', async () => {
    const { app } = testApp();
    const response = await app.request('/api/session', {
      method: 'POST',
      ...json({ passcode: TEST_PASSCODE }),
    });
    expect(response.status).toBe(204);
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^cm_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('rejects non-JSON writes (CSRF guard)', async () => {
    const { app } = testApp();
    const response = await app.request('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `passcode=${TEST_PASSCODE}`,
    });
    expect(response.status).toBe(415);
  });

  it('rejects an invalid body with a clear message', async () => {
    const { app } = testApp();
    const response = await app.request('/api/session', { method: 'POST', ...json({}) });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'invalid_input' } });
  });

  it('reports the session status and logs out', async () => {
    const { app } = testApp();
    const cookie = await login(app);
    const status = await app.request('/api/session', { headers: { Cookie: cookie } });
    expect(await status.json()).toEqual({ authenticated: true });

    const logout = await app.request('/api/session', {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });
    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie')).toMatch(/cm_session=;/);
  });
});

describe('protected routes', () => {
  it.each([
    '/api/session',
    '/api/today',
    '/api/attendance',
    '/api/approvals',
    '/api/abilities',
    '/api/activity',
    '/api/connect',
  ])('%s needs a session', async (path) => {
    const { app } = testApp();
    expect((await app.request(path)).status).toBe(401);
  });

  it('does not accept the MCP bearer token in place of a session', async () => {
    const { app } = testApp();
    const response = await app.request('/api/abilities', {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    expect(response.status).toBe(401);
  });
});

describe('abilities API', () => {
  it('lists and switches abilities', async () => {
    const { app, store } = testApp();
    const cookie = await login(app);

    const list = await app.request('/api/abilities', { headers: { Cookie: cookie } });
    expect(((await list.json()) as AbilitiesResponse).abilities).toHaveLength(11);

    const update = await app.request('/api/abilities/draft_faculty_email', {
      method: 'PUT',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(update.status).toBe(200);
    expect(((await update.json()) as AbilityResponse).ability).toMatchObject({
      name: 'draft_faculty_email',
      enabled: false,
    });
    expect(store.getAbility('draft_faculty_email')?.enabled).toBe(false);
  });

  it('returns 404 for an unknown ability', async () => {
    const { app } = testApp();
    const cookie = await login(app);
    const response = await app.request('/api/abilities/launch_rockets', {
      method: 'PUT',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    expect(response.status).toBe(404);
  });
});

describe('connect API', () => {
  it('gives the logged-in student the MCP URL and token', async () => {
    const { app } = testApp();
    const cookie = await login(app);
    const response = await app.request('/api/connect', { headers: { Cookie: cookie } });
    expect(await response.json()).toMatchObject({
      mcpUrl: `https://${TEST_HOST}/mcp`,
      token: TEST_TOKEN,
    });
  });
});

describe('activity API', () => {
  it('returns entries for the logged-in student', async () => {
    const { app } = testApp();
    const cookie = await login(app);
    const response = await app.request('/api/activity?limit=5', { headers: { Cookie: cookie } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ entries: [] });
  });
});

describe('today and attendance API', () => {
  it('returns the same day view the MCP tools use, plus the pending count', async () => {
    const { app } = testApp();
    const cookie = await login(app);
    const response = await app.request('/api/today', { headers: { Cookie: cookie } });
    const body = (await response.json()) as TodayResponse;
    expect(body).toMatchObject({ date: '2026-11-24', pendingCount: 0 });
    expect(body.classes.map((c) => c.subjectCode)).toEqual(['OS', 'SE', 'ML', 'PE']);
    expect(body.dueSoon.map((d) => d.id)).toEqual(['dl-cn-quiz', 'dl-dbms-er']);
  });

  it('returns attendance for every subject with exact canMiss / mustAttend', async () => {
    const { app } = testApp();
    const cookie = await login(app);
    const response = await app.request('/api/attendance', { headers: { Cookie: cookie } });
    const body = (await response.json()) as AttendanceResponse;
    expect(body.minimumPercent).toBe(75);
    expect(body.subjects.find((s) => s.subjectCode === 'OS')).toMatchObject({ canMiss: 1 });
    expect(body.subjects.find((s) => s.subjectCode === 'CN')).toMatchObject({ mustAttend: 6 });
  });
});

describe('logout (audit M3)', () => {
  it('stops a copied cookie from working', async () => {
    const { app } = testApp();
    const stolen = await login(app);
    await app.request('/api/session', { method: 'DELETE', headers: { Cookie: stolen } });
    expect((await app.request('/api/abilities', { headers: { Cookie: stolen } })).status).toBe(401);
  });

  it('lets the student log in again afterwards', async () => {
    const { app } = testApp();
    const first = await login(app);
    await app.request('/api/session', { method: 'DELETE', headers: { Cookie: first } });
    const second = await login(app);
    expect((await app.request('/api/abilities', { headers: { Cookie: second } })).status).toBe(200);
  });

  it('cannot be triggered by someone who is not logged in (review H1)', async () => {
    const { app } = testApp();
    const student = await login(app);
    expect((await app.request('/api/session', { method: 'DELETE' })).status).toBe(401);
    expect(
      (
        await app.request('/api/session', {
          method: 'DELETE',
          headers: { Cookie: 'cm_session=forged.value' },
        })
      ).status,
    ).toBe(401);
    expect((await app.request('/api/abilities', { headers: { Cookie: student } })).status).toBe(
      200,
    );
  });
});
