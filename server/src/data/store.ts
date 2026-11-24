import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  Ability,
  AbilityName,
  ActionPreview,
  ActionStatus,
  ActivityEntry,
  ActivityKind,
  ClassSession,
  Deadline,
  Notice,
  ToolName,
} from '../../../shared/types/index.ts';

const SCHEMA = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

/** Subject with the faculty email; the email never leaves the server except into the outbox. */
export type SubjectRecord = {
  code: string;
  name: string;
  facultyName: string;
  facultyEmail: string;
};

export type AttendanceRecord = {
  subjectCode: string;
  subjectName: string;
  attended: number;
  held: number;
};

export type IntegrationRecord = {
  provider: 'google_calendar';
  /** Encrypted with lib/secretBox; never stored in plain text. */
  refreshTokenEnc: string;
  calendarId: string;
  status: 'connected' | 'needs_reconnect';
  connectedAt: string;
};

export type PendingActionRecord = {
  id: string;
  tool: ToolName;
  preview: ActionPreview;
  reason: string;
  status: ActionStatus;
  createdAt: string;
  decidedAt?: string;
  result?: Record<string, unknown>;
};

type PendingRow = {
  id: string;
  tool: string;
  payload: string;
  reason: string;
  status: string;
  created_at: string;
  decided_at: string | null;
  result: string | null;
};

const toPending = (row: PendingRow): PendingActionRecord => ({
  id: row.id,
  tool: row.tool as ToolName,
  preview: JSON.parse(row.payload) as ActionPreview,
  reason: row.reason,
  status: row.status as ActionStatus,
  createdAt: row.created_at,
  ...(row.decided_at ? { decidedAt: row.decided_at } : {}),
  ...(row.result ? { result: JSON.parse(row.result) as Record<string, unknown> } : {}),
});

// Enum-like columns are guaranteed by the schema's CHECK constraints, which is why
// rows are cast to the shared types (via unknown) in the queries below.
const DEADLINE_COLUMNS =
  'id, subject_code AS subjectCode, title, due_at AS dueAt, kind, status, source';

type AbilityRow = { name: string; grp: string; label: string; enabled: number };
type ActivityRow = {
  id: number;
  at: string;
  kind: string;
  tool: string | null;
  summary: string;
  action_id: string | null;
};

const toAbility = (row: AbilityRow): Ability => ({
  name: row.name as AbilityName,
  group: row.grp as Ability['group'],
  label: row.label,
  enabled: row.enabled === 1,
});

const toActivity = (row: ActivityRow): ActivityEntry => ({
  id: String(row.id),
  at: row.at,
  kind: row.kind as ActivityKind,
  ...(row.tool ? { tool: row.tool as ToolName } : {}),
  summary: row.summary,
  ...(row.action_id ? { actionId: row.action_id } : {}),
});

