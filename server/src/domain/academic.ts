import type {
  AttendanceRow,
  ClassSession,
  Deadline,
  GetTodayOutput,
  Notice,
  Weekday,
} from '../../../shared/types/index.ts';
import type { Store, SubjectRecord } from '../data/store.ts';
import { fromMinutes, istIso, istParts } from '../lib/time.ts';
import { pendingSummary } from './approvals.ts';
import { AppError, validationError } from './errors.ts';

const DEFAULT_MINIMUM = 0.75;
const EPSILON = 1e-9;

export function attendanceMinimum(store: Store): number {
  const value = Number(store.getSetting('attendance_minimum'));
  return value > 0 && value < 1 ? value : DEFAULT_MINIMUM;
}

/**
 * The "safe to skip" maths, done by code rather than guessed by the AI.
 * With `a` attended of `h` held and minimum `m`:
 *   canMiss    = floor(a/m − h)           when a/h ≥ m
 *   mustAttend = ceil((m·h − a) / (1 − m)) when a/h < m
 */
export function attendanceStats(attended: number, held: number, minimum: number) {
  if (held === 0) return { percent: 100, canMiss: 0, mustAttend: 0 };
  const ratio = attended / held;
  const percent = Math.round(ratio * 1000) / 10;
  if (ratio + EPSILON >= minimum) {
    return {
      percent,
      canMiss: Math.max(0, Math.floor(attended / minimum - held + EPSILON)),
      mustAttend: 0,
    };
  }
  return {
    percent,
    canMiss: 0,
    mustAttend: Math.ceil((minimum * held - attended) / (1 - minimum) - EPSILON),
  };
}

/** Accepts "os", "OS" or a subject name like "Operating Systems". */
export function resolveSubject(store: Store, codeOrName: string): SubjectRecord {
  const wanted = codeOrName.trim().toLowerCase();
  const subjects = store.listSubjects();
  const match = subjects.find(
    (s) => s.code.toLowerCase() === wanted || s.name.toLowerCase() === wanted,
  );
  if (!match) {
    const known = subjects.map((s) => `${s.code} (${s.name})`).join(', ');
    throw new AppError(
      'not_found',
      404,
      `No subject matches “${codeOrName}”. Known subjects: ${known}.`,
    );
  }
  return match;
}

export function getAttendance(store: Store, subjectCode?: string): AttendanceRow[] {
  const minimum = attendanceMinimum(store);
  const code = subjectCode ? resolveSubject(store, subjectCode).code : undefined;
  return store
    .listAttendance()
    .filter((row) => !code || row.subjectCode === code)
    .map((row) => ({ ...row, ...attendanceStats(row.attended, row.held, minimum) }));
}

export function getTimetable(store: Store, day?: Weekday): ClassSession[] {
  return store.listClasses().filter((c) => !day || c.day === day);
}

export function listDeadlines(
  store: Store,
  filter: { from?: string; to?: string; subjectCode?: string; includeDone?: boolean } = {},
): Deadline[] {
  const from = filter.from ? Date.parse(filter.from) : undefined;
  const to = filter.to ? Date.parse(filter.to) : undefined;
  if (Number.isNaN(from) || Number.isNaN(to)) throw validationError('Dates must be ISO 8601.');
  const code = filter.subjectCode ? resolveSubject(store, filter.subjectCode).code : undefined;

  return store.listDeadlines().filter((d) => {
    const due = Date.parse(d.dueAt);
    return (
      (filter.includeDone || d.status === 'open') &&
      (!code || d.subjectCode === code) &&
      (from === undefined || due >= from) &&
      (to === undefined || due <= to)
    );
  });
}

export function listNotices(
  store: Store,
  filter: { since?: string; query?: string; limit?: number } = {},
): Notice[] {
  const since = filter.since ? Date.parse(filter.since) : undefined;
  if (Number.isNaN(since)) throw validationError('`since` must be an ISO 8601 date.');
  const query = filter.query?.trim().toLowerCase();
  return store
    .listNotices()
    .filter(
      (n) =>
        (since === undefined || Date.parse(n.postedAt) >= since) &&
        (!query || `${n.title} ${n.body}`.toLowerCase().includes(query)),
    )
    .slice(0, filter.limit ?? 10);
}

const HOURS_72 = 72 * 3_600_000;
const HOURS_24 = 24 * 3_600_000;

export function getToday(store: Store, now: Date): GetTodayOutput {
  const { date, weekday, minutes } = istParts(now);
  const minimumPercent = attendanceMinimum(store) * 100;
  return {
    date,
    now: istIso(date, fromMinutes(minutes)),
    weekday,
    classes: getTimetable(store, weekday),
    dueSoon: listDeadlines(store, {
      from: now.toISOString(),
      to: new Date(now.getTime() + HOURS_72).toISOString(),
    }),
    // Below the minimum, or close enough that two more absences would matter.
    attendanceAlerts: getAttendance(store).filter(
      (row) => row.percent < minimumPercent || row.canMiss <= 2,
    ),
    pending: pendingSummary(store, new Date(now.getTime() - HOURS_24), now),
  };
}
