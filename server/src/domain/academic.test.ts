import { describe, expect, it } from 'vitest';
import { seededStore, TEST_NOW } from '../test/helpers.ts';
import {
  attendanceStats,
  getAttendance,
  getToday,
  listDeadlines,
  listNotices,
  resolveSubject,
} from './academic.ts';

const atLeast = (attended: number, held: number) => attended / held >= 0.75 - 1e-9;

describe('attendanceStats (the "safe to skip" maths)', () => {
  it.each([
    // attended, held, expected percent, canMiss, mustAttend
    [40, 52, 76.9, 1, 0], // seeded OS: the demo answer "77%, can miss 1"
    [30, 40, 75, 0, 0], // exactly at the minimum: can't miss any
    [30, 42, 71.4, 0, 6], // below: (30+6)/(42+6) = 75%
    [52, 52, 100, 17, 0], // 52/(52+17) = 75.4%, one more would drop below
    [3, 4, 75, 0, 0],
    [0, 0, 100, 0, 0], // no classes held yet
  ])(
    '%i of %i → %d%%, canMiss %i, mustAttend %i',
    (attended, held, percent, canMiss, mustAttend) => {
      expect(attendanceStats(attended, held, 0.75)).toEqual({ percent, canMiss, mustAttend });
    },
  );

  it('is exactly right for every case up to 60 classes', () => {
    const wrong: string[] = [];
    for (let held = 1; held <= 60; held++) {
      for (let attended = 0; attended <= held; attended++) {
        const { canMiss, mustAttend } = attendanceStats(attended, held, 0.75);
        const correct = atLeast(attended, held)
          ? // At or above: missing canMiss more is fine, one more is not.
            mustAttend === 0 &&
            atLeast(attended, held + canMiss) &&
            !atLeast(attended, held + canMiss + 1)
          : // Below: attending mustAttend in a row recovers, one fewer does not.
            canMiss === 0 &&
            atLeast(attended + mustAttend, held + mustAttend) &&
            !atLeast(attended + mustAttend - 1, held + mustAttend - 1);
        if (!correct) wrong.push(`${attended}/${held}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('academic reads on the demo student (Tue 24 Nov, 10:30 IST)', () => {
  const store = seededStore();

  it("lists today's classes in time order", () => {
    const today = getToday(store, TEST_NOW);
    expect(today.date).toBe('2026-11-24');
    expect(today.classes.map((c) => c.subjectCode)).toEqual(['OS', 'SE', 'ML', 'PE']);
  });

  it('shows only open deadlines due in the next 72 hours', () => {
    const due = getToday(store, TEST_NOW).dueSoon.map((d) => d.id);
    expect(due).toEqual(['dl-cn-quiz', 'dl-dbms-er']);
  });

  it('flags subjects below the minimum or within two classes of it', () => {
    const alerts = getToday(store, TEST_NOW).attendanceAlerts.map((a) => a.subjectCode);
    expect(alerts.toSorted()).toEqual(['CN', 'OS', 'PE']);
  });

  it('accepts subject codes in any case and by full name', () => {
    expect(resolveSubject(store, 'dbms').code).toBe('DBMS');
    expect(resolveSubject(store, 'Operating Systems').code).toBe('OS');
  });

  it('explains unknown subjects by listing the real ones', () => {
    expect(() => getAttendance(store, 'Chemistry')).toThrow(
      /Known subjects: CN \(Computer Networks\)/,
    );
  });

  it('hides done deadlines unless asked', () => {
    expect(listDeadlines(store)).toHaveLength(7);
    expect(listDeadlines(store, { includeDone: true })).toHaveLength(8);
    expect(listDeadlines(store, { subjectCode: 'dbms' }).map((d) => d.id)).toEqual([
      'dl-dbms-er',
      'dl-dbms-cie',
    ]);
  });

  it('rejects malformed dates', () => {
    expect(() => listDeadlines(store, { from: 'next tuesday' })).toThrow(/ISO 8601/);
  });

  it('searches notices and respects the limit', () => {
    expect(listNotices(store, { query: 'lab record' }).map((n) => n.id)).toEqual(['nt-os-record']);
    expect(listNotices(store, { limit: 2 })).toHaveLength(2);
  });
});
