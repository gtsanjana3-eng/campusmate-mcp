import { createApp } from '../app.ts';
import { parseEnv } from '../config/env.ts';
import { seedStore } from '../data/seed.ts';
import { createStore } from '../data/store.ts';

export const TEST_TOKEN = 't'.repeat(40);
export const TEST_PASSCODE = 'letmein';
export const TEST_HOST = 'campusmate.example.com';

export const testEnv = parseEnv({
  MCP_TOKEN: TEST_TOKEN,
  DASHBOARD_PASSCODE: TEST_PASSCODE,
  SESSION_SECRET: 's'.repeat(40),
  PUBLIC_URL: `https://${TEST_HOST}`,
});

/** A fresh in-memory database with the demo student, so tests never share state. */
export function seededStore(now = new Date()) {
  const store = createStore(':memory:');
  seedStore(store, now);
  return store;
}

export function testApp() {
  const store = seededStore();
  return { store, app: createApp(testEnv, { store }) };
}

/** Logs in and returns the Cookie header value for later requests. */
export async function login(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await app.request('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: TEST_PASSCODE }),
  });
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (response.status !== 204 || !cookie) throw new Error(`Login failed: ${response.status}`);
  return cookie;
}
