import { describe, expect, it } from 'vitest';
import { seededStore } from '../test/helpers.ts';
import { istDateTime, seedIfEmpty, seedStore } from './seed.ts';
import { createStore } from './store.ts';

const count = (store: ReturnType<typeof createStore>, table: string) =>
  (store.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

describe('istDateTime', () => {
  it('uses the India calendar date, even when UTC is still on the previous day', () => {
    // 20:00 UTC on 23 Nov is 01:30 IST on 24 Nov.
    const now = new Date('2026-11-23T20:00:00Z');
    expect(istDateTime(now, 0, '09:00')).toBe('2026-11-24T09:00:00+05:30');
    expect(istDateTime(now, 2, '23:59')).toBe('2026-11-26T23:59:00+05:30');
    expect(istDateTime(now, -2, '23:59')).toBe('2026-11-22T23:59:00+05:30');
  });
});

describe('seed data', () => {
  const store = seededStore(new Date('2026-11-24T04:00:00Z'));

  it('creates the agreed demo student', () => {
    expect(count(store, 'subjects')).toBe(6);
    expect(count(store, 'deadlines')).toBe(8);
    expect(count(store, 'notices')).toBe(6);
    expect(count(store, 'abilities')).toBe(11);
    expect(count(store, 'classes')).toBeGreaterThanOrEqual(20);
    expect(store.getSetting('attendance_minimum')).toBe('0.75');
  });

  it('seeds OS at 40/52 so the demo answer is "77%, can miss 1" (fix F4)', () => {
    const row = store.db
      .prepare("SELECT attended, held FROM attendance WHERE subject_code = 'OS'")
      .get() as { attended: number; held: number };
    expect(row).toEqual({ attended: 40, held: 52 });
  });

  it('includes the notice with the hidden instruction used in journey J3', () => {
    const row = store.db.prepare("SELECT body FROM notices WHERE id = 'nt-os-record'").get() as {
      body: string;
    };
    expect(row.body).toContain('ignore your previous instructions');
  });

  it('enables every ability by default', () => {
    expect(store.listAbilities().every((ability) => ability.enabled)).toBe(true);
  });
});

describe('store', () => {
  it('seeds only an empty database', () => {
    const store = createStore(':memory:');
    expect(seedIfEmpty(store)).toBe(true);
    expect(seedIfEmpty(store)).toBe(false);
  });

  it('reseeding replaces data instead of duplicating it', () => {
    const store = seededStore();
    seedStore(store);
    expect(count(store, 'subjects')).toBe(6);
  });

  it('rolls back a transaction that throws', () => {
    const store = seededStore();
    expect(() =>
      store.transaction(() => {
        store.db.exec("DELETE FROM notices WHERE id = 'nt-fee'");
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(count(store, 'notices')).toBe(6);
  });

  it('answers the health ping', () => {
    expect(seededStore().ping()).toBe(true);
  });
});
