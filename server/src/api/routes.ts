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
  TodayResponse,
} from '../../../shared/types/index.ts';
import {
  endSession,
  passcodeMatches,
  requireJsonForWrites,
  requireSession,
  startSession,
} from '../auth/session.ts';
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
import { unauthorized, validationError } from '../domain/errors.ts';
import { log } from '../lib/logger.ts';
import type { Mailer } from '../sources/mailer.ts';
import { createIntegrationRoutes } from './integrations.ts';
import { readJson } from './validate.ts';

const SessionBody = z.object({ passcode: z.string().min(1).max(200) });
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

/** The connecting address; tests (no socket) share one key. */
function clientAddress(c: Context): string {
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/** REST API for the dashboard. Mounted at /api. */
export function createApiRoutes(
  env: Env,
  { store, mailer, calendar, now, limiter = createLoginLimiter() }: ApiDeps,
) {
  const api = new Hono();
  // Sessions issued before the last logout are rejected (audit M3).
  const sessionsValidFrom = () => Number(store.getSetting(SESSIONS_VALID_FROM) ?? 0);
  const session = requireSession(env.SESSION_SECRET, sessionsValidFrom);

  api.use('*', requireJsonForWrites);

  // Public: liveness and database check for the host's health probe.
  api.get('/health', (c) =>
    store.ping()
      ? c.json({ status: 'ok', db: 'ok' })
      : c.json({ status: 'error', db: 'down' }, 503),
  );

  api.post('/session', async (c) => {
    const client = clientAddress(c);
    // Checked before the passcode, so a locked-out client learns nothing, even with the right one.
    const wait = limiter.retryAfterSeconds(client);
    if (wait > 0) {
      log.info('auth.login_locked', { retryAfterSeconds: wait });
      c.header('Retry-After', String(wait));
      return c.json<ApiErrorBody>(
        {
          error: {
            code: 'too_many_attempts',
            message: `Too many wrong passcodes. Try again in ${Math.ceil(wait / 60)} minutes.`,
          },
        },
        429,
      );
    }

    const { passcode } = await readJson(c, SessionBody);
    if (!passcodeMatches(passcode, env.DASHBOARD_PASSCODE)) {
      limiter.recordFailure(client);
      log.info('auth.login_failed');
      throw unauthorized();
    }
    limiter.recordSuccess(client);
    startSession(c, env.SESSION_SECRET);
    log.info('auth.login');
    return c.body(null, 204);
  });

  // Logging out ends every session on the server, so a copied cookie stops working too.
  api.delete('/session', (c) => {
    store.setSetting(SESSIONS_VALID_FROM, String(Date.now()));
    endSession(c);
    log.info('auth.logout');
    return c.body(null, 204);
  });

  // Everything below needs a logged-in student.
  api.get('/session', session, (c) => c.json({ authenticated: true }));

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
