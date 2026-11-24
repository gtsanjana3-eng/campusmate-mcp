import type { SessionRequest, SessionStatusResponse } from '@shared/types';
import { ApiError, apiRequest } from './apiClient';

export async function login(passcode: string): Promise<void> {
  const body: SessionRequest = { passcode };
  await apiRequest<void>('/api/session', { method: 'POST', body: JSON.stringify(body) });
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/api/session', { method: 'DELETE' });
}

/** The session (with the student it belongs to) while the cookie is valid; null when the server says to log in. */
export async function getSession(): Promise<SessionStatusResponse | null> {
  try {
    return await apiRequest<SessionStatusResponse>('/api/session');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
