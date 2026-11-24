import { serveStatic } from '@hono/node-server/serve-static';
import { createMcpHonoApp } from '@modelcontextprotocol/hono';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import type { ApiErrorBody } from '../../shared/types/index.ts';
import { createApiRoutes } from './api/routes.ts';
import { bearerAuth } from './auth/bearer.ts';
import type { Env } from './config/env.ts';
import type { Store } from './data/store.ts';
import { AppError } from './domain/errors.ts';
import { createCalendarIntegration } from './domain/integrations.ts';
import { log } from './lib/logger.ts';
import { createSecretBox } from './lib/secretBox.ts';
import { createMcpServer } from './mcp/createServer.ts';
import { createGoogleClient } from './sources/google/googleClient.ts';
import { createDemoOutbox, type Mailer } from './sources/mailer.ts';

type AppOptions = {
  store: Store;
  /** Where approved emails go. Defaults to the demo outbox. */
  mailer?: Mailer;
  /** Clock, injectable for tests. */
  now?: () => Date;
  /** fetch used for Google calls; tests pass a simulated Google. */
  googleFetch?: typeof fetch;
  /** Folder with the built dashboard, relative to the process working directory. Omit in tests. */
  webDist?: string;
};

/** Largest dashboard request: an edited email (2,000 characters) fits many times over. */
export const API_BODY_LIMIT_BYTES = 16 * 1024;

const apiError = (code: string, message: string): ApiErrorBody => ({ error: { code, message } });

export function createApp(env: Env, options: AppOptions) {
  const { store } = options;
  const now = options.now ?? (() => new Date());
  const mailer = options.mailer ?? createDemoOutbox(store);
  // Google Calendar is only enabled when the server has its own OAuth credentials.
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? createGoogleClient({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectUri: `${env.PUBLIC_URL.replace(/\/+$/, '')}/api/integrations/google/callback`,
          ...(options.googleFetch ? { fetch: options.googleFetch, sleep: async () => {} } : {}),
        })
      : undefined;
  const calendar = createCalendarIntegration({
    store,
    box: createSecretBox(env.SESSION_SECRET),
    ...(google ? { google } : {}),
    now,
  });
  const app = new Hono();

  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      },
    }),
  );

  // --- MCP: only the AI host talks to this, with the bearer token ---
  // Binding to all interfaces drops the SDK's localhost-only default, so the public host is listed explicitly.
  const mcp = createMcpHonoApp({
    host: '0.0.0.0',
    allowedHosts: [new URL(env.PUBLIC_URL).hostname, 'localhost', '127.0.0.1'],
  });
  const handler = createMcpHandler(() => createMcpServer({ store, now }));
  mcp.use('*', bearerAuth(env.MCP_TOKEN));
  mcp.all('/', (c: Context) => handler.fetch(c.req.raw, { parsedBody: c.get('parsedBody') }));
  app.route('/mcp', mcp);

  // --- REST API: only the dashboard talks to this, with the session cookie ---
  // Responses carry student data and the MCP token: never cache them (audit M1).
  app.use('/api/*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
  });
  // Dashboard requests are small; refuse large bodies before reading them (audit M2).
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: API_BODY_LIMIT_BYTES,
      onError: (c) => c.json(apiError('payload_too_large', 'That request is too large.'), 413),
    }),
  );
  app.route('/api', createApiRoutes(env, { store, mailer, calendar, now }));
  app.all('/api/*', (c) => c.json(apiError('not_found', 'No such API route.'), 404));

  // --- Dashboard: static files with SPA fallback ---
  if (options.webDist) {
    // Built files under /assets have a content hash in their name, so they never change: cache for a year.
    // Everything else (index.html) is revalidated, so a new deploy shows up straight away.
    // (Set after the response is built: serveStatic's onFound runs too late to add headers.)
    app.use('/*', async (c, next) => {
      await next();
      const isAppRoute = c.req.path.startsWith('/api') || c.req.path.startsWith('/mcp');
      if (isAppRoute || !c.res.ok) return;
      c.res.headers.set(
        'Cache-Control',
        c.req.path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
    });
    app.use('/*', serveStatic({ root: options.webDist }));
    // A missing asset (e.g. from an old deploy) is a 404, never the page under a year-long cache.
    app.get('/assets/*', (c) => c.notFound());
    app.get('*', serveStatic({ root: options.webDist, path: 'index.html' }));
  }

  app.onError((error, c) => {
    if (error instanceof AppError) return c.json(apiError(error.code, error.message), error.status);
    log.error('http.unhandled', error, { method: c.req.method, path: c.req.path });
    return c.json(apiError('internal', 'Something went wrong.'), 500);
  });

  return app;
}
