import type { Weekday } from '@shared/types';

/** All times are shown in India Standard Time, matching the college. */
const TIME_ZONE = 'Asia/Kolkata';

const dateTime = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const longDate = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "Wed 25 Nov, 09:00" */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

/** "Tuesday 24 November" for a 'YYYY-MM-DD' calendar date. */
export const formatLongDate = (date: string) => longDate.format(new Date(`${date}T12:00:00+05:30`));

const DAY_NAMES: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export const dayName = (day: Weekday) => DAY_NAMES[day];
