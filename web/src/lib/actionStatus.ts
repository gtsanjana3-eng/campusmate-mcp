import type { ActionStatus } from '@shared/types';
import type { BadgeTone } from '@/components/ui/Badge';

/** How each action status is shown. 'Done' appears only when the server reports status 'done'. */
export const STATUS_BADGES: Record<ActionStatus, { tone: BadgeTone; label: string }> = {
  pending: { tone: 'info', label: 'Waiting for you' },
  approved: { tone: 'info', label: 'Running…' },
  done: { tone: 'success', label: 'Done' },
  rejected: { tone: 'neutral', label: 'Rejected' },
  failed: { tone: 'danger', label: 'Failed' },
  expired: { tone: 'neutral', label: 'Expired' },
};
