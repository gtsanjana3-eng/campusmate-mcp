import * as z from 'zod';

/** `NAME=` (empty, as in .env.example) means "not set". */
const optionalText = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

/** Words that mark a value copied from .env.example or a tutorial rather than generated. */
const PLACEHOLDER = /replace|change-?me|example|placeholder|your[-_ ]|secret-here|password/i;

/**
 * A secret must be long, must not be a published placeholder, and must not be trivially
 * repetitive (e.g. "aaaa…"). Generate one with:
 * node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
 */
const secret = (name: string, minLength: number) =>
  z
    .string()
    .min(minLength, `${name} must be at least ${minLength} characters`)
    .refine(
      (value) => !PLACEHOLDER.test(value),
      `${name} still looks like a placeholder; generate a real value`,
    )
    .refine(
      (value) => new Set(value).size >= 8,
      `${name} is too repetitive; generate a random value`,
    );

const EnvSchema = z
  .object({
    MCP_TOKEN: secret('MCP_TOKEN', 32),
    DASHBOARD_PASSCODE: secret('DASHBOARD_PASSCODE', 12),
    SESSION_SECRET: secret('SESSION_SECRET', 32),
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
