import { Hono } from 'hono';
import * as z from 'zod';
import type {
  AbilitiesResponse,
  AbilityResponse,
  ActivityResponse,
  ConnectResponse,
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
import { listActivity } from '../domain/activity.ts';
import { unauthorized } from '../domain/errors.ts';
import { log } from '../lib/logger.ts';
import { readJson } from './validate.ts';

const SessionBody = z.object({ passcode: z.string().min(1).max(200) });
const AbilityBody = z.object({ enabled: z.boolean() });

export const TEST_PROMPT = 'What do I have today, and is my attendance safe in every subject?';

/** REST API for the dashboard. Mounted at /api. */
export function createApiRoutes(env: Env, store: Store) {
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

  api.get('/connect', session, (c) =>
    c.json<ConnectResponse>({
      mcpUrl: `${env.PUBLIC_URL.replace(/\/+$/, '')}/mcp`,
      token: env.MCP_TOKEN,
      testPrompt: TEST_PROMPT,
    }),
  );

  return api;
}
