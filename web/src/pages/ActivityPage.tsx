import type { ActivityKind } from '@shared/types';
import { ErrorState } from '@/components/sections/ErrorState';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { usePolling } from '@/hooks/usePolling';
import { formatDateTime } from '@/lib/format';
import { pageTitle } from '@/lib/pageTitle';
import { listActivity } from '@/services/activityService';
import lists from '@/components/sections/Lists.module.css';
import styles from './ActivityPage.module.css';
import { PageHeader } from '@/components/ui/PageHeader';

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

/** Everything CampusMate read, suggested, did or refused, newest first, in plain language. */
export default function ActivityPage() {
  const activity = usePolling(loadActivity);

  return (
    <div className={`container ${styles.page}`}>
      <title>{pageTitle('Activity')}</title>
      <PageHeader
        title="Activity"
        description="Every time your assistant used CampusMate: which tool it used, what it read or suggested, and what happened."
      />

      {activity.status === 'loading' && (
        <StatusMessage variant="loading" title="Loading activity…" />
      )}
      {activity.status === 'error' && (
        <ErrorState what="Your activity" error={activity.error} onRetry={activity.refresh} />
      )}
      {activity.status === 'success' && activity.data.length === 0 && (
        <StatusMessage variant="empty" title="No activity yet.">
          <p>Ask your AI assistant something about your day, and it will show up here.</p>
        </StatusMessage>
      )}
      {activity.status === 'success' && activity.data.length > 0 && (
        <ol className={lists.list}>
          {activity.data.map((entry) => (
            <li key={entry.id} className={lists.item}>
              <span className={styles.kind}>
                <Badge tone={KINDS[entry.kind].tone}>{KINDS[entry.kind].label}</Badge>
              </span>
              <span className={lists.main}>
                <span>{entry.summary}</span>
                <span className={lists.meta}>
                  <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
                  {entry.tool && (
                    <>
                      {' · MCP tool '}
                      <code className={styles.tool}>{entry.tool}</code>
                    </>
                  )}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
