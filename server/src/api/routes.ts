import { setTimeout as delay } from 'node:timers/promises';
import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono, type Context } from 'hono';
import * as z from 'zod';
import type {
  AbilitiesResponse,
  AbilityResponse,
  ActionResponse,
  ApiErrorBody,
  ActivityResponse,
  ApprovalsResponse,
  AttendanceResponse,
  ConnectResponse,
  SessionStatusResponse,
  TodayResponse,
} from '../../../shared/types/index.ts';
import { randomUUID } from 'node:crypto';
import { getCookie } from 'hono/cookie';
import {
  endSession,
  requireJsonForWrites,
  requireSession,
  secretMatches,
  SESSION_COOKIE,
  sessionUserId,
  startSession,
} from '../auth/session.ts';
import { hashPassword, UNUSED_HASH, verifyPassword } from '../lib/password.ts';
import { createLoginLimiter, type LoginLimiter } from '../auth/loginLimiter.ts';
import type { Env } from '../config/env.ts';
import type { Store } from '../data/store.ts';
import { listAbilities, setAbility } from '../domain/abilities.ts';
import { attendanceMinimum, getAttendance, getToday } from '../domain/academic.ts';
import { listActivity } from '../domain/activity.ts';
import {
  approveAction,
  editEmailDraft,
  getAction,
  listActions,
  rejectAction,
} from '../domain/approvals.ts';
import type { CalendarIntegration } from '../domain/integrations.ts';
import { AppError, conflict, unauthorized, validationError } from '../domain/errors.ts';
import { log } from '../lib/logger.ts';
import type { Mailer } from '../sources/mailer.ts';
import { createIntegrationRoutes } from './integrations.ts';
import { readJson } from './validate.ts';

const SessionBody = z.object({
  email: z.string().trim().toLowerCase().max(200),
  password: z.string().min(1).max(200),
});
const SignUpBody = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().trim().toLowerCase().max(200),
  password: z.string().min(12, 'Use at least 12 characters.').max(200),
  inviteCode: z.string().min(1).max(200),
});
const AbilityBody = z.object({ enabled: z.boolean() });
const EditEmailBody = z.object({
  subject: z.string().trim().min(3).max(120).optional(),
  body: z.string().trim().min(10).max(2000).optional(),
});
// Decisions carry no data, but must still be JSON (see requireJsonForWrites).
const DecisionBody = z.object({}).strict();
const STATUSES = ['pending', 'approved', 'done', 'rejected', 'failed', 'expired'] as const;

const SESSIONS_VALID_FROM = 'sessions_valid_from';
/** How long an approval waits for Google Calendar before answering (covers the normal retries). */
const CALENDAR_WAIT_MS = 2_000;

export const TEST_PROMPT = 'What do I have today, and is my attendance safe in every subject?';

type ApiDeps = {
  store: Store;
  mailer: Mailer;
  calendar: CalendarIntegration;
  now: () => Date;
  limiter?: LoginLimiter;
};

/**
 * The address the login limiter counts failures against. Behind `trustedHops` proxies, it is the
 * X-Forwarded-For entry added by the outermost trusted proxy (counted from the right), because
 * entries further left are supplied by the client and can be faked. Tests (no socket) share one key.
 */
