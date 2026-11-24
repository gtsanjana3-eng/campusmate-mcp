import type { PendingAction } from '@shared/types';
import { useEffect, useRef, useState } from 'react';
import { ActionDetails, ApprovalCard } from '@/components/sections/ApprovalCard';
import { ErrorState } from '@/components/sections/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { TextField } from '@/components/ui/TextField';
import { usePolling } from '@/hooks/usePolling';
import { STATUS_BADGES } from '@/lib/actionStatus';
import { formatDateTime } from '@/lib/format';
import { pageTitle } from '@/lib/pageTitle';
import { ApiError } from '@/services/apiClient';
import {
  approveAction,
  editEmailDraft,
  listApprovals,
  rejectAction,
} from '@/services/approvalService';
import styles from './ApprovalsPage.module.css';

const loadApprovals = async () => (await listApprovals()).actions;

const failureText = (error: unknown) =>
  error instanceof ApiError ? error.message : 'CampusMate could not be reached. Try again.';

/** What the server says happened. Success is only ever reported when the server returned "done". */
function outcomeText(action: PendingAction): string {
  switch (action.status) {
    case 'done':
      if (action.preview.tool === 'draft_faculty_email') {
        return `Done: ${action.summary}. Delivered to the CampusMate demo outbox.`;
      }
      // e.g. whether a reminder also reached Google Calendar, as reported by the server.
      return `Done: ${action.summary}.${action.note ? ` ${action.note}` : ''}`;
    case 'failed':
      return `Couldn't complete: ${action.summary}. ${action.error ?? ''}`.trim();
    default:
      return `${action.summary}: ${STATUS_BADGES[action.status].label}.`;
  }
}

type EditState = { action: PendingAction; subject: string; body: string; error: string };

export default function ApprovalsPage() {
  const approvals = usePolling(loadApprovals);
  const [confirming, setConfirming] = useState<PendingAction | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const messageRef = useRef<HTMLOutputElement>(null);

  // The decided card disappears with the button that had focus; move focus to the outcome so
  // keyboard and screen-reader users keep their place.
  useEffect(() => {
    if (message) messageRef.current?.focus();
  }, [message]);

  const decide = async (action: PendingAction, decision: 'approve' | 'reject') => {
    setBusyId(action.id);
    setConfirming(null);
    try {
      if (decision === 'approve') {
        const { action: result } = await approveAction(action.id);
        setMessage(outcomeText(result));
      } else {
        await rejectAction(action.id);
        setMessage(`Rejected: ${action.summary}. Nothing was done.`);
      }
    } catch (error) {
      setMessage(failureText(error));
    } finally {
      setBusyId(null);
      approvals.refresh();
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusyId(editing.action.id);
    try {
      await editEmailDraft(editing.action.id, { subject: editing.subject, body: editing.body });
      setEditing(null);
      setMessage("Email updated. It's still waiting for your approval.");
      approvals.refresh();
    } catch (error) {
      setEditing({ ...editing, error: failureText(error) });
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (action: PendingAction) => {
    if (action.preview.tool !== 'draft_faculty_email') return;
    const { subject, body } = action.preview.email;
    setEditing({ action, subject, body, error: '' });
  };

  const pending =
    approvals.status === 'success' ? approvals.data.filter((a) => a.status === 'pending') : [];
  const history =
    approvals.status === 'success'
      ? approvals.data.filter((a) => a.status !== 'pending').slice(0, 10)
      : [];

  return (
    <div className={`container ${styles.page}`}>
      <title>{pageTitle('Approvals')}</title>
      <h1 className={styles.heading}>Approvals</h1>
      <p className={styles.lead}>
        Your assistant can only suggest actions. Nothing below happens until you approve it here.
      </p>

      {/* Always present, so screen readers announce each outcome. */}
      <output ref={messageRef} tabIndex={-1} className={styles.message}>
        {message}
      </output>

      {approvals.status === 'loading' && (
        <StatusMessage variant="loading" title="Loading your approvals…" />
      )}
      {approvals.status === 'error' && (
        <ErrorState what="Your approvals" error={approvals.error} onRetry={approvals.refresh} />
      )}

      {approvals.status === 'success' && (
        <>
          <section aria-labelledby="pending-heading" className={styles.section}>
            <h2 id="pending-heading" className={styles.sectionTitle}>
              Waiting for you ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <StatusMessage variant="empty" title="Nothing waiting for your approval.">
                <p>When your assistant suggests an email, reminder or deadline, it appears here.</p>
              </StatusMessage>
            ) : (
              <ul className={styles.cards}>
                {pending.map((action) => (
                  <li key={action.id}>
                    <ApprovalCard
                      action={action}
                      isBusy={busyId === action.id}
                      onApprove={() => setConfirming(action)}
                      onReject={() => void decide(action, 'reject')}
                      onEdit={() => openEdit(action)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {history.length > 0 && (
            <section aria-labelledby="history-heading" className={styles.section}>
              <h2 id="history-heading" className={styles.sectionTitle}>
                Recently decided
              </h2>
              <ul className={styles.history}>
                {history.map((action) => (
                  <li key={action.id} className={styles.historyItem}>
                    <span className={styles.historyText}>
                      {action.summary}
                      {action.error && <span className={styles.historyError}>{action.error}</span>}
                    </span>
                    <Badge tone={STATUS_BADGES[action.status].tone}>
                      {STATUS_BADGES[action.status].label}
                    </Badge>
                    {action.decidedAt && (
                      <time className={styles.historyTime} dateTime={action.decidedAt}>
                        {formatDateTime(action.decidedAt)}
                      </time>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <Dialog
        open={confirming !== null}
        title="Approve this action?"
        onClose={() => setConfirming(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button onClick={() => confirming && void decide(confirming, 'approve')}>
              Yes, approve
            </Button>
          </>
        }
      >
        {confirming && (
          <>
            <p>
              <strong>{confirming.summary}</strong>
            </p>
            <ActionDetails preview={confirming.preview} />
            {confirming.preview.tool === 'draft_faculty_email' && (
              <p className={styles.dialogNote}>
                The email will be sent and can&apos;t be unsent (demo: delivered to the CampusMate
                demo outbox).
              </p>
            )}
          </>
        )}
      </Dialog>

      <Dialog
        open={editing !== null}
        title="Edit email before approving"
        onClose={() => setEditing(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveEdit()} disabled={busyId !== null}>
              Save changes
            </Button>
          </>
        }
      >
        {editing && (
          <>
            <TextField
              label="Subject"
              value={editing.subject}
              maxLength={120}
              onChange={(event) => setEditing({ ...editing, subject: event.target.value })}
            />
            <TextAreaField
              label="Message"
              value={editing.body}
              maxLength={2000}
              onChange={(event) => setEditing({ ...editing, body: event.target.value })}
              error={editing.error}
            />
          </>
        )}
      </Dialog>
    </div>
  );
}
