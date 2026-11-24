import { describe, expect, it } from 'vitest';
import type { ActionPreview } from '../../../shared/types/index.ts';
import { createDemoOutbox } from '../sources/mailer.ts';
import { seededStore, TEST_NOW } from '../test/helpers.ts';
import { setAbility } from './abilities.ts';
import { listActivity } from './activity.ts';
import {
  approveAction,
  EXPIRY_MS,
  MAX_PENDING,
  editEmailDraft,
  listActions,
  pendingSummary,
  propose,
  rejectAction,
} from './approvals.ts';

const email: ActionPreview = {
  tool: 'draft_faculty_email',
  email: {
    toName: 'Prof. K. Rao',
    toEmail: 'k.rao@college.example.edu',
    subject: 'Extension request',
    body: 'Dear Prof. Rao, could I have two more days? Ananya',
  },
};

function setup() {
  const store = seededStore();
  const deps = { mailer: createDemoOutbox(store), now: TEST_NOW };
  return { store, deps };
}

describe('approval state machine', () => {
  it('proposing records a pending action and changes nothing else', () => {
    const { store } = setup();
    const action = propose(store, { preview: email, reason: 'Student asked' }, TEST_NOW);
    expect(action.status).toBe('pending');
    expect(store.count('outbox')).toBe(0);
  });

  it('runs an approved email exactly once, into the demo outbox', () => {
    const { store, deps } = setup();
    const { id } = propose(store, { preview: email, reason: 'Student asked' }, TEST_NOW);

    expect(approveAction(store, id, deps).status).toBe('done');
    expect(store.count('outbox')).toBe(1);
    expect(listActivity(store)[0]?.summary).toContain('demo outbox');

    expect(() => approveAction(store, id, deps)).toThrow(/already done/);
    expect(store.count('outbox')).toBe(1);
  });

  it('cannot approve something already rejected', () => {
    const { store, deps } = setup();
    const { id } = propose(store, { preview: email, reason: 'Student asked' }, TEST_NOW);
    expect(rejectAction(store, id, TEST_NOW).status).toBe('rejected');
    expect(() => approveAction(store, id, deps)).toThrow(/already rejected/);
    expect(store.count('outbox')).toBe(0);
  });

  it('fails safely if the ability was switched off before approval', () => {
    const { store, deps } = setup();
    const { id } = propose(store, { preview: email, reason: 'Student asked' }, TEST_NOW);
    setAbility(store, 'draft_faculty_email', false);

    const action = approveAction(store, id, deps);
    expect(action.status).toBe('failed');
    expect(action.error).toMatch(/turned off/);
    expect(store.count('outbox')).toBe(0);
  });

  it('expires proposals after 24 hours', () => {
    const { store, deps } = setup();
    const { id } = propose(store, { preview: email, reason: 'Student asked' }, TEST_NOW);
    const later = new Date(TEST_NOW.getTime() + EXPIRY_MS + 1000);

    expect(listActions(store, undefined, later)[0]?.status).toBe('expired');
    expect(() => approveAction(store, id, { ...deps, now: later })).toThrow(/already expired/);
  });

  it('lets the student edit an email draft, and only that', () => {
    const { store } = setup();
    const { id } = propose(store, { preview: email, reason: 'Student asked' }, TEST_NOW);
    const edited = editEmailDraft(
      store,
      id,
      { subject: 'Request for a short extension' },
      TEST_NOW,
    );
    expect(edited.preview).toMatchObject({ email: { subject: 'Request for a short extension' } });

    const reminder = propose(
      store,
      {
        preview: {
          tool: 'create_reminder',
          reminder: { text: 'Submit record', remindAt: '2026-11-27T18:00:00+05:30' },
        },
        reason: 'Student asked',
      },
      TEST_NOW,
    );
    expect(() => editEmailDraft(store, reminder.id, { subject: 'x' }, TEST_NOW)).toThrow(
      /Only email drafts/,
    );
  });

  it('creates the deadline the student approved, linked to the proposal', () => {
    const { store, deps } = setup();
    const { id } = propose(
      store,
      {
        preview: {
          tool: 'add_deadline',
          deadline: {
            subjectCode: 'OS',
            title: 'Viva',
            dueAt: '2026-11-30T10:00:00+05:30',
            kind: 'exam',
            source: 'notice',
          },
        },
        reason: 'From the lab notice',
      },
      TEST_NOW,
    );
    approveAction(store, id, deps);
    const created = store.listDeadlines().find((d) => d.title === 'Viva');
    expect(created).toMatchObject({ subjectCode: 'OS', status: 'open', source: 'notice' });
  });

  it('marks a deadline done once, and fails clearly if it is already done', () => {
    const { store, deps } = setup();
    const deadline = store.getDeadline('dl-dbms-er');
    if (!deadline) throw new Error('seed missing');
    const preview: ActionPreview = { tool: 'mark_deadline_done', deadline };
    const first = propose(store, { preview, reason: 'Submitted' }, TEST_NOW);
    const second = propose(store, { preview, reason: 'Submitted' }, TEST_NOW);

    expect(approveAction(store, first.id, deps).status).toBe('done');
    expect(store.getDeadline('dl-dbms-er')?.status).toBe('done');
    const again = approveAction(store, second.id, deps);
    expect(again).toMatchObject({
      status: 'failed',
      error: 'That deadline is already marked as done.',
    });
  });

  it('summarises recent proposals for get_today', () => {
    const { store, deps } = setup();
    const { id } = propose(store, { preview: email, reason: 'Student asked' }, TEST_NOW);
    approveAction(store, id, deps);
    const since = new Date(TEST_NOW.getTime() - EXPIRY_MS);
    expect(pendingSummary(store, since, TEST_NOW)).toEqual([
      {
        id,
        tool: 'draft_faculty_email',
        status: 'done',
        summary: 'Email to Prof. K. Rao: “Extension request”',
      },
    ]);
  });
});

