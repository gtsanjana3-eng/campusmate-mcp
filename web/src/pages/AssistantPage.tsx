import type { ActivityKind } from '@shared/types';
import { Link } from 'react-router';
import { ErrorState } from '@/components/sections/ErrorState';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { CopyField } from '@/components/ui/CopyField';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { ROUTES } from '@/config/routes';
import { usePolling } from '@/hooks/usePolling';
import { formatDateTime } from '@/lib/format';
import { pageTitle } from '@/lib/pageTitle';
import { listActivity } from '@/services/activityService';
import styles from './AssistantPage.module.css';

/** Questions that exercise CampusMate's tools; the student pastes them into Claude. */
const PROMPTS = [
  ['Your day', 'What do I have today, and is my attendance safe in every subject?'],
  ['Skipping a class', 'Can I skip Operating Systems tomorrow?'],
  ['Plan the week', 'Plan my study time for this week around my deadlines.'],
  [
    'Write to faculty',
    'Draft an email to my DBMS professor asking for two more days on the ER diagram.',
  ],
] as const;

const KINDS: Record<ActivityKind, { tone: BadgeTone; label: string }> = {
  read: { tone: 'neutral', label: 'Read' },
  proposed: { tone: 'info', label: 'Suggested' },
  approved: { tone: 'success', label: 'Done' },
  rejected: { tone: 'neutral', label: 'Rejected' },
  blocked: { tone: 'warning', label: 'Blocked' },
  failed: { tone: 'danger', label: 'Failed' },
  edited: { tone: 'neutral', label: 'Edited' },
};

const loadActivity = async () => (await listActivity()).entries;

/** Decisions are the student's own; everything else came from the assistant over MCP. */
const BY_STUDENT: ActivityKind[] = ['approved', 'rejected', 'edited'];

/**
 * The assistant hub. CampusMate has no AI model of its own: the assistant is Claude, connected over
 * MCP. This page shows whether it has been used, questions to ask it, and what it actually did.
 */
export default function AssistantPage() {
  const activity = usePolling(loadActivity);
  const lastUse =
    activity.status === 'success'
      ? activity.data.find((entry) => !BY_STUDENT.includes(entry.kind))
      : undefined;

  return (
    <div className={`container ${styles.page}`}>
      <title>{pageTitle('Assistant')}</title>
      <PageHeader
        title="Your AI assistant"
        description="Claude works with CampusMate through MCP: it reads your college day and suggests actions, and you approve them here."
      />

      <div className={styles.top}>
        <Card className={styles.status}>
          <h2 className={styles.cardTitle}>Connection</h2>
          {activity.status === 'loading' && <p className={styles.note}>Checking…</p>}
          {activity.status === 'success' &&
            (lastUse ? (
              <>
                <p className={styles.state}>
                  <span className={styles.dotOn} aria-hidden="true" /> In use
                </p>
                <p className={styles.note}>
                  Last used {formatDateTime(lastUse.at)}
                  {lastUse.tool && (
                    <>
                      {' '}
                      with <code>{lastUse.tool}</code>
                    </>
                  )}
                  .
                </p>
              </>
            ) : (
              <>
                <p className={styles.state}>
                  <span className={styles.dotOff} aria-hidden="true" /> Not used yet
                </p>
                <p className={styles.note}>
                  Add CampusMate to Claude on the <Link to={ROUTES.connect}>Connect page</Link>,
                  then ask one of the questions here.
                </p>
              </>
            ))}
        </Card>

        <Card className={styles.prompts}>
          <h2 className={styles.cardTitle}>Ask your assistant</h2>
          <p className={styles.note}>
            Copy a question into Claude. Answers come from your real data.
          </p>
          {PROMPTS.map(([label, prompt]) => (
            <CopyField key={label} label={label} value={prompt} />
          ))}
        </Card>
      </div>

      <section aria-labelledby="timeline-heading">
        <div className={styles.timelineHead}>
          <h2 id="timeline-heading" className={styles.cardTitle}>
            What your assistant did
          </h2>
          <Link to={ROUTES.activity}>Full activity log</Link>
        </div>

        {activity.status === 'loading' && (
          <StatusMessage variant="loading" title="Loading what your assistant did…" />
        )}
        {activity.status === 'error' && (
          <ErrorState
            what="Your assistant's activity"
            error={activity.error}
            onRetry={activity.refresh}
          />
        )}
        {activity.status === 'success' && activity.data.length === 0 && (
          <StatusMessage variant="empty" title="Nothing yet.">
            <p>When your assistant reads or suggests something, it appears here.</p>
          </StatusMessage>
        )}
        {activity.status === 'success' && activity.data.length > 0 && (
          <ol className={styles.timeline}>
            {activity.data.slice(0, 15).map((entry) => (
              <li
                key={entry.id}
                className={BY_STUDENT.includes(entry.kind) ? styles.fromYou : styles.fromAi}
              >
                <span className={styles.who}>
                  {BY_STUDENT.includes(entry.kind) ? 'You' : 'Assistant'}
                </span>
                <span className={styles.bubble}>
                  <Badge tone={KINDS[entry.kind].tone}>{KINDS[entry.kind].label}</Badge>
                  <span>{entry.summary}</span>
                  <span className={styles.meta}>
                    {formatDateTime(entry.at)}
                    {entry.tool && (
                      <>
                        {' · MCP tool '}
                        <code>{entry.tool}</code>
                      </>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
