/**
 * Errors the domain throws on purpose. The API turns them into `{ error: { code, message } }`
 * with `status`; MCP tools turn them into an `isError` result with `message`.
 * Messages are safe to show to the student and the AI.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 503;

  constructor(code: string, status: AppError['status'], message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

export const validationError = (message: string) => new AppError('invalid_input', 400, message);
export const unauthorized = () => new AppError('unauthorized', 401, 'Please log in again.');
export const notFound = (what: string) => new AppError('not_found', 404, `${what} not found.`);
export const conflict = (message: string) => new AppError('conflict', 409, message);

export const abilityDisabled = (label: string) =>
  new AppError(
    'ability_disabled',
    403,
    `The student turned off “${label}” in CampusMate, so this isn't allowed right now.`,
  );
