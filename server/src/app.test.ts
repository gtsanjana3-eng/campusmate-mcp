import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_BODY_LIMIT_BYTES } from './app.ts';
import { parseEnv } from './config/env.ts';
import { TEST_TOKEN as TOKEN, testApp, testEnv as env } from './test/helpers.ts';

const { app } = testApp();

const initialize = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '0.0.0' },
  },
};

function mcpRequest(headers: Record<string, string> = {}, host = 'campusmate.example.com') {
  return app.request(`https://${host}/mcp`, {
    method: 'POST',
    headers: {
      // Fetch Requests don't carry Host; real HTTP traffic always does, and the SDK checks it.
      Host: host,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify(initialize),
  });
}

/** Streamable HTTP may answer as JSON or as an SSE stream; return the JSON-RPC message either way. */
async function readMessage(
  response: Response,
): Promise<{ result?: { serverInfo?: { name: string } } }> {
  const text = await response.text();
  const json = response.headers.get('content-type')?.includes('text/event-stream')
    ? text
        .split('\n')
        .find((line) => line.startsWith('data:'))
        ?.slice('data:'.length)
    : text;
  return JSON.parse(json ?? '{}');
}

const parseInvalidEnv = () => parseEnv({ MCP_TOKEN: 'short-secret-value' });

describe('parseEnv', () => {
  it('applies defaults', () => {
    expect(env.PORT).toBe(8787);
    expect(env.DATABASE_PATH).toBe('./data/campusmate.db');
  });

  it('lists every invalid variable without printing values', () => {
    expect(parseInvalidEnv).toThrow(/MCP_TOKEN/);
    expect(parseInvalidEnv).toThrow(/DASHBOARD_PASSCODE/);
    expect(parseInvalidEnv).not.toThrow(/short-secret-value/);
  });

  it('refuses to start with the published .env.example placeholders (audit H1)', () => {
    const example = Object.fromEntries(
      readFileSync(new URL('../../.env.example', import.meta.url), 'utf8')
        .split('\n')
        .filter((line) => /^[A-Z_]+=/.test(line))
        .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
    );
    const attempt = () => parseEnv(example);
    expect(attempt).toThrow(/MCP_TOKEN still looks like a placeholder/);
    expect(attempt).toThrow(/SESSION_SECRET still looks like a placeholder/);
    expect(attempt).toThrow(/DASHBOARD_PASSCODE/);
  });

  it('refuses short, placeholder-like or repetitive secrets', () => {
    const valid = {
      MCP_TOKEN: env.MCP_TOKEN,
      DASHBOARD_PASSCODE: env.DASHBOARD_PASSCODE,
      SESSION_SECRET: env.SESSION_SECRET,
    };
    expect(() => parseEnv({ ...valid, DASHBOARD_PASSCODE: 'letmein1' })).toThrow(/at least 12/);
    expect(() => parseEnv({ ...valid, DASHBOARD_PASSCODE: 'my-password-123' })).toThrow(
      /placeholder/,
    );
    expect(() => parseEnv({ ...valid, MCP_TOKEN: 'a'.repeat(40) })).toThrow(/too repetitive/);
    expect(parseEnv(valid).MCP_TOKEN).toBe(env.MCP_TOKEN);
  });
});

describe('REST boundary', () => {
  it('answers the health check', async () => {
    const response = await app.request('/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', db: 'ok' });
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const response = await app.request('/api/nope');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: 'not_found' } });
  });

  it('sends security headers', async () => {
    const response = await app.request('/api/health');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('MCP boundary', () => {
  it('rejects requests without the bearer token', async () => {
    expect((await mcpRequest()).status).toBe(401);
  });

  it('rejects a wrong bearer token', async () => {
    expect((await mcpRequest({ Authorization: 'Bearer wrong' })).status).toBe(401);
  });

  it('rejects hosts that are not allowed (DNS rebinding protection)', async () => {
    const response = await mcpRequest({ Authorization: `Bearer ${TOKEN}` }, 'evil.example.net');
    expect(response.status).toBe(403);
  });

  it('completes the MCP initialize handshake with a valid token on the public host', async () => {
    const response = await mcpRequest({ Authorization: `Bearer ${TOKEN}` });
    expect(response.status).toBe(200);
    expect((await readMessage(response)).result?.serverInfo?.name).toBe('campusmate');
  });
});

describe('API hardening (audit M1, M2)', () => {
  it('marks every API response as not cacheable', async () => {
    for (const path of ['/api/health', '/api/connect', '/api/nope']) {
      expect((await app.request(path)).headers.get('cache-control')).toBe('no-store');
    }
  });

  it('refuses request bodies over the limit before reading them', async () => {
    const response = await app.request('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: 'x'.repeat(API_BODY_LIMIT_BYTES) }),
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: 'payload_too_large' } });
  });
});
