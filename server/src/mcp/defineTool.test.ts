import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import { setAbility } from '../domain/abilities.ts';
import { listActivity } from '../domain/activity.ts';
import { notFound } from '../domain/errors.ts';
import { seededStore, TEST_NOW } from '../test/helpers.ts';
import { createMcpServer } from './createServer.ts';
import { defineTool } from './defineTool.ts';

/**
 * Exercises the wrapper every real tool will use, with a stand-in handler registered under a
 * real ability name. The real tools arrive in Phase 9.
 */
async function connectWith(behaviour: 'ok' | 'not_found' | 'crash') {
  const store = seededStore();
  const server = new McpServer({ name: 'test', version: '0' });
  defineTool(
    server,
    { store, now: () => TEST_NOW },
    {
      name: 'get_attendance',
      kind: 'read',
      title: 'Attendance',
      description: 'Test stand-in',
      inputSchema: z.object({ subjectCode: z.string().optional() }),
      outputSchema: z.object({ echo: z.string() }),
    },
    ({ subjectCode }) => {
      if (behaviour === 'not_found') throw notFound('Subject');
      if (behaviour === 'crash') throw new Error('secret internal detail');
      return {
        text: 'ok',
        activity: 'Read attendance.',
        structured: { echo: subjectCode ?? 'all' },
      };
    },
  );

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientTransport);
  return { client, store };
}

const call = (client: Client, args: Record<string, unknown> = {}) =>
  client.callTool({ name: 'get_attendance', arguments: args });

describe('defineTool', () => {
  it('runs an enabled tool, returns structured content and logs a read', async () => {
    const { client, store } = await connectWith('ok');
    const result = await call(client, { subjectCode: 'OS' });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ echo: 'OS' });
    expect(listActivity(store)[0]).toMatchObject({
      kind: 'read',
      tool: 'get_attendance',
      summary: 'Read attendance.',
    });
  });

  it('refuses a disabled tool, explains why, and logs it as blocked', async () => {
    const { client, store } = await connectWith('ok');
    setAbility(store, 'get_attendance', false);
    const result = await call(client);
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('turned off');
    expect(listActivity(store)[0]).toMatchObject({ kind: 'blocked', tool: 'get_attendance' });
  });

  it('turns expected errors into a plain message and logs a failure', async () => {
    const { client, store } = await connectWith('not_found');
    const result = await call(client);
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('Subject not found');
    expect(listActivity(store)[0]?.kind).toBe('failed');
  });

  it('hides unexpected error details from the AI', async () => {
    const { client } = await connectWith('crash');
    const result = await call(client);
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).not.toContain('secret internal detail');
  });

  it('rejects input that does not match the schema', async () => {
    const { client } = await connectWith('ok');
    const result = await call(client, { subjectCode: 42 });
    expect(result.isError).toBe(true);
  });
});

describe('createMcpServer', () => {
  it('answers ping and identifies itself', async () => {
    const server = createMcpServer({ store: seededStore(), now: () => TEST_NOW });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(clientTransport);
    await expect(client.ping()).resolves.toBeDefined();
    expect(client.getServerVersion()?.name).toBe('campusmate');
  });
});
