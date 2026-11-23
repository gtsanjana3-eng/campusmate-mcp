import { Link } from 'react-router';
import { AttendanceMeter } from '@/components/sections/AttendanceMeter';
import { ClassList } from '@/components/sections/ClassList';
import { DeadlineList } from '@/components/sections/DeadlineList';
import { ErrorState } from '@/components/sections/ErrorState';
import { Card } from '@/components/ui/Card';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { ROUTES } from '@/config/routes';
import { usePolling } from '@/hooks/usePolling';
import { formatLongDate } from '@/lib/format';
import { pageTitle } from '@/lib/pageTitle';
import { getAttendance, getToday } from '@/services/todayService';
import styles from './TodayPage.module.css';

const loadToday = async () => {
  const [today, attendance] = await Promise.all([getToday(), getAttendance()]);
  return { today, attendance };
};

/** The student's day at a glance: the same data the AI sees through get_today. */
export default function TodayPage() {
  // Same rate as the header badge, so the pending count shown in both places agrees.
  const view = usePolling(loadToday);

  return (
    <div className="container">
      <title>{pageTitle('Today')}</title>
      <h1 className={styles.heading}>Today</h1>

      {view.status === 'loading' && <StatusMessage variant="loading" title="Loading your day…" />}
      {view.status === 'error' && (
        <ErrorState what="Your day" error={view.error} onRetry={view.refresh} />
      )}

      {view.status === 'success' && (
        <>
          <p className={styles.date}>{formatLongDate(view.data.today.date)}</p>

          {view.data.today.pendingCount > 0 && (
            <output className={styles.pending}>
              <strong>
                {view.data.today.pendingCount}{' '}
                {view.data.today.pendingCount === 1 ? 'action is' : 'actions are'} waiting for your
                approval.
              </strong>{' '}
              <Link to={ROUTES.approvals}>Review them</Link>
            </output>
          )}

          <div className={styles.grid}>
            <Card className={styles.card}>
              <h2 className={styles.cardTitle}>Classes</h2>
              <ClassList classes={view.data.today.classes} />
            </Card>

            <Card className={styles.card}>
              <h2 className={styles.cardTitle}>Due in the next 3 days</h2>
              <DeadlineList deadlines={view.data.today.dueSoon} empty="Nothing due soon." />
            </Card>

            <Card className={`${styles.card} ${styles.wide}`}>
              <h2 className={styles.cardTitle}>Attendance</h2>
              <p className={styles.note}>
                Minimum {view.data.attendance.minimumPercent}% per subject. The numbers are
                calculated exactly, not estimated.
              </p>
              <AttendanceMeter
                subjects={view.data.attendance.subjects}
                minimumPercent={view.data.attendance.minimumPercent}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
