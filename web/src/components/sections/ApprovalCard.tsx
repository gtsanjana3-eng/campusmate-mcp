import type { ActionPreview, PendingAction } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { STATUS_BADGES } from '@/lib/actionStatus';
import { formatDateTime } from '@/lib/format';
import styles from './ApprovalCard.module.css';

const TOOL_LABELS: Record<ActionPreview['tool'], string> = {
  draft_faculty_email: 'Email to faculty',
  add_deadline: 'New deadline',
  create_reminder: 'Reminder',
  mark_deadline_done: 'Mark deadline done',
};

/** Exactly what will happen if approved: this is the stored payload, not a paraphrase. */
export function ActionDetails({ preview }: { preview: ActionPreview }) {
  switch (preview.tool) {
    case 'draft_faculty_email':
      return (
        <dl className={styles.details}>
          <dt>To</dt>
          <dd>
            {preview.email.toName} &lt;{preview.email.toEmail}&gt;
          </dd>
          <dt>Subject</dt>
          <dd>{preview.email.subject}</dd>
          <dt>Message</dt>
          <dd className={styles.body}>{preview.email.body}</dd>
        </dl>
      );
    case 'add_deadline':
      return (
        <dl className={styles.details}>
          <dt>Subject</dt>
          <dd>{preview.deadline.subjectCode}</dd>
          <dt>Title</dt>
          <dd>{preview.deadline.title}</dd>
          <dt>Due</dt>
          <dd>{formatDateTime(preview.deadline.dueAt)}</dd>
          <dt>Type</dt>
          <dd>
            {preview.deadline.kind}
            {preview.deadline.source === 'notice' ? ' (found in a notice)' : ''}
          </dd>
        </dl>
      );
    case 'create_reminder':
      return (
        <dl className={styles.details}>
          <dt>Reminder</dt>
          <dd>{preview.reminder.text}</dd>
          <dt>When</dt>
          <dd>{formatDateTime(preview.reminder.remindAt)}</dd>
        </dl>
      );
    case 'mark_deadline_done':
      return (
        <dl className={styles.details}>
          <dt>Deadline</dt>
          <dd>
            {preview.deadline.subjectCode}: {preview.deadline.title}
          </dd>
          <dt>Was due</dt>
          <dd>{formatDateTime(preview.deadline.dueAt)}</dd>
        </dl>
      );
  }
}

type ApprovalCardProps = {
  action: PendingAction;
  isBusy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
};

export function ApprovalCard({ action, isBusy, onApprove, onReject, onEdit }: ApprovalCardProps) {
  const label = TOOL_LABELS[action.preview.tool];
  const isEmail = action.preview.tool === 'draft_faculty_email';

  return (
    <Card className={styles.card} aria-labelledby={`action-${action.id}`}>
      <div className={styles.header}>
        <h3 id={`action-${action.id}`} className={styles.title}>
          {label}
        </h3>
        <Badge tone={STATUS_BADGES[action.status].tone}>{STATUS_BADGES[action.status].label}</Badge>
      </div>

      <p className={styles.reason}>
        <span className={styles.reasonLabel}>Why the assistant suggested this:</span>{' '}
        {action.reason}
      </p>

      <ActionDetails preview={action.preview} />

      {isEmail && (
        <p className={styles.warning}>
          Once approved, the email is sent and can&apos;t be unsent. Demo: it goes to the CampusMate
          demo outbox, not a real inbox.
        </p>
      )}

      <p className={styles.meta}>
        Suggested {formatDateTime(action.createdAt)} · expires {formatDateTime(action.expiresAt)}
      </p>

      <div className={styles.actions}>
        <Button onClick={onApprove} disabled={isBusy}>
          Approve<span className="visually-hidden">: {action.summary}</span>
        </Button>
        {isEmail && (
          <Button variant="secondary" onClick={onEdit} disabled={isBusy}>
            Edit email<span className="visually-hidden">: {action.summary}</span>
          </Button>
        )}
        <Button variant="secondary" onClick={onReject} disabled={isBusy}>
          Reject<span className="visually-hidden">: {action.summary}</span>
        </Button>
      </div>
    </Card>
  );
}
