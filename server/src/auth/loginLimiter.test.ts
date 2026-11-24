import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { arrivalFacts, clientAddress } from '../api/routes.ts';
import { createApp } from '../app.ts';
import { createLoginLimiter } from './loginLimiter.ts';
import {
  login,
  seededStore,
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  testApp,
  testEnv,
} from '../test/helpers.ts';

function clock() {
  let t = 1_000_000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('login limiter', () => {
  it('locks a client out after 5 failures, then lets it try again later', () => {
    const time = clock();
    const limiter = createLoginLimiter({ now: time.now });
    for (let i = 0; i < 4; i++) limiter.recordFailure('a');
    expect(limiter.retryAfterSeconds('a')).toBe(0);
    limiter.recordFailure('a');
    expect(limiter.retryAfterSeconds('a')).toBe(15 * 60);
    expect(limiter.retryAfterSeconds('b')).toBe(0);
    time.advance(15 * 60_000);
    expect(limiter.retryAfterSeconds('a')).toBe(0);
  });

  it('forgets failures outside the window and after a success', () => {
    const time = clock();
    const limiter = createLoginLimiter({ now: time.now });
    for (let i = 0; i < 4; i++) limiter.recordFailure('a');
    time.advance(16 * 60_000);
    limiter.recordFailure('a');
    expect(limiter.retryAfterSeconds('a')).toBe(0);

    for (let i = 0; i < 3; i++) limiter.recordFailure('b');
    limiter.recordSuccess('b');
    for (let i = 0; i < 4; i++) limiter.recordFailure('b');
    expect(limiter.retryAfterSeconds('b')).toBe(0);
  });

  it('pauses all logins when guesses come from many addresses', () => {
    const limiter = createLoginLimiter({ now: clock().now });
    for (let i = 0; i < 30; i++) limiter.recordFailure(`client-${i}`);
    expect(limiter.retryAfterSeconds('someone-new')).toBeGreaterThan(0);
  });
});

const tryLogin = (app: ReturnType<typeof testApp>['app'], passcode: string) =>
  app.request('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_OWNER_EMAIL, password: passcode }),
  });

describe('POST /api/session with the limiter', () => {
  it('refuses even the right passcode during a lockout, with Retry-After', async () => {
    const { app } = testApp();
    for (let i = 0; i < 5; i++) expect((await tryLogin(app, `wrong-guess-${i}`)).status).toBe(401);

    const locked = await tryLogin(app, TEST_OWNER_PASSWORD);
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(locked.headers.get('set-cookie')).toBeNull();
    expect(await locked.json()).toMatchObject({ error: { code: 'too_many_attempts' } });
  });

  it('still lets the student in after a few mistakes', async () => {
    const { app } = testApp();
    for (let i = 0; i < 3; i++) await tryLogin(app, `typo-${i}`);
    await expect(login(app)).resolves.toMatch(/^cm_session=/);
  });
});

const proxiedApp = () => createApp({ ...testEnv, TRUST_PROXY_HOPS: 1 }, { store: seededStore() });
const from = (app: ReturnType<typeof proxiedApp>, forwardedFor: string, passcode: string) =>
  app.request('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': forwardedFor },
    body: JSON.stringify({ email: TEST_OWNER_EMAIL, password: passcode }),
  });

describe('behind a trusted proxy (review M2)', () => {
  it('locks out only the guessing visitor, not the student behind the same proxy', async () => {
    const app = proxiedApp();
    for (let i = 0; i < 5; i++) await from(app, '203.0.113.7', `wrong-${i}`);
    expect((await from(app, '203.0.113.7', TEST_OWNER_PASSWORD)).status).toBe(429);
    expect((await from(app, '198.51.100.20', TEST_OWNER_PASSWORD)).status).toBe(204);
  });

  it('ignores addresses the visitor adds to X-Forwarded-For themselves', async () => {
    const app = proxiedApp();
    // The proxy appends the real address last; the fake ones on the left change nothing.
    for (let i = 0; i < 5; i++) await from(app, `10.0.0.${i}, 203.0.113.7`, `wrong-${i}`);
    expect((await from(app, '1.2.3.4, 203.0.113.7', TEST_OWNER_PASSWORD)).status).toBe(429);
  });

  it('is off by default: the header is not trusted without TRUST_PROXY_HOPS', async () => {
    const { app } = testApp();
    for (let i = 0; i < 5; i++) await from(app, `203.0.113.${i}`, `wrong-${i}`);
    expect((await from(app, '198.51.100.20', TEST_OWNER_PASSWORD)).status).toBe(429);
  });
});

async function probe(
  hops: number,
  headers: Record<string, string>,
): Promise<ReturnType<typeof arrivalFacts>> {
  const app = new Hono().get('/', (c) => c.json(arrivalFacts(c, clientAddress(c, hops))));
  const response = await app.request('/', { headers });
  return (await response.json()) as ReturnType<typeof arrivalFacts>;
}

describe('proxy diagnostics in the failed-login log (Phase 22, issue 4)', () => {
  it("reports where the visitor's address sits, without logging any address", async () => {
    const headers = {
      'X-Forwarded-For': '192.0.2.1, 203.0.113.7, 104.16.0.1, 10.0.0.5',
      'CF-Connecting-IP': '203.0.113.7',
    };
    const facts = await probe(3, headers);
    expect(facts).toMatchObject({
      forwardedEntries: 4,
      forwardedKinds: ['public', 'public', 'public', 'private'],
      clientHeaders: {
        'cf-connecting-ip': { positionFromRight: 3, usedByLimiter: true },
        'true-client-ip': 'absent',
        'x-real-ip': 'absent',
      },
    });
    expect(JSON.stringify(facts)).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
    expect((await probe(1, headers)).clientHeaders['cf-connecting-ip']).toMatchObject({
      usedByLimiter: false,
    });
  });
});
