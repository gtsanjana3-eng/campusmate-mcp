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
    // How many trusted proxies (e.g. Render's load balancer) append to X-Forwarded-For. 0 = use the
    // socket address. Never set this without such a proxy: the header is then client-controlled.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    // Optional: Google Calendar for approved reminders. Leave both empty to keep reminders in CampusMate only.
    GOOGLE_CLIENT_ID: optionalText,
    GOOGLE_CLIENT_SECRET: optionalText,
    // Optional owner account, (re)created at every start so it survives a database reset.
    OWNER_EMAIL: z.preprocess((v) => (v === '' ? undefined : v), z.email().optional()),
    OWNER_PASSWORD: z.preprocess(
      (v) => (v === '' ? undefined : v),
      secret('OWNER_PASSWORD', 12).optional(),
    ),
    OWNER_NAME: optionalText,
  })
  .refine((env) => Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET), {
    message: 'Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither',
    path: ['GOOGLE_CLIENT_ID'],
  })
  .refine((env) => Boolean(env.OWNER_EMAIL) === Boolean(env.OWNER_PASSWORD), {
    message: 'Set both OWNER_EMAIL and OWNER_PASSWORD, or neither',
    path: ['OWNER_EMAIL'],
  });

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validates configuration once at startup and fails fast with every problem listed.
 * Error messages name the variables but never print their values.
 */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  // On Render, PUBLIC_URL can be left unset: the platform provides the service's own https URL.
  const publicUrl = source.PUBLIC_URL || source.RENDER_EXTERNAL_URL;
  const result = EnvSchema.safeParse({ ...source, PUBLIC_URL: publicUrl });
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `- ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  return result.data;
}
