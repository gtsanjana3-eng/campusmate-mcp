import type { SessionRequest, SessionStatusResponse } from '@shared/types';
import { ApiError, apiRequest } from './apiClient';

export async function login(passcode: string): Promise<void> {
  const body: SessionRequest = { passcode };
  await apiRequest<void>('/api/session', { method: 'POST', body: JSON.stringify(body) });
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/api/session', { method: 'DELETE' });
}

/** True when the session cookie is still valid; false when the server says to log in. */
export async function isLoggedIn(): Promise<boolean> {
  try {
    const status = await apiRequest<SessionStatusResponse>('/api/session');
    return status.authenticated;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return false;
    throw error;
  }
}
