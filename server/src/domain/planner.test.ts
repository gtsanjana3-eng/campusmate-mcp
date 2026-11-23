import { describe, expect, it } from 'vitest';
import { istIso, toMinutes } from '../lib/time.ts';
import { seededStore, TEST_NOW } from '../test/helpers.ts';
import { getTimetable } from './academic.ts';
import { planWeek } from './planner.ts';

describe('planWeek', () => {
  const store = seededStore();
  const plan = planWeek(store, {}, TEST_NOW);
  const classes = getTimetable(store);

  it('never overlaps a class', () => {
    for (const block of plan.blocks) {
      const clash = classes.find(
        (c) =>
          c.day === block.day &&
          toMinutes(block.start) < toMinutes(c.end) &&
          toMinutes(c.start) < toMinutes(block.end),
      );
      expect(clash, `${block.date} ${block.start}`).toBeUndefined();
    }
  });

  it('only schedules sessions in the future that end before the deadline', () => {
    const deadlines = new Map(store.listDeadlines().map((d) => [d.id, d]));
    for (const block of plan.blocks) {
      expect(Date.parse(istIso(block.date, block.start))).toBeGreaterThan(TEST_NOW.getTime());
      const due = deadlines.get(block.deadlineId ?? '');
      expect(Date.parse(istIso(block.date, block.end))).toBeLessThanOrEqual(
        Date.parse(due?.dueAt ?? ''),
      );
    }
  });

  it('gives an exam two revision sessions', () => {
    expect(plan.blocks.filter((b) => b.deadlineId === 'dl-cn-quiz')).toHaveLength(2);
  });

  it('puts the focus subject first', () => {
    const focused = planWeek(seededStore(), { focusSubjectCode: 'ml' }, TEST_NOW);
    const first = focused.blocks.find((b) => b.deadlineId === 'dl-ml-a2');
    expect(first).toBeDefined();
    expect(first?.date).toBe('2026-11-24');
  });

  it('saves nothing', () => {
    const before = [
      store.count('deadlines'),
      store.count('reminders'),
      store.count('pending_actions'),
    ];
    planWeek(store, {}, TEST_NOW);
    expect([
      store.count('deadlines'),
      store.count('reminders'),
      store.count('pending_actions'),
    ]).toEqual(before);
  });

  it('rejects a malformed start date', () => {
    expect(() => planWeek(store, { weekStart: '30/11/2026' }, TEST_NOW)).toThrow(/weekStart/);
  });
});
