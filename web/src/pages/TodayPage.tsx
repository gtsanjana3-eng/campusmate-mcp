import type { SessionStatusResponse } from '@shared/types';
import { Link, useOutletContext } from 'react-router';
import { AttendanceMeter } from '@/components/sections/AttendanceMeter';
import { ClassList } from '@/components/sections/ClassList';
import { DeadlineList } from '@/components/sections/DeadlineList';
import { ErrorState } from '@/components/sections/ErrorState';
import { CampusIllustration } from '@/components/ui/CampusIllustration';
import { Card } from '@/components/ui/Card';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { ROUTES } from '@/config/routes';
import { usePolling } from '@/hooks/usePolling';
import { formatDateTime, formatLongDate } from '@/lib/format';
import { pageTitle } from '@/lib/pageTitle';
import { listActivity } from '@/services/activityService';
import { getAttendance, getToday } from '@/services/todayService';
import styles from './TodayPage.module.css';

const loadDashboard = async () => {
  const [today, attendance, activity] = await Promise.all([
    getToday(),
    getAttendance(),
    listActivity(),
  ]);
  return { today, attendance, recent: activity.entries.slice(0, 3) };
};

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

/** The student's day at a glance: the same data the AI sees through get_today. */
export default function TodayPage() {
  const { user } = useOutletContext<SessionStatusResponse>();
  // Same rate as the header badge, so the pending count shown in both places agrees.
  const view = usePolling(loadDashboard);

  return (
    <div className="container">
      <title>{pageTitle('Dashboard')}</title>

      <section className={styles.hero} aria-labelledby="dashboard-heading">
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>
            {view.status === 'success' ? formatLongDate(view.data.today.date) : 'Your campus day'}
          </p>
          <h1 id="dashboard-heading" className={styles.heroTitle}>
            {greeting()}, {user.name}
          </h1>
          <p className={styles.heroLead}>
            Your classes, what&apos;s due soon and your attendance: the same data your AI assistant
            reads.
          </p>
          {view.status === 'success' && (
            <dl className={styles.stats}>
              <div>
                <dt>Classes today</dt>
                <dd>{view.data.today.classes.length}</dd>
              </div>
              <div>
                <dt>Due in 3 days</dt>
                <dd>{view.data.today.dueSoon.length}</dd>
              </div>
              <div>
                <dt>Waiting for you</dt>
                <dd>
                  <Link to={ROUTES.approvals}>{view.data.today.pendingCount}</Link>
                </dd>
              </div>
              <div>
                <dt>Subjects to watch</dt>
                <dd>{view.data.today.attendanceAlerts.length}</dd>
              </div>
            </dl>
          )}
        </div>
        <CampusIllustration className={styles.heroArt} />
      </section>

      {view.status === 'loading' && <StatusMessage variant="loading" title="Loading your day…" />}
      {view.status === 'error' && (
        <ErrorState what="Your day" error={view.error} onRetry={view.refresh} />
      )}

      {view.status === 'success' && (
        <>
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

          <Card className={styles.assistant}>
            <div className={styles.assistantHead}>
              <h2 className={styles.cardTitle}>Your AI assistant</h2>
              <Link className={styles.assistantLink} to={ROUTES.assistant}>
                Open assistant
              </Link>
            </div>
            {view.data.recent.length === 0 ? (
              <p className={styles.note}>
                Nothing yet. Connect Claude on the <Link to={ROUTES.connect}>Connect page</Link> and
                ask “What do I have today?”.
              </p>
            ) : (
              <ul className={styles.recent}>
                {view.data.recent.map((entry) => (
                  <li key={entry.id}>
                    <span>{entry.summary}</span>
                    <span className={styles.note}>
                      {formatDateTime(entry.at)}
                      {entry.tool && (
                        <>
                          {' · '}
                          <code>{entry.tool}</code>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

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
