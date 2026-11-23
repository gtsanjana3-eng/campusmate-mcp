import { describe, expect, it } from 'vitest';
import type { ActionPreview } from '../../../shared/types/index.ts';
import { createDemoOutbox } from '../sources/mailer.ts';
import { seededStore, TEST_NOW } from '../test/helpers.ts';
import { setAbility } from './abilities.ts';
import { listActivity } from './activity.ts';
import {
  approveAction,
  EXPIRY_MS,
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
