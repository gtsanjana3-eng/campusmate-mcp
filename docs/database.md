# Database

CampusMate uses Node's built-in **`node:sqlite`**: one file (`DATABASE_PATH`, default
`./data/campusmate.db`), no database server. All access goes through `server/src/data/store.ts`;
no other module runs SQL.

## Settings applied on open

- `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL`.
- The schema (`server/src/data/schema.sql`) is applied on every start with `CREATE TABLE IF NOT
EXISTS`, so starting against an existing file keeps its data.
- If the database is empty, the demo student is loaded from `server/src/data/seed/student.json`
  (dates are placed relative to "now", so the demo always has upcoming work).
  `npm run seed` resets it on purpose.

## Tables (12)

| Table             | Holds                                                       | Key columns and rules                                                                  |
| ----------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `settings`        | Key/value settings (attendance minimum, session revocation) | `key` primary key                                                                      |
| `subjects`        | Subjects and their faculty                                  | `code` primary key; `faculty_email` is the only address emails can go to               |
| `classes`         | Weekly timetable                                            | `day` in mon–sat; `kind` lecture/lab/tutorial                                          |
| `attendance`      | Attended / held per subject                                 | checks `attended >= 0`, `held >= attended`                                             |
| `deadlines`       | Assignments, exams, other                                   | `status` open/done; `source` seed/notice/student; optional link to the creating action |
| `notices`         | College notices (untrusted text)                            | `posted_at`, `from_name`                                                               |
| `reminders`       | Reminders the student approved                              | `status` scheduled/cancelled; optional `deadline_id`                                   |
| `outbox`          | Emails "sent" to the demo outbox                            | linked to the approving `action_id`                                                    |
| `pending_actions` | Everything the AI proposed                                  | `status` pending/approved/done/rejected/failed/expired; `payload` JSON; `reason`       |
| `activity`        | The student-visible log                                     | `kind` read/proposed/approved/rejected/blocked/failed/edited                           |
| `abilities`       | Per-tool permission switches                                | `grp` read/act; `enabled` 0/1                                                          |
| `integrations`    | Optional Google Calendar connection                         | `refresh_token_enc` encrypted with AES-256-GCM; access tokens never stored             |

Indexes: `deadlines(due_at)`, `pending_actions(status, created_at)`, `activity(at)`.

## Data lifecycle

- An approval moves `pending → approved` with one conditional `UPDATE … WHERE status = 'pending'`,
  so an action can never run twice. The action itself runs in a transaction.
- Pending actions expire after 24 hours; at most 20 can wait at once.
- Activity, sent demo emails, past reminders and decided actions are deleted after 30 days.

## Migrations

There is no migration tool. The schema only grows with `CREATE … IF NOT EXISTS`, which is enough
for a database that is re-seeded on every free-plan restart. Changing an existing column needs a
real migration step (for example a numbered SQL file applied once and recorded in `settings`)
before CampusMate keeps data that must survive upgrades.

## Backup and recovery

- **Live demo (Render free plan):** no persistent disk. Every restart, redeploy or sleep starts from
  fresh demo data, so there is nothing to back up and recovery is a restart.
- **Real use:** put the file on a persistent disk (or move to a hosted database) and back it up
  with SQLite's online backup, e.g. `sqlite3 campusmate.db ".backup backup.db"`, or by copying the
  file while the server is stopped. WAL mode means the `-wal` file must be copied with it.