export function clientAddress(c: Context, trustedHops = 0): string {
  if (trustedHops > 0) {
    const forwarded = (c.req.header('x-forwarded-for') ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    const fromProxy = forwarded[forwarded.length - trustedHops];
    if (fromProxy) return fromProxy;
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

const isPrivateAddress = (address: string) =>
  /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|f[cd]|::ffff:(10|127|192\.168)\.)/i.test(
    address,
  );

/** Headers some proxies set to the visitor's own address. Logged only as a position, never a value. */
const CLIENT_IP_HEADERS = ['cf-connecting-ip', 'true-client-ip', 'x-real-ip'] as const;

/**
 * Privacy-safe facts about how a login request arrived, to choose TRUST_PROXY_HOPS. No address is
 * ever logged: only counts, whether the socket is private, and for each client-address header
 * where its value sits in X-Forwarded-For (counted from the right) and whether the limiter used it.
 */
export function arrivalFacts(c: Context, limiterKey: string) {
  let socketIsPrivate: boolean | 'unknown' = 'unknown';
  try {
    socketIsPrivate = isPrivateAddress(getConnInfo(c).remote.address ?? '');
  } catch {
    // no socket in tests
  }
  const forwarded = (c.req.header('x-forwarded-for') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const clientHeaders = Object.fromEntries(
    CLIENT_IP_HEADERS.map((name) => {
      const value = c.req.header(name)?.trim();
      if (!value) return [name, 'absent'];
      const fromRight = forwarded.length - forwarded.lastIndexOf(value);
      return [
        name,
        {
          positionFromRight: forwarded.includes(value) ? fromRight : 'not-forwarded',
          usedByLimiter: value === limiterKey,
        },
      ];
    }),
  );
  return {
    socketIsPrivate,
    forwardedEntries: forwarded.length,
    forwardedKinds: forwarded.map((entry) => (isPrivateAddress(entry) ? 'private' : 'public')),
    clientHeaders,
  };
}

/** REST API for the dashboard. Mounted at /api. */
export function createApiRoutes(
  env: Env,
  { store, mailer, calendar, now, limiter = createLoginLimiter() }: ApiDeps,
) {
  const api = new Hono();
  // Sessions issued before the last logout are rejected (audit M3).
  const sessionsValidFrom = () => Number(store.getSetting(SESSIONS_VALID_FROM) ?? 0);
  // A session also ends when its account is gone (for example after a database reset).
  const session = requireSession(env.SESSION_SECRET, sessionsValidFrom, (id) =>
    Boolean(store.getUser(id)),
  );

  // The owner account from settings is recreated on every start, so it survives resets.
  if (env.OWNER_EMAIL && env.OWNER_PASSWORD) {
    store.upsertUser(
      {
        id: 'owner',
        email: env.OWNER_EMAIL,
        name: env.OWNER_NAME ?? store.getSetting('student_name') ?? 'Student',
        passwordHash: hashPassword(env.OWNER_PASSWORD),
      },
      now().toISOString(),
    );
  }

  /** Answers 429 while this client is locked out; shared by log-in and sign-up (both guess secrets). */
  const lockedOut = (c: Context, client: string) => {
    const wait = limiter.retryAfterSeconds(client);
    if (wait === 0) return null;
    log.info('auth.login_locked', { retryAfterSeconds: wait });
    c.header('Retry-After', String(wait));
    return c.json<ApiErrorBody>(
      {
        error: {
          code: 'too_many_attempts',
          message: `Too many failed attempts. Try again in ${Math.ceil(wait / 60)} minutes.`,
        },
      },
      429,
    );
  };

  const recordFailure = (c: Context, client: string, event: string) => {
    limiter.recordFailure(client);
    log.info(event, { ...arrivalFacts(c, client), trustedHops: env.TRUST_PROXY_HOPS });
  };

  api.use('*', requireJsonForWrites);

  // Public: liveness and database check for the host's health probe.
  api.get('/health', (c) =>
    store.ping()
      ? c.json({ status: 'ok', db: 'ok' })
      : c.json({ status: 'error', db: 'down' }, 503),
  );

  api.post('/session', async (c) => {
    const client = clientAddress(c, env.TRUST_PROXY_HOPS);
    // Checked before the password, so a locked-out client learns nothing, even with the right one.
    const locked = lockedOut(c, client);
    if (locked) return locked;

    const { email, password } = await readJson(c, SessionBody);
    const user = store.findUserByEmail(email);
    // An unknown email costs the same hashing time as a wrong password, so neither reveals which.
    const ok = verifyPassword(password, user?.passwordHash ?? UNUSED_HASH) && user;
    if (!ok) {
      recordFailure(c, client, 'auth.login_failed');
      throw new AppError('unauthorized', 401, 'That email or password is not right.');
    }
    limiter.recordSuccess(client);
    startSession(c, env.SESSION_SECRET, ok.id);
    log.info('auth.login');
    return c.body(null, 204);
  });

  // Sign-up needs the invite code (DASHBOARD_PASSCODE): the dashboard shows one student's data.
  api.post('/users', async (c) => {
    const client = clientAddress(c, env.TRUST_PROXY_HOPS);
    const locked = lockedOut(c, client);
    if (locked) return locked;

    const { name, email, password, inviteCode } = await readJson(c, SignUpBody);
    if (!secretMatches(inviteCode, env.DASHBOARD_PASSCODE)) {
      recordFailure(c, client, 'auth.signup_failed');
      throw new AppError('unauthorized', 401, 'That invite code is not right.');
    }
    const id = `u-${randomUUID()}`;
    const created = store.createUser(
      { id, email, name, passwordHash: hashPassword(password) },
      now().toISOString(),
    );
    if (!created) throw conflict('An account with that email already exists. Log in instead.');
    limiter.recordSuccess(client);
    startSession(c, env.SESSION_SECRET, id);
    log.info('auth.signup');
    return c.json({ created: true }, 201);
  });

  // Logging out ends every session on the server, so a copied cookie stops working too.
  // It needs a valid session: otherwise anyone could log the student out at will.
  api.delete('/session', session, (c) => {
    store.setSetting(SESSIONS_VALID_FROM, String(Date.now()));
    endSession(c);
    log.info('auth.logout');
    return c.body(null, 204);
  });

  // Everything below needs a logged-in student.
  api.get('/session', session, (c) => {
    const id = sessionUserId(getCookie(c, SESSION_COOKIE), env.SESSION_SECRET);
    const user = id ? store.getUser(id) : undefined;
    if (!user) throw unauthorized();
    return c.json<SessionStatusResponse>({
      authenticated: true,
      user: { name: user.name, email: user.email },
      student: {
        name: store.getSetting('student_name') ?? 'Student',
        college: store.getSetting('college_name') ?? '',
      },
    });
  });

  // The dashboard reads the same data the MCP tools use, through the same domain functions.
  api.get('/today', session, (c) => {
    const { date, classes, dueSoon, attendanceAlerts } = getToday(store, now());
    const pendingCount = listActions(store, 'pending', now()).length;
    return c.json<TodayResponse>({ date, classes, dueSoon, attendanceAlerts, pendingCount });
  });

  api.get('/attendance', session, (c) =>
    c.json<AttendanceResponse>({
      minimumPercent: Math.round(attendanceMinimum(store) * 100),
      subjects: getAttendance(store),
    }),
  );

  api.get('/abilities', session, (c) =>
    c.json<AbilitiesResponse>({ abilities: listAbilities(store) }),
  );

  api.put('/abilities/:name', session, async (c) => {
    const { enabled } = await readJson(c, AbilityBody);
    const ability = setAbility(store, c.req.param('name'), enabled);
    log.info('ability.changed', { name: ability.name, enabled });
    return c.json<AbilityResponse>({ ability });
  });

  api.get('/activity', session, (c) => {
    const limit = Number(c.req.query('limit') ?? 50);
    return c.json<ActivityResponse>({
      entries: listActivity(store, Number.isFinite(limit) ? limit : 50),
    });
  });

  // --- Approvals: the ONLY way a proposed action can run. MCP has no route to these. ---

  api.get('/approvals', session, (c) => {
    const status = c.req.query('status');
    if (status !== undefined && !(STATUSES as readonly string[]).includes(status)) {
      throw validationError(`status must be one of: ${STATUSES.join(', ')}.`);
    }
    return c.json<ApprovalsResponse>({
      actions: listActions(store, status as (typeof STATUSES)[number] | undefined, now()),
    });
  });

  api.patch('/approvals/:id', session, async (c) => {
    const edit = await readJson(c, EditEmailBody);
    const action = editEmailDraft(store, c.req.param('id'), edit, now());
    return c.json<ActionResponse>({ action });
  });

  api.post('/approvals/:id/approve', session, async (c) => {
    await readJson(c, DecisionBody);
    const id = c.req.param('id');
    let action = approveAction(store, id, { mailer, now: now() });
    log.info('approval.decided', {
      decision: 'approve',
      tool: action.preview.tool,
      status: action.status,
    });
    // A saved reminder is also offered to Google Calendar; the result is recorded as a note.
    // A slow Google must not hold the student's approval: wait briefly, then let it finish in the background.
    if (action.status === 'done' && action.preview.tool === 'create_reminder') {
      const sync = calendar
        .syncApprovedReminder(id, action.preview.reminder)
        .catch((error: unknown) => log.error('calendar.sync_failed', error));
      const wait = new AbortController();
      const timer = delay(CALENDAR_WAIT_MS, undefined, { signal: wait.signal }).catch(() => {});
      await Promise.race([sync, timer]);
      wait.abort();
      action = getAction(store, id);
    }
    return c.json<ActionResponse>({ action });
  });

  api.post('/approvals/:id/reject', session, async (c) => {
    await readJson(c, DecisionBody);
    const action = rejectAction(store, c.req.param('id'), now());
    log.info('approval.decided', { decision: 'reject', tool: action.preview.tool });
    return c.json<ActionResponse>({ action });
  });

  api.get('/connect', session, (c) =>
    c.json<ConnectResponse>({
      mcpUrl: `${env.PUBLIC_URL.replace(/\/+$/, '')}/mcp`,
      token: env.MCP_TOKEN,
      testPrompt: TEST_PROMPT,
    }),
  );

  api.route('/integrations', createIntegrationRoutes(calendar, session));

  return api;
}
