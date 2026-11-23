import { serveStatic } from '@hono/node-server/serve-static';
import { createMcpHonoApp } from '@modelcontextprotocol/hono';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { Hono, type Context } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { ApiErrorBody } from '../../shared/types/index.ts';
import { bearerAuth } from './auth/bearer.ts';
import type { Env } from './config/env.ts';
import { createMcpServer } from './mcp/createServer.ts';

type AppOptions = {
  /** Folder with the built dashboard, relative to the process working directory. Omit in tests. */
  webDist?: string;
};

const apiError = (code: string, message: string): ApiErrorBody => ({ error: { code, message } });

export function createApp(env: Env, options: AppOptions = {}) {
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
  const handler = createMcpHandler(createMcpServer);
  mcp.use('*', bearerAuth(env.MCP_TOKEN));
  mcp.all('/', (c: Context) => handler.fetch(c.req.raw, { parsedBody: c.get('parsedBody') }));
  app.route('/mcp', mcp);

  // --- REST API: only the dashboard talks to this (session auth arrives in Phase 8) ---
  app.get('/api/health', (c) => c.json({ status: 'ok' }));
  app.all('/api/*', (c) => c.json(apiError('not_found', 'No such API route.'), 404));

  // --- Dashboard: static files with SPA fallback ---
  if (options.webDist) {
    app.use('/*', serveStatic({ root: options.webDist }));
    app.get('*', serveStatic({ root: options.webDist, path: 'index.html' }));
  }

  app.onError((error, c) => {
    console.error(error);
    return c.json(apiError('internal', 'Something went wrong.'), 500);
  });

  return app;
}
