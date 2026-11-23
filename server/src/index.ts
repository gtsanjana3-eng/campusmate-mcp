import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { parseEnv } from './config/env.ts';

const env = parseEnv();

// serveStatic resolves its root from the working directory, so pass a relative path.
const distPath = fileURLToPath(new URL('../../web/dist', import.meta.url));
const webDist = existsSync(distPath) ? relative(process.cwd(), distPath) : undefined;

const app = createApp(env, { webDist });

serve({ fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' }, ({ port }) => {
  console.info(`CampusMate server on port ${port} · MCP at ${env.PUBLIC_URL}/mcp`);
  if (!webDist)
    console.info('Dashboard build not found (run `npm run build`); serving API and MCP only.');
});
