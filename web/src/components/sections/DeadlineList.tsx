import type { Deadline } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/format';
import styles from './Lists.module.css';

type DeadlineListProps = { deadlines: Deadline[]; empty: string };

export function DeadlineList({ deadlines, empty }: DeadlineListProps) {
  if (deadlines.length === 0) return <p className={styles.empty}>{empty}</p>;
  return (
    <ul className={styles.list}>
      {deadlines.map((d) => (
        <li key={d.id} className={styles.item}>
          <span className={styles.main}>
            <span className={styles.title}>{d.title}</span>
            <span className={styles.meta}>
              {d.subjectCode} · due <time dateTime={d.dueAt}>{formatDateTime(d.dueAt)}</time>
            </span>
          </span>
          <Badge tone={d.kind === 'exam' ? 'warning' : 'neutral'}>{d.kind}</Badge>
        </li>
      ))}
    </ul>
  );
}
