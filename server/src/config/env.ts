import * as z from 'zod';

const EnvSchema = z.object({
  MCP_TOKEN: z.string().min(32, 'MCP_TOKEN must be at least 32 characters'),
  DASHBOARD_PASSCODE: z.string().min(6, 'DASHBOARD_PASSCODE must be at least 6 characters'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  DATABASE_PATH: z.string().min(1).default('./data/campusmate.db'),
  PUBLIC_URL: z.url().default('http://localhost:8787'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validates configuration once at startup and fails fast with every problem listed.
 * Error messages name the variables but never print their values.
 */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `- ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  return result.data;
}
