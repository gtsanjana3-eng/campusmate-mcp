import { serveStatic } from '@hono/node-server/serve-static';
import { createMcpHonoApp } from '@modelcontextprotocol/hono';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { Hono, type Context } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { ApiErrorBody } from '../../shared/types/index.ts';
import { createApiRoutes } from './api/routes.ts';
import { bearerAuth } from './auth/bearer.ts';
import type { Env } from './config/env.ts';
import type { Store } from './data/store.ts';
import { AppError } from './domain/errors.ts';
import { log } from './lib/logger.ts';
import { createMcpServer } from './mcp/createServer.ts';
import { createDemoOutbox, type Mailer } from './sources/mailer.ts';

type AppOptions = {
  store: Store;
  /** Where approved emails go. Defaults to the demo outbox. */
  mailer?: Mailer;
  /** Clock, injectable for tests. */
  now?: () => Date;
  /** Folder with the built dashboard, relative to the process working directory. Omit in tests. */
  webDist?: string;
};

const apiError = (code: string, message: string): ApiErrorBody => ({ error: { code, message } });

export function createApp(env: Env, options: AppOptions) {
  const { store } = options;
  const now = options.now ?? (() => new Date());
  const mailer = options.mailer ?? createDemoOutbox(store);
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
  app.route('/api', createApiRoutes(env, { store, mailer, now }));
  app.all('/api/*', (c) => c.json(apiError('not_found', 'No such API route.'), 404));

  // --- Dashboard: static files with SPA fallback ---
  if (options.webDist) {
    app.use('/*', serveStatic({ root: options.webDist }));
    app.get('*', serveStatic({ root: options.webDist, path: 'index.html' }));
  }

  app.onError((error, c) => {
    if (error instanceof AppError) return c.json(apiError(error.code, error.message), error.status);
    log.error('http.unhandled', error, { method: c.req.method, path: c.req.path });
    return c.json(apiError('internal', 'Something went wrong.'), 500);
  });

  return app;
}
