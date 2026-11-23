import { describe, expect, it } from 'vitest';
import { seededStore } from '../test/helpers.ts';
import { listAbilities, requireAbility, setAbility } from './abilities.ts';
import { listActivity, logActivity, MAX_ACTIVITY } from './activity.ts';
import { AppError } from './errors.ts';

describe('abilities', () => {
  it('lists read abilities before act abilities', () => {
    const groups = listAbilities(seededStore()).map((ability) => ability.group);
    expect(groups.indexOf('act')).toBeGreaterThan(groups.lastIndexOf('read'));
  });

  it('allows an enabled ability', () => {
    expect(requireAbility(seededStore(), 'get_attendance').enabled).toBe(true);
  });

  it('refuses a disabled ability with a plain-language reason', () => {
    const store = seededStore();
    setAbility(store, 'draft_faculty_email', false);
    const attempt = () => requireAbility(store, 'draft_faculty_email');
    expect(attempt).toThrow(AppError);
    expect(attempt).toThrow(/Draft emails to faculty/);
  });

  it('rejects unknown abilities', () => {
    expect(() => setAbility(seededStore(), 'launch_rockets', true)).toThrow(/not found/);
  });
});

describe('activity log', () => {
  it('returns newest entries first', () => {
    const store = seededStore();
    logActivity(store, { kind: 'read', tool: 'get_today', summary: 'first' });
    logActivity(store, { kind: 'read', tool: 'get_today', summary: 'second' });
    expect(listActivity(store).map((entry) => entry.summary)).toEqual(['second', 'first']);
  });

  it('clamps the limit to a sensible range', () => {
    const store = seededStore();
    for (let i = 0; i < MAX_ACTIVITY + 5; i++) {
      logActivity(store, { kind: 'read', summary: `entry ${i}` });
    }
    expect(listActivity(store, 0)).toHaveLength(1);
    expect(listActivity(store, 10_000)).toHaveLength(MAX_ACTIVITY);
  });
});
