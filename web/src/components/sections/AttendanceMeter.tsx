import type { AttendanceRow } from '@shared/types';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import styles from './AttendanceMeter.module.css';

type AttendanceMeterProps = { subjects: AttendanceRow[]; minimumPercent: number };

/** Plain-language status; the numbers come from the server's exact calculation. */
function status(row: AttendanceRow, minimumPercent: number): { tone: BadgeTone; text: string } {
  if (row.percent < minimumPercent) {
    return { tone: 'danger', text: `Attend the next ${row.mustAttend} classes` };
  }
  if (row.canMiss === 0) return { tone: 'warning', text: "Can't miss any more" };
  if (row.canMiss <= 2) return { tone: 'warning', text: `Can miss ${row.canMiss} more` };
  return { tone: 'success', text: `Can miss ${row.canMiss} more` };
}

export function AttendanceMeter({ subjects, minimumPercent }: AttendanceMeterProps) {
  return (
    <ul className={styles.list}>
      {subjects.map((row) => {
        const { tone, text } = status(row, minimumPercent);
        return (
          <li key={row.subjectCode} className={styles.row}>
            <div className={styles.heading}>
              <span className={styles.name}>
                {row.subjectName} <span className={styles.code}>({row.subjectCode})</span>
              </span>
              <Badge tone={tone}>{text}</Badge>
            </div>
            <div className={styles.barRow}>
              {/* The bar is decorative; the figures next to it carry the meaning. */}
              <div className={styles.track} aria-hidden="true">
                <div
                  className={`${styles.fill} ${styles[tone]}`}
                  style={{ inlineSize: `${Math.min(row.percent, 100)}%` }}
                />
                <div
                  className={styles.minimum}
                  style={{ insetInlineStart: `${minimumPercent}%` }}
                />
              </div>
              <span className={styles.figures}>
                {row.percent}%{' '}
                <span className={styles.code}>
                  ({row.attended}/{row.held})
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
