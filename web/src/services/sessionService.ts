import type { SessionRequest, SessionStatusResponse, SignUpRequest } from '@shared/types';
import { ApiError, apiRequest } from './apiClient';

export async function login(email: string, password: string): Promise<void> {
  const body: SessionRequest = { email, password };
  await apiRequest<void>('/api/session', { method: 'POST', body: JSON.stringify(body) });
}

/** Creates an account (needs the invite code) and signs it in. */
export async function signUp(details: SignUpRequest): Promise<void> {
  await apiRequest<void>('/api/users', { method: 'POST', body: JSON.stringify(details) });
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
