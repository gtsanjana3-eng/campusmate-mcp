import { randomUUID } from 'node:crypto';
import type { EmailPreview } from '../../../shared/types/index.ts';
import type { Store } from '../data/store.ts';

export type SentMail = { id: string; sentAt: string; delivery: 'demo-outbox' };

/** Where approved emails go. A real provider (e.g. Gmail) would implement this later. */
export type Mailer = {
  send(email: EmailPreview, actionId: string, now: Date): SentMail;
};

/**
 * Demo implementation: approved emails are stored in the CampusMate outbox and never leave the
 * server. Results say `delivery: 'demo-outbox'` so nobody mistakes this for a real send.
 */
export function createDemoOutbox(store: Store): Mailer {
  return {
    send(email, actionId, now) {
      const mail = { id: randomUUID(), sentAt: now.toISOString() };
      store.insertOutbox({ ...email, ...mail, actionId });
      return { ...mail, delivery: 'demo-outbox' };
    },
  };
}
