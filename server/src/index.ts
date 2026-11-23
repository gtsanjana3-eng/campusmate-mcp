import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { parseEnv } from './config/env.ts';
import { seedIfEmpty } from './data/seed.ts';
import { createStore } from './data/store.ts';
import { log } from './lib/logger.ts';

const env = parseEnv();
const store = createStore(env.DATABASE_PATH);
if (seedIfEmpty(store)) log.info('db.seeded', { path: env.DATABASE_PATH });

// serveStatic resolves its root from the working directory, so pass a relative path.
const distPath = fileURLToPath(new URL('../../web/dist', import.meta.url));
const webDist = existsSync(distPath) ? relative(process.cwd(), distPath) : undefined;

const app = createApp(env, { store, webDist });

const server = serve({ fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' }, ({ port }) => {
  log.info('server.started', {
    port,
    mcpUrl: `${env.PUBLIC_URL}/mcp`,
    dashboard: Boolean(webDist),
  });
});

const shutdown = () => {
  server.close();
  store.close();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
