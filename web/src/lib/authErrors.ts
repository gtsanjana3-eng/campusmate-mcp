import { ApiError } from '@/services/apiClient';

/**
 * What to show when signing in or up fails. The server's own message for the expected cases
 * (wrong details, lockout with wait time, taken email, invalid input); a connection hint otherwise.
 */
export function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError && [400, 401, 409, 429].includes(error.status)) {
    return error.message;
  }
  return 'CampusMate could not be reached. Check your connection and try again.';
}
