import type { ClassSession, Deadline, StudyBlock } from '../../../shared/types/index.ts';
import type { Store } from '../data/store.ts';
import { addDays, fromMinutes, istIso, istParts, toMinutes, weekdayOf } from '../lib/time.ts';
import { getTimetable, listDeadlines, resolveSubject } from './academic.ts';
import { validationError } from './errors.ts';

type Slot = { date: string; start: number; end: number };

const DAY_START = toMinutes('09:00');
const DAY_END = toMinutes('17:00');
const EVENING = { start: toMinutes('18:00'), end: toMinutes('20:00') };
const SUNDAY = [
  { start: toMinutes('10:00'), end: toMinutes('12:00') },
  { start: toMinutes('15:00'), end: toMinutes('17:00') },
];
const MIN_GAP = 60;

/** Free study slots on one day: gaps of an hour or more between classes, plus the evening. */
function slotsFor(date: string, classes: ClassSession[]): Slot[] {
  const day = weekdayOf(date);
  if (day === 'sun') return SUNDAY.map((s) => ({ date, ...s }));

  const busy = classes
    .filter((c) => c.day === day)
    .map((c) => ({ start: toMinutes(c.start), end: toMinutes(c.end) }))
    .toSorted((a, b) => a.start - b.start);

  const slots: Slot[] = [];
  let cursor = DAY_START;
  for (const block of busy) {
    if (block.start - cursor >= MIN_GAP) slots.push({ date, start: cursor, end: block.start });
    cursor = Math.max(cursor, block.end);
  }
  if (DAY_END - cursor >= MIN_GAP) slots.push({ date, start: cursor, end: DAY_END });
  slots.push({ date, ...EVENING });
  return slots;
}

/** Exams get two sessions to revise; everything else gets one. */
const sessionsNeeded = (deadline: Deadline) => (deadline.kind === 'exam' ? 2 : 1);

export type WeekPlan = { weekStart: string; blocks: StudyBlock[]; unplaced: Deadline[] };

/**
 * Suggests study blocks for the next 7 days. It saves nothing: the student (or the AI) decides
 * what to do with the plan. Blocks never overlap a class and always end before the deadline.
 */
export function planWeek(
  store: Store,
  options: { weekStart?: string; focusSubjectCode?: string },
  now: Date,
): WeekPlan {
  if (options.weekStart && !/^\d{4}-\d{2}-\d{2}$/.test(options.weekStart)) {
    throw validationError('weekStart must be a date like 2026-11-30.');
  }
  const today = istParts(now);
  const weekStart = options.weekStart ?? today.date;
  const focus = options.focusSubjectCode
    ? resolveSubject(store, options.focusSubjectCode).code
    : undefined;

  const classes = getTimetable(store);
  const nowMs = now.getTime();
  const slots = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    .flatMap((date) => slotsFor(date, classes))
    // Only slots that haven't started yet.
    .filter((slot) => Date.parse(istIso(slot.date, fromMinutes(slot.start))) > nowMs);

  const weekEnd = Date.parse(istIso(addDays(weekStart, 8), '00:00'));
  const deadlines = listDeadlines(store, { from: now.toISOString() })
    .filter((d) => Date.parse(d.dueAt) < weekEnd)
    .toSorted(
      (a, b) =>
        Number(b.subjectCode === focus) - Number(a.subjectCode === focus) ||
        Date.parse(a.dueAt) - Date.parse(b.dueAt),
    );

  const used = new Set<Slot>();
  const blocks: StudyBlock[] = [];
  const unplaced: Deadline[] = [];

  for (const deadline of deadlines) {
    const due = Date.parse(deadline.dueAt);
    const available = slots.filter(
      (slot) => !used.has(slot) && Date.parse(istIso(slot.date, fromMinutes(slot.end))) <= due,
    );
    const chosen = available.slice(0, sessionsNeeded(deadline));
    if (chosen.length === 0) {
      unplaced.push(deadline);
      continue;
    }
    for (const slot of chosen) {
      used.add(slot);
      // Study sessions are capped at two hours.
      const end = Math.min(slot.end, slot.start + 120);
      blocks.push({
        date: slot.date,
        day: weekdayOf(slot.date),
        start: fromMinutes(slot.start),
        end: fromMinutes(end),
        task: `${deadline.kind === 'exam' ? 'Revise for' : 'Work on'} ${deadline.subjectCode}: ${deadline.title}`,
        deadlineId: deadline.id,
      });
    }
  }

  blocks.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  return { weekStart, blocks, unplaced };
}
