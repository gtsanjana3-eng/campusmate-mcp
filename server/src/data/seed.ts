import seed from './seed/student.json' with { type: 'json' };
import type { Store } from './store.ts';

const IST_OFFSET_MINUTES = 330;

/** ISO timestamp for a wall-clock time in India, `days` from `now` (e.g. 2026-11-26T23:59:00+05:30). */
export function istDateTime(now: Date, days: number, time: string): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  ist.setUTCDate(ist.getUTCDate() + days);
  const date = ist.toISOString().slice(0, 10);
  return `${date}T${time}:00+05:30`;
}

const TABLES = [
  'activity',
  'outbox',
  'reminders',
  'deadlines',
  'pending_actions',
  'notices',
  'classes',
  'attendance',
  'subjects',
  'abilities',
  'settings',
];

/**
 * Replaces all data with the demo student. Dates are relative to `now`, so the demo always
 * shows upcoming deadlines.
 */
export function seedStore(store: Store, now = new Date()): void {
  const { db } = store;
  const nowIso = now.toISOString();

  store.transaction(() => {
    for (const table of TABLES) db.exec(`DELETE FROM ${table}`);

    const setting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(seed.settings)) setting.run(key, value);

    const subject = db.prepare(
      'INSERT INTO subjects (code, name, faculty_name, faculty_email) VALUES (?, ?, ?, ?)',
    );
    for (const s of seed.subjects) subject.run(s.code, s.name, s.facultyName, s.facultyEmail);

    const attendance = db.prepare(
      'INSERT INTO attendance (subject_code, attended, held, updated_at) VALUES (?, ?, ?, ?)',
    );
    for (const a of seed.attendance) attendance.run(a.subjectCode, a.attended, a.held, nowIso);

    const cls = db.prepare(
      'INSERT INTO classes (subject_code, day, start_time, end_time, room, kind) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const c of seed.classes) cls.run(c.subjectCode, c.day, c.start, c.end, c.room, c.kind);

    const deadline = db.prepare(
      "INSERT INTO deadlines (id, subject_code, title, due_at, kind, status, source) VALUES (?, ?, ?, ?, ?, ?, 'seed')",
    );
    for (const d of seed.deadlines) {
      deadline.run(
        d.id,
        d.subjectCode,
        d.title,
        istDateTime(now, d.inDays, d.time),
        d.kind,
        d.status,
      );
    }

    const notice = db.prepare(
      'INSERT INTO notices (id, title, body, posted_at, from_name) VALUES (?, ?, ?, ?, ?)',
    );
    for (const n of seed.notices) {
      const postedAt = new Date(now.getTime() - n.hoursAgo * 3_600_000).toISOString();
      notice.run(n.id, n.title, n.body, postedAt, n.from);
    }

    const ability = db.prepare(
      'INSERT INTO abilities (name, grp, label, enabled, updated_at) VALUES (?, ?, ?, 1, ?)',
    );
    for (const a of seed.abilities) ability.run(a.name, a.group, a.label, nowIso);
  });
}

/** Seeds only when the database has no data (first start, or a fresh disk on the host). */
export function seedIfEmpty(store: Store, now = new Date()): boolean {
  if (!store.isEmpty()) return false;
  seedStore(store, now);
  return true;
}
