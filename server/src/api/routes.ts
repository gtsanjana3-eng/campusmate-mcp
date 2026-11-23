import { Hono } from 'hono';
import * as z from 'zod';
import type {
  AbilitiesResponse,
  AbilityResponse,
  ActionResponse,
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
import type { Env } from '../config/env.ts';
import type { Store } from '../data/store.ts';
import { listAbilities, setAbility } from '../domain/abilities.ts';
import { attendanceMinimum, getAttendance, getToday } from '../domain/academic.ts';
import { listActivity } from '../domain/activity.ts';
import { approveAction, editEmailDraft, listActions, rejectAction } from '../domain/approvals.ts';
import { unauthorized, validationError } from '../domain/errors.ts';
import { log } from '../lib/logger.ts';
import type { Mailer } from '../sources/mailer.ts';
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

export const TEST_PROMPT = 'What do I have today, and is my attendance safe in every subject?';

type ApiDeps = { store: Store; mailer: Mailer; now: () => Date };

/** REST API for the dashboard. Mounted at /api. */
export function createApiRoutes(env: Env, { store, mailer, now }: ApiDeps) {
  const api = new Hono();
  const session = requireSession(env.SESSION_SECRET);

  api.use('*', requireJsonForWrites);

  // Public: liveness and database check for the host's health probe.
  api.get('/health', (c) =>
    store.ping()
      ? c.json({ status: 'ok', db: 'ok' })
      : c.json({ status: 'error', db: 'down' }, 503),
  );

  api.post('/session', async (c) => {
    const { passcode } = await readJson(c, SessionBody);
    if (!passcodeMatches(passcode, env.DASHBOARD_PASSCODE)) {
      log.info('auth.login_failed');
      throw unauthorized();
    }
    startSession(c, env.SESSION_SECRET);
    log.info('auth.login');
    return c.body(null, 204);
  });

  api.delete('/session', (c) => {
    endSession(c);
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
    const action = approveAction(store, c.req.param('id'), { mailer, now: now() });
    log.info('approval.decided', {
      decision: 'approve',
      tool: action.preview.tool,
      status: action.status,
    });
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

  return api;
}
