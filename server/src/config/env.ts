import * as z from 'zod';

/** `NAME=` (empty, as in .env.example) means "not set". */
const optionalText = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

const EnvSchema = z
  .object({
    MCP_TOKEN: z.string().min(32, 'MCP_TOKEN must be at least 32 characters'),
    DASHBOARD_PASSCODE: z.string().min(6, 'DASHBOARD_PASSCODE must be at least 6 characters'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    DATABASE_PATH: z.string().min(1).default('./data/campusmate.db'),
    PUBLIC_URL: z.url().default('http://localhost:8787'),
    PORT: z.coerce.number().int().min(1).max(65535).default(8787),
    // Optional: Google Calendar for approved reminders. Leave both empty to keep reminders in CampusMate only.
    GOOGLE_CLIENT_ID: optionalText,
    GOOGLE_CLIENT_SECRET: optionalText,
  })
  .refine((env) => Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET), {
    message: 'Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither',
    path: ['GOOGLE_CLIENT_ID'],
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
