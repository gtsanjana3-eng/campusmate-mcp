-- CampusMate schema (11 tables). Applied with CREATE IF NOT EXISTS on every start.

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subjects (
  code          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  faculty_name  TEXT NOT NULL,
  faculty_email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id           INTEGER PRIMARY KEY,
  subject_code TEXT NOT NULL REFERENCES subjects(code),
  day          TEXT NOT NULL CHECK (day IN ('mon','tue','wed','thu','fri','sat')),
  start_time   TEXT NOT NULL,
  end_time     TEXT NOT NULL,
  room         TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('lecture','lab','tutorial'))
);

CREATE TABLE IF NOT EXISTS attendance (
  subject_code TEXT PRIMARY KEY REFERENCES subjects(code),
  attended     INTEGER NOT NULL CHECK (attended >= 0),
  held         INTEGER NOT NULL CHECK (held >= attended),
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deadlines (
  id                TEXT PRIMARY KEY,
  subject_code      TEXT NOT NULL REFERENCES subjects(code),
  title             TEXT NOT NULL,
  due_at            TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('assignment','exam','other')),
  status            TEXT NOT NULL CHECK (status IN ('open','done')),
  source            TEXT NOT NULL CHECK (source IN ('seed','notice','student')),
  created_by_action TEXT REFERENCES pending_actions(id)
);

CREATE TABLE IF NOT EXISTS notices (
  id        TEXT PRIMARY KEY,
  title     TEXT NOT NULL,
  body      TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  from_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id          TEXT PRIMARY KEY,
  text        TEXT NOT NULL,
  remind_at   TEXT NOT NULL,
  deadline_id TEXT REFERENCES deadlines(id),
  status      TEXT NOT NULL CHECK (status IN ('scheduled','cancelled'))
);

CREATE TABLE IF NOT EXISTS outbox (
  id        TEXT PRIMARY KEY,
  to_name   TEXT NOT NULL,
  to_email  TEXT NOT NULL,
  subject   TEXT NOT NULL,
  body      TEXT NOT NULL,
  sent_at   TEXT NOT NULL,
  action_id TEXT NOT NULL REFERENCES pending_actions(id)
);

CREATE TABLE IF NOT EXISTS pending_actions (
  id         TEXT PRIMARY KEY,
  tool       TEXT NOT NULL,
  payload    TEXT NOT NULL,
  reason     TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('pending','approved','done','rejected','failed','expired')),
  created_at TEXT NOT NULL,
  decided_at TEXT,
  result     TEXT
);

CREATE TABLE IF NOT EXISTS activity (
  id        INTEGER PRIMARY KEY,
  at        TEXT NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('read','proposed','approved','rejected','blocked','failed','edited')),
  tool      TEXT,
  summary   TEXT NOT NULL,
  action_id TEXT REFERENCES pending_actions(id)
);

CREATE TABLE IF NOT EXISTS abilities (
  name       TEXT PRIMARY KEY,
  grp        TEXT NOT NULL CHECK (grp IN ('read','act')),
  label      TEXT NOT NULL,
  enabled    INTEGER NOT NULL CHECK (enabled IN (0,1)),
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deadlines_due ON deadlines(due_at);
CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_actions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_at ON activity(at);
