import { randomUUID } from 'node:crypto';
import type {
  ActionPreview,
  ActToolName,
  EditEmailRequest,
  PendingAction,
  PendingSummary,
} from '../../../shared/types/index.ts';
import type { PendingActionRecord, Store } from '../data/store.ts';
import { log } from '../lib/logger.ts';
import { formatIst } from '../lib/time.ts';
import type { Mailer } from '../sources/mailer.ts';
import { requireAbility } from './abilities.ts';
import { logActivity } from './activity.ts';
import { AppError, conflict, notFound, validationError } from './errors.ts';

/** Proposals the student hasn't decided on within a day expire and can no longer run. */
export const EXPIRY_MS = 24 * 3_600_000;

/** One plain sentence describing a proposed action, used in the log and in summaries. */
export function describe(preview: ActionPreview): string {
  switch (preview.tool) {
    case 'draft_faculty_email':
      return `Email to ${preview.email.toName}: “${preview.email.subject}”`;
    case 'add_deadline':
      return `Add deadline ${preview.deadline.subjectCode}: ${preview.deadline.title} (due ${formatIst(preview.deadline.dueAt)})`;
    case 'create_reminder':
      return `Reminder “${preview.reminder.text}” at ${formatIst(preview.reminder.remindAt)}`;
    case 'mark_deadline_done':
      return `Mark ${preview.deadline.subjectCode}: ${preview.deadline.title} as done`;
  }
}

function toPendingAction(record: PendingActionRecord): PendingAction {
  const error = record.status === 'failed' ? record.result?.error : undefined;
  return {
    id: record.id,
    status: record.status,
    reason: record.reason,
    summary: describe(record.preview),
    preview: record.preview,
    createdAt: record.createdAt,
    expiresAt: new Date(Date.parse(record.createdAt) + EXPIRY_MS).toISOString(),
    ...(record.decidedAt ? { decidedAt: record.decidedAt } : {}),
    ...(typeof error === 'string' ? { error } : {}),
  };
}

function expireStale(store: Store, now: Date): void {
  store.expirePendingBefore(new Date(now.getTime() - EXPIRY_MS).toISOString(), now.toISOString());
}

/**
 * The only thing an act tool may do: record what it wants to happen. Nothing is executed here.
 * `preview` is stored as-is and is exactly what runs if the student approves.
 */
export function propose(
  store: Store,
  input: { preview: ActionPreview; reason: string },
  now: Date,
): PendingAction {
  const id = randomUUID();
  store.insertPendingAction({
    id,
    tool: input.preview.tool,
    preview: input.preview,
    reason: input.reason,
    createdAt: now.toISOString(),
  });
  return toPendingAction(store.getPendingAction(id) as PendingActionRecord);
}

export function listActions(
  store: Store,
  status: PendingAction['status'] | undefined,
  now: Date,
): PendingAction[] {
  expireStale(store, now);
  return store.listPendingActions(status ? { status } : {}).map(toPendingAction);
}

/** Short status lines for get_today, so the AI can tell the student what happened (fix F3). */
export function pendingSummary(store: Store, since: Date, now: Date): PendingSummary[] {
  expireStale(store, now);
  return store.listPendingActions({ since: since.toISOString() }).map((record) => ({
    id: record.id,
    tool: record.tool as ActToolName,
    status: record.status,
    summary: describe(record.preview),
  }));
}

function getOrThrow(store: Store, id: string): PendingActionRecord {
  const record = store.getPendingAction(id);
  if (!record) throw notFound('Action');
  return record;
}

