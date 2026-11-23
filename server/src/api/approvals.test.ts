import { describe, expect, it } from 'vitest';
import type { ActionResponse, ApprovalsResponse } from '../../../shared/types/index.ts';
import { propose } from '../domain/approvals.ts';
import { login, TEST_NOW, TEST_TOKEN, testApp } from '../test/helpers.ts';

async function setup() {
  const { app, store } = testApp();
  const cookie = await login(app);
  const { id } = propose(
    store,
    {
      preview: {
        tool: 'draft_faculty_email',
        email: {
          toName: 'Prof. K. Rao',
          toEmail: 'k.rao@college.example.edu',
          subject: 'Extension request',
          body: 'Dear Prof. Rao, could I have two more days? Ananya',
        },
      },
      reason: 'Student asked',
    },
    TEST_NOW,
  );
  const send = (path: string, method: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { app, store, cookie, id, send };
}

describe('approvals API', () => {
  it('lists pending actions for the logged-in student', async () => {
    const { send, id } = await setup();
    const response = await send('/api/approvals?status=pending', 'GET');
    const body = (await response.json()) as ApprovalsResponse;
    expect(body.actions.map((a) => a.id)).toEqual([id]);
  });

  it('rejects an unknown status filter', async () => {
    const { send } = await setup();
    expect((await send('/api/approvals?status=maybe', 'GET')).status).toBe(400);
  });

  it('approves an action once; a second approval is a 409', async () => {
    const { send, store, id } = await setup();
    const first = await send(`/api/approvals/${id}/approve`, 'POST', {});
    expect(((await first.json()) as ActionResponse).action.status).toBe('done');
    expect(store.count('outbox')).toBe(1);

    const second = await send(`/api/approvals/${id}/approve`, 'POST', {});
    expect(second.status).toBe(409);
    expect(store.count('outbox')).toBe(1);
  });

  it('requires a JSON body to approve (CSRF guard)', async () => {
    const { app, cookie, id, store } = await setup();
    const response = await app.request(`/api/approvals/${id}/approve`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(415);
    expect(store.count('outbox')).toBe(0);
  });

  it('cannot be reached with the MCP bearer token', async () => {
    const { app, id, store } = await setup();
    const response = await app.request(`/api/approvals/${id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBe(401);
    expect(store.count('outbox')).toBe(0);
  });

  it('rejects an action', async () => {
    const { send, store, id } = await setup();
    const response = await send(`/api/approvals/${id}/reject`, 'POST', {});
    expect(((await response.json()) as ActionResponse).action.status).toBe('rejected');
    expect(store.count('outbox')).toBe(0);
  });

  it('edits an email draft and validates the edit', async () => {
    const { send, id } = await setup();
    const ok = await send(`/api/approvals/${id}`, 'PATCH', {
      subject: 'Request for a short extension',
    });
    expect(((await ok.json()) as ActionResponse).action.preview).toMatchObject({
      email: { subject: 'Request for a short extension' },
    });
    expect((await send(`/api/approvals/${id}`, 'PATCH', { subject: 'x' })).status).toBe(400);
  });

  it('returns 404 for an unknown action', async () => {
    const { send } = await setup();
    expect((await send('/api/approvals/nope/approve', 'POST', {})).status).toBe(404);
  });
});