/** The only module that talks to SQLite. Each domain area gets typed functions here. */
export function createStore(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);

  return {
    db,

    /** Runs `fn` in a transaction; rolls back if it throws. */
    transaction<T>(fn: () => T): T {
      db.exec('BEGIN');
      try {
        const result = fn();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },

    isEmpty(): boolean {
      const row = db.prepare('SELECT COUNT(*) AS n FROM subjects').get() as { n: number };
      return row.n === 0;
    },

    ping(): boolean {
      return (db.prepare('SELECT 1 AS ok').get() as { ok: number }).ok === 1;
    },

    getSetting(key: string): string | undefined {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
        { value: string } | undefined;
      return row?.value;
    },

    listAbilities(): Ability[] {
      const rows = db
        .prepare('SELECT name, grp, label, enabled FROM abilities ORDER BY grp DESC, rowid')
        .all() as AbilityRow[];
      return rows.map(toAbility);
    },

    getAbility(name: string): Ability | undefined {
      const row = db
        .prepare('SELECT name, grp, label, enabled FROM abilities WHERE name = ?')
        .get(name) as AbilityRow | undefined;
      return row && toAbility(row);
    },

    setAbilityEnabled(name: string, enabled: boolean, now: string): Ability | undefined {
      db.prepare('UPDATE abilities SET enabled = ?, updated_at = ? WHERE name = ?').run(
        enabled ? 1 : 0,
        now,
        name,
      );
      return this.getAbility(name);
    },

    addActivity(entry: Omit<ActivityEntry, 'id'>): ActivityEntry {
      const result = db
        .prepare('INSERT INTO activity (at, kind, tool, summary, action_id) VALUES (?, ?, ?, ?, ?)')
        .run(entry.at, entry.kind, entry.tool ?? null, entry.summary, entry.actionId ?? null);
      return { ...entry, id: String(result.lastInsertRowid) };
    },

    pruneActivityBefore(cutoff: string): number {
      return Number(db.prepare('DELETE FROM activity WHERE at < ?').run(cutoff).changes);
    },

    // ---------- External integrations ----------

    getIntegration(provider: 'google_calendar'): IntegrationRecord | undefined {
      return db
        .prepare(
          `SELECT provider, refresh_token_enc AS refreshTokenEnc, calendar_id AS calendarId, status,
                  connected_at AS connectedAt
           FROM integrations WHERE provider = ?`,
        )
        .get(provider) as IntegrationRecord | undefined;
    },

    saveIntegration(record: IntegrationRecord, now: string): void {
      db.prepare(
        `INSERT INTO integrations (provider, refresh_token_enc, calendar_id, status, connected_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider) DO UPDATE SET refresh_token_enc = excluded.refresh_token_enc,
           calendar_id = excluded.calendar_id, status = excluded.status,
           connected_at = excluded.connected_at, updated_at = excluded.updated_at`,
      ).run(
        record.provider,
        record.refreshTokenEnc,
        record.calendarId,
        record.status,
        record.connectedAt,
        now,
      );
    },

    setIntegrationStatus(
      provider: 'google_calendar',
      status: IntegrationRecord['status'],
      now: string,
    ) {
      db.prepare('UPDATE integrations SET status = ?, updated_at = ? WHERE provider = ?').run(
        status,
        now,
        provider,
      );
    },

    deleteIntegration(provider: 'google_calendar'): void {
      db.prepare('DELETE FROM integrations WHERE provider = ?').run(provider);
    },

    /** Adds a follow-up note (e.g. the Google Calendar result) to a finished action. */
    addActionNote(id: string, note: string): void {
      db.prepare(
        "UPDATE pending_actions SET result = json_set(COALESCE(result, '{}'), '$.note', ?) WHERE id = ?",
      ).run(note, id);
    },

    listActivity(limit: number): ActivityEntry[] {
      const rows = db
        .prepare('SELECT * FROM activity ORDER BY id DESC LIMIT ?')
        .all(limit) as ActivityRow[];
      return rows.map(toActivity);
    },

    // ---------- Academic data ----------

    listSubjects(): SubjectRecord[] {
      return db
        .prepare(
          'SELECT code, name, faculty_name AS facultyName, faculty_email AS facultyEmail FROM subjects ORDER BY code',
        )
        .all() as SubjectRecord[];
    },

    listClasses(): ClassSession[] {
      return db
        .prepare(
          `SELECT c.subject_code AS subjectCode, s.name AS subjectName, c.day, c.start_time AS start,
                  c.end_time AS "end", c.room, c.kind
           FROM classes c JOIN subjects s ON s.code = c.subject_code
           ORDER BY CASE c.day WHEN 'mon' THEN 1 WHEN 'tue' THEN 2 WHEN 'wed' THEN 3
                    WHEN 'thu' THEN 4 WHEN 'fri' THEN 5 ELSE 6 END, c.start_time`,
        )
        .all() as unknown as ClassSession[];
    },

    listAttendance(): AttendanceRecord[] {
      return db
        .prepare(
          `SELECT a.subject_code AS subjectCode, s.name AS subjectName, a.attended, a.held
           FROM attendance a JOIN subjects s ON s.code = a.subject_code ORDER BY a.subject_code`,
        )
        .all() as AttendanceRecord[];
    },

    listDeadlines(): Deadline[] {
      return db
        .prepare(`SELECT ${DEADLINE_COLUMNS} FROM deadlines ORDER BY due_at`)
        .all() as unknown as Deadline[];
    },

    getDeadline(id: string): Deadline | undefined {
      return db.prepare(`SELECT ${DEADLINE_COLUMNS} FROM deadlines WHERE id = ?`).get(id) as
        Deadline | undefined;
    },

    insertDeadline(deadline: Deadline, actionId: string): void {
      db.prepare(
        'INSERT INTO deadlines (id, subject_code, title, due_at, kind, status, source, created_by_action) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        deadline.id,
        deadline.subjectCode,
        deadline.title,
        deadline.dueAt,
        deadline.kind,
        deadline.status,
        deadline.source,
        actionId,
      );
    },

    setDeadlineStatus(id: string, status: Deadline['status']): void {
      db.prepare('UPDATE deadlines SET status = ? WHERE id = ?').run(status, id);
    },

    listNotices(): Notice[] {
      return db
        .prepare(
          'SELECT id, title, body, posted_at AS postedAt, from_name AS "from" FROM notices ORDER BY posted_at DESC',
        )
        .all() as unknown as Notice[];
    },

    hasNotice(id: string): boolean {
      return db.prepare('SELECT 1 FROM notices WHERE id = ?').get(id) !== undefined;
    },

    insertReminder(reminder: {
      id: string;
      text: string;
      remindAt: string;
      deadlineId?: string;
    }): void {
      db.prepare(
        "INSERT INTO reminders (id, text, remind_at, deadline_id, status) VALUES (?, ?, ?, ?, 'scheduled')",
      ).run(reminder.id, reminder.text, reminder.remindAt, reminder.deadlineId ?? null);
    },

    insertOutbox(mail: {
      id: string;
      toName: string;
      toEmail: string;
      subject: string;
      body: string;
      sentAt: string;
      actionId: string;
    }): void {
      db.prepare(
        'INSERT INTO outbox (id, to_name, to_email, subject, body, sent_at, action_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(
        mail.id,
        mail.toName,
        mail.toEmail,
        mail.subject,
        mail.body,
        mail.sentAt,
        mail.actionId,
      );
    },

    // ---------- Pending actions ----------

    insertPendingAction(action: {
      id: string;
      tool: ToolName;
      preview: ActionPreview;
      reason: string;
      createdAt: string;
    }): void {
      db.prepare(
        "INSERT INTO pending_actions (id, tool, payload, reason, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
      ).run(
        action.id,
        action.tool,
        JSON.stringify(action.preview),
        action.reason,
        action.createdAt,
      );
    },

    getPendingAction(id: string): PendingActionRecord | undefined {
      const row = db.prepare('SELECT * FROM pending_actions WHERE id = ?').get(id) as
        PendingRow | undefined;
      return row && toPending(row);
    },

    listPendingActions(
      filter: { status?: ActionStatus; since?: string } = {},
    ): PendingActionRecord[] {
      const rows = db
        .prepare(
          `SELECT * FROM pending_actions
           WHERE (? IS NULL OR status = ?) AND (? IS NULL OR created_at >= ?)
           ORDER BY created_at DESC`,
        )
        .all(
          filter.status ?? null,
          filter.status ?? null,
          filter.since ?? null,
          filter.since ?? null,
        ) as PendingRow[];
      return rows.map(toPending);
    },

    updatePendingPreview(id: string, preview: ActionPreview): void {
      db.prepare("UPDATE pending_actions SET payload = ? WHERE id = ? AND status = 'pending'").run(
        JSON.stringify(preview),
        id,
      );
    },

    /**
     * Moves an action from `from` to `to` only if it is still in `from`. Returns false when another
     * request got there first, which is what makes approval atomic.
     */
    transitionAction(id: string, from: ActionStatus, to: ActionStatus, at: string): boolean {
      const result = db
        .prepare(
          'UPDATE pending_actions SET status = ?, decided_at = ? WHERE id = ? AND status = ?',
        )
        .run(to, at, id, from);
      return result.changes === 1;
    },

    finishAction(id: string, status: 'done' | 'failed', result: Record<string, unknown>): void {
      db.prepare('UPDATE pending_actions SET status = ?, result = ? WHERE id = ?').run(
        status,
        JSON.stringify(result),
        id,
      );
    },

    expirePendingBefore(cutoff: string, at: string): number {
      return Number(
        db
          .prepare(
            "UPDATE pending_actions SET status = 'expired', decided_at = ? WHERE status = 'pending' AND created_at < ?",
          )
          .run(at, cutoff).changes,
      );
    },

    count(table: 'outbox' | 'reminders' | 'deadlines' | 'pending_actions'): number {
      return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    },

    close() {
      db.close();
    },
  };
}

export type Store = ReturnType<typeof createStore>;
