import type { ClassSession } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import styles from './Lists.module.css';

export function ClassList({ classes }: { classes: ClassSession[] }) {
  if (classes.length === 0) return <p className={styles.empty}>No classes today.</p>;
  return (
    <ul className={styles.list}>
      {classes.map((c) => (
        <li key={`${c.day}-${c.start}`} className={styles.item}>
          <span className={styles.time}>
            {c.start}–{c.end}
          </span>
          <span className={styles.main}>
            <span className={styles.title}>{c.subjectName}</span>
            <span className={styles.meta}>{c.room}</span>
          </span>
          <Badge tone={c.kind === 'lab' ? 'info' : 'neutral'}>{c.kind}</Badge>
        </li>
      ))}
    </ul>
  );
}