describe('pending cap (audit M4)', () => {
  it('refuses new proposals once MAX_PENDING are waiting, and accepts again after a decision', () => {
    const { store } = setup();
    const ids = Array.from(
      { length: MAX_PENDING },
      () => propose(store, { preview: email, reason: 'Flood' }, TEST_NOW).id,
    );
    expect(() => propose(store, { preview: email, reason: 'One too many' }, TEST_NOW)).toThrow(
      /already waiting for the student/,
    );
    rejectAction(store, ids[0] as string, TEST_NOW);
    expect(propose(store, { preview: email, reason: 'Room again' }, TEST_NOW).status).toBe(
      'pending',
    );
  });
});

/** Makes a decided action and its sent email look as if they happened at `when`. */
function backdate(store: ReturnType<typeof setup>['store'], id: string, when: Date) {
  const iso = when.toISOString();
  store.db
    .prepare('UPDATE pending_actions SET created_at = ?, decided_at = ? WHERE id = ?')
    .run(iso, iso, id);
  store.db.prepare('UPDATE outbox SET sent_at = ? WHERE action_id = ?').run(iso, id);
}

describe('30-day retention (audit M5)', () => {
  it('deletes old sent emails, past reminders and decided actions, but keeps pending ones', () => {
    const { store, deps } = setup();
    const old = new Date(TEST_NOW.getTime() - 40 * 24 * 3_600_000);

    const sent = propose(store, { preview: email, reason: 'Old email' }, TEST_NOW);
    approveAction(store, sent.id, deps);
    backdate(store, sent.id, old);
    const waiting = propose(store, { preview: email, reason: 'Still waiting' }, TEST_NOW);
    store.insertReminder({ id: 'r-old', text: 'Long gone', remindAt: old.toISOString() });
    store.insertReminder({ id: 'r-new', text: 'Upcoming', remindAt: '2026-11-30T18:00:00+05:30' });

    store.purgeOlderThan(new Date(TEST_NOW.getTime() - 30 * 24 * 3_600_000).toISOString());

    expect(store.count('outbox')).toBe(0);
    expect(store.getPendingAction(sent.id)).toBeUndefined();
    expect(store.getPendingAction(waiting.id)?.status).toBe('pending');
    const reminders = store.db.prepare('SELECT id FROM reminders').all();
    expect(reminders).toEqual([{ id: 'r-new' }]);
  });

  it('keeps deadlines created by an old action, just unlinks them', () => {
    const { store, deps } = setup();
    const old = new Date(TEST_NOW.getTime() - 40 * 24 * 3_600_000);
    const added = propose(
      store,
      {
        preview: {
          tool: 'add_deadline',
          deadline: {
            subjectCode: 'OS',
            title: 'Old viva',
            dueAt: '2026-12-30T10:00:00+05:30',
            kind: 'exam',
            source: 'student',
          },
        },
        reason: 'Old',
      },
      TEST_NOW,
    );
    approveAction(store, added.id, deps);
    backdate(store, added.id, old);
    store.purgeOlderThan(new Date(TEST_NOW.getTime() - 30 * 24 * 3_600_000).toISOString());
    expect(store.listDeadlines().some((d) => d.title === 'Old viva')).toBe(true);
  });
});
