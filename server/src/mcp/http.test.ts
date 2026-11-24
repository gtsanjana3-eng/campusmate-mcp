import type { AddressInfo } from 'node:net';
import { serve, type ServerType } from '@hono/node-server';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { parseEnv } from '../config/env.ts';
import {
  seededStore,
  TEST_NOW,
  TEST_PASSCODE,
  TEST_SESSION_SECRET,
  TEST_TOKEN,
} from '../test/helpers.ts';

/**
 * End to end over real HTTP: a real server on a local port and the official MCP client,
 * exactly as an AI host connects (Streamable HTTP + bearer token).
 */
let server: ServerType;
let url: URL;

beforeAll(async () => {
  const store = seededStore();
  // PUBLIC_URL is only used for the host allow-list here; the client connects to 127.0.0.1.
  const env = parseEnv({
    MCP_TOKEN: TEST_TOKEN,
    DASHBOARD_PASSCODE: TEST_PASSCODE,
    SESSION_SECRET: TEST_SESSION_SECRET,
    PUBLIC_URL: 'http://localhost:8787',
  });
  const app = createApp(env, { store, now: () => TEST_NOW });
  await new Promise<void>((resolve) => {
    server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, () => resolve());
  });
  url = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`);
});

afterAll(() => {
  server.close();
});

async function connect(token?: string) {
  const client = new Client({ name: 'http-test', version: '0' });
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  });
  await client.connect(transport);
  return client;
}

describe('MCP over HTTP with the official client', () => {
  it('refuses to connect without the token', async () => {
    await expect(connect()).rejects.toThrow(/401|Unauthorized/i);
  });

  it('connects with the token, lists 10 tools and calls one', async () => {
    const client = await connect(TEST_TOKEN);
    expect(client.getServerVersion()?.name).toBe('campusmate');

    const { tools } = await client.listTools();
    expect(tools).toHaveLength(10);

    const result = await client.callTool({
      name: 'get_attendance',
      arguments: { subjectCode: 'OS' },
    });
    expect(result.structuredContent).toMatchObject({ subjects: [{ canMiss: 1, percent: 76.9 }] });
    await client.close();
  });
});
