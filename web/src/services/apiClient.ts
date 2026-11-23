import type { ApiErrorBody } from '@shared/types';
import { env } from '@/config/env';

export class ApiError extends Error {
  readonly status: number;
  /** Machine-readable code from the server, e.g. 'unauthorized' or 'ability_disabled'. */
  readonly code: string;

  constructor(status: number, message: string, code = 'http_error') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const isApiErrorBody = (value: unknown): value is ApiErrorBody =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ApiErrorBody).error?.message === 'string';

/** Reads the server's `{ error: { code, message } }` body, falling back to plain text. */
async function toApiError(response: Response): Promise<ApiError> {
  const text = await response.text().catch(() => '');
  try {
    const body: unknown = JSON.parse(text);
    if (isApiErrorBody(body)) {
      return new ApiError(response.status, body.error.message, body.error.code);
    }
  } catch {
    // Not JSON: use the text below.
  }
  return new ApiError(response.status, text || response.statusText);
}

/**
 * The only place that talks to the backend: base URL, headers and error shape live here.
 * Throws ApiError for non-2xx responses; resolves to undefined for 204 No Content.
 * The session cookie travels automatically because the API is on the same origin.
 */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${env.apiBaseUrl}${path}`, { ...init, headers });

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