/** The student may reword an email before approving it; nothing else is editable. */
export function editEmailDraft(
  store: Store,
  id: string,
  edit: EditEmailRequest,
  now: Date,
): PendingAction {
  expireStale(store, now);
  const record = getOrThrow(store, id);
  if (record.preview.tool !== 'draft_faculty_email')
    throw conflict('Only email drafts can be edited.');
  if (record.status !== 'pending') throw conflict(`This action is already ${record.status}.`);
  if (edit.subject === undefined && edit.body === undefined) {
    throw validationError('Change the subject or the body.');
  }

  const email = {
    ...record.preview.email,
    ...(edit.subject !== undefined ? { subject: edit.subject } : {}),
    ...(edit.body !== undefined ? { body: edit.body } : {}),
  };
  store.updatePendingPreview(id, { tool: 'draft_faculty_email', email });
  logActivity(store, {
    kind: 'edited',
    tool: 'draft_faculty_email',
    summary: `You edited the email to ${email.toName} before deciding.`,
    actionId: id,
  });
  return toPendingAction(getOrThrow(store, id));
}

export function rejectAction(store: Store, id: string, now: Date): PendingAction {
  expireStale(store, now);
  const record = getOrThrow(store, id);
  if (!store.transitionAction(id, 'pending', 'rejected', now.toISOString())) {
    throw conflict(`This action is already ${getOrThrow(store, id).status}.`);
  }
  logActivity(store, {
    kind: 'rejected',
    tool: record.tool,
    summary: `You rejected: ${describe(record.preview)}.`,
    actionId: id,
  });
  return toPendingAction(getOrThrow(store, id));
}

function execute(store: Store, record: PendingActionRecord, mailer: Mailer, now: Date) {
  const { preview, id: actionId } = record;
  switch (preview.tool) {
    case 'draft_faculty_email':
      return { mail: mailer.send(preview.email, actionId, now) };
    case 'add_deadline': {
      const deadlineId = `dl-${randomUUID().slice(0, 8)}`;
      store.insertDeadline({ ...preview.deadline, id: deadlineId, status: 'open' }, actionId);
      return { deadlineId };
    }
    case 'create_reminder': {
      const reminderId = randomUUID();
      store.insertReminder({ id: reminderId, ...preview.reminder });
      return { reminderId };
    }
    case 'mark_deadline_done': {
      const current = store.getDeadline(preview.deadline.id);
      if (!current) throw notFound('Deadline');
      if (current.status === 'done') throw conflict('That deadline is already marked as done.');
      store.setDeadlineStatus(current.id, 'done');
      return { deadlineId: current.id };
    }
  }
}

/**
 * The only path that runs an action, reachable only from the dashboard API (never from MCP).
 * 1. pending → approved is atomic, so a double click or a race can't run it twice;
 * 2. the ability is checked again, in case the student switched it off after it was proposed;
 * 3. the action runs in a transaction and is recorded as done or failed, never left half-done.
 */
export function approveAction(
  store: Store,
  id: string,
  deps: { mailer: Mailer; now: Date },
): PendingAction {
  const { mailer, now } = deps;
  expireStale(store, now);
  const record = getOrThrow(store, id);
  if (!store.transitionAction(id, 'pending', 'approved', now.toISOString())) {
    throw conflict(`This action is already ${getOrThrow(store, id).status}.`);
  }
  const summary = describe(record.preview);

  try {
    requireAbility(store, record.tool);
    const result = store.transaction(() => {
      const outcome = execute(store, record, mailer, now);
      store.finishAction(id, 'done', outcome);
      return outcome;
    });
    const demoNote = 'mail' in result ? ' (delivered to the CampusMate demo outbox)' : '';
    logActivity(store, {
      kind: 'approved',
      tool: record.tool,
      summary: `Done after your approval: ${summary}${demoNote}.`,
      actionId: id,
    });
  } catch (error) {
    const message =
      error instanceof AppError ? error.message : 'CampusMate could not complete this action.';
    store.finishAction(id, 'failed', { error: message });
    logActivity(store, {
      kind: 'failed',
      tool: record.tool,
      summary: `Could not complete: ${summary}. ${message}`,
      actionId: id,
    });
    // Unexpected errors (e.g. the mail service is down) are logged for us; the student sees a
    // plain "could not complete" result instead of a server error.
    if (!(error instanceof AppError))
      log.error('approval.execute_failed', error, { tool: record.tool });
  }
  return toPendingAction(getOrThrow(store, id));
}
