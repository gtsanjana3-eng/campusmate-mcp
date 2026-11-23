import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  Ability,
  AbilityName,
  ActivityEntry,
  ActivityKind,
  ToolName,
} from '../../../shared/types/index.ts';

const SCHEMA = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

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

/**
 * The only module that talks to SQLite. Each domain area gets typed functions here;
 * tables used by the tools (deadlines, notices, …) get theirs when those tools are built.
 */
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

    listActivity(limit: number): ActivityEntry[] {
      const rows = db
        .prepare('SELECT * FROM activity ORDER BY id DESC LIMIT ?')
        .all(limit) as ActivityRow[];
      return rows.map(toActivity);
    },

    close() {
      db.close();
    },
  };
}

export type Store = ReturnType<typeof createStore>;
