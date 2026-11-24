import { createApp } from '../app.ts';
import { parseEnv } from '../config/env.ts';
import { seedStore } from '../data/seed.ts';
import { createStore } from '../data/store.ts';

// Test-only values: long and varied enough to pass the start-up checks, never used anywhere real.
export const TEST_TOKEN = 'mcp-test-token-9f3a1c7e5b2d4f6a8c0e1b3d5f7a9c2e';
export const TEST_PASSCODE = 'student-pass-4821';
export const TEST_SESSION_SECRET = 'session-test-key-7b1d9e3f5a2c4e6b8d0f2a4c6e8b';
export const TEST_HOST = 'campusmate.example.com';
export const TEST_OWNER_EMAIL = 'owner@campusmate.test';
export const TEST_OWNER_PASSWORD = 'owner-pass-5839-test';

export const testEnv = parseEnv({
  MCP_TOKEN: TEST_TOKEN,
  DASHBOARD_PASSCODE: TEST_PASSCODE,
  SESSION_SECRET: TEST_SESSION_SECRET,
  PUBLIC_URL: `https://${TEST_HOST}`,
  OWNER_EMAIL: TEST_OWNER_EMAIL,
  OWNER_PASSWORD: TEST_OWNER_PASSWORD,
});

/** JSON body for logging in as the test owner (or with a wrong password). */
export const ownerLogin = (password = TEST_OWNER_PASSWORD) =>
  JSON.stringify({ email: TEST_OWNER_EMAIL, password });

/** Fixed clock for tests: Tuesday 24 Nov 2026, 10:30 in India (05:00 UTC). */
export const TEST_NOW = new Date('2026-11-24T05:00:00Z');

/** A fresh in-memory database with the demo student, so tests never share state. */
export function seededStore(now = TEST_NOW) {
  const store = createStore(':memory:');
  seedStore(store, now);
  return store;
}

export function testApp() {
  const store = seededStore();
  return { store, app: createApp(testEnv, { store, now: () => TEST_NOW }) };
}

/** Logs in and returns the Cookie header value for later requests. */
export async function login(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await app.request('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: ownerLogin(),
  });
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (response.status !== 204 || !cookie) throw new Error(`Login failed: ${response.status}`);
  return cookie;
}
