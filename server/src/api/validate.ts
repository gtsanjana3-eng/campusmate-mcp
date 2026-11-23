import type { Context } from 'hono';
import type * as z from 'zod';
import { validationError } from '../domain/errors.ts';

/** Parses and validates a JSON body; every API input goes through this. */
export async function readJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  const raw: unknown = await c.req.json().catch(() => {
    throw validationError('The request body must be valid JSON.');
  });
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw validationError(`${issue?.path.join('.') || 'body'}: ${issue?.message ?? 'is invalid'}`);
  }
  return result.data;
}
