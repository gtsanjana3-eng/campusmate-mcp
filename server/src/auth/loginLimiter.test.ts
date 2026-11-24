import { describe, expect, it } from 'vitest';
import { createLoginLimiter } from './loginLimiter.ts';
import { login, TEST_PASSCODE, testApp } from '../test/helpers.ts';

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
    body: JSON.stringify({ passcode }),
  });

describe('POST /api/session with the limiter', () => {
  it('refuses even the right passcode during a lockout, with Retry-After', async () => {
    const { app } = testApp();
    for (let i = 0; i < 5; i++) expect((await tryLogin(app, `wrong-guess-${i}`)).status).toBe(401);

    const locked = await tryLogin(app, TEST_PASSCODE);
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
