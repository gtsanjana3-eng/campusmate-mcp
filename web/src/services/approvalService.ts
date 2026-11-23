import type {
  ActionResponse,
  ActionStatus,
  ApprovalsResponse,
  EditEmailRequest,
} from '@shared/types';
import { apiRequest } from './apiClient';

/*
 * Approvals are decided only here, through the API. The page shows whatever the server returns,
 * so an action is never reported as done unless the server says it is.
 */

export const listApprovals = (status?: ActionStatus) =>
  apiRequest<ApprovalsResponse>(`/api/approvals${status ? `?status=${status}` : ''}`);

export const getPendingCount = async () => (await listApprovals('pending')).actions.length;

const path = (id: string) => `/api/approvals/${encodeURIComponent(id)}`;

/** Fired after the server records a decision, so other views (e.g. the header badge) refresh now. */
export const APPROVALS_CHANGED = 'campusmate:approvals-changed';

async function decide(id: string, decision: 'approve' | 'reject'): Promise<ActionResponse> {
  // Decisions send an empty JSON body: the server requires JSON for every write (CSRF guard).
  const result = await apiRequest<ActionResponse>(`${path(id)}/${decision}`, {
    method: 'POST',
    body: '{}',
  });
  window.dispatchEvent(new Event(APPROVALS_CHANGED));
  return result;
}

export const approveAction = (id: string) => decide(id, 'approve');

export const rejectAction = (id: string) => decide(id, 'reject');

export const editEmailDraft = (id: string, edit: EditEmailRequest) =>
  apiRequest<ActionResponse>(path(id), { method: 'PATCH', body: JSON.stringify(edit) });
