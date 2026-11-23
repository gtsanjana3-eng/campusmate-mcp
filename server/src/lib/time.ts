import type { Weekday } from '../../../shared/types/index.ts';

/** The demo college is in India; all wall-clock logic uses IST (UTC+05:30, no daylight saving). */
const IST_OFFSET_MS = 330 * 60_000;
const WEEKDAYS: readonly Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export type IstParts = { date: string; weekday: Weekday; minutes: number };

/** Calendar date ('YYYY-MM-DD'), weekday and minutes since midnight in India. */
export function istParts(instant: Date): IstParts {
  const ist = new Date(instant.getTime() + IST_OFFSET_MS);
  return {
    date: ist.toISOString().slice(0, 10),
    weekday: WEEKDAYS[ist.getUTCDay()] as Weekday,
    minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
  };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const weekdayOf = (date: string): Weekday =>
  WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] as Weekday;

/** ISO timestamp for a wall-clock time in India, e.g. 2026-11-26T23:59:00+05:30. */
export const istIso = (date: string, time: string) => `${date}T${time}:00+05:30`;

/** ISO timestamp `days` from `now` at a wall-clock time in India. */
export const istDateTime = (now: Date, days: number, time: string) =>
  istIso(addDays(istParts(now).date, days), time);

export const toMinutes = (time: string) => {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
};

export const fromMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** A human-friendly IST label, e.g. "Wed 26 Nov, 23:59". */
export function formatIst(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}
