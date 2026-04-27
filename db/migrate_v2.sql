PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user
  ON sessions(user_id, expires_at DESC);

DROP TABLE IF EXISTS checkins_new;
CREATE TABLE checkins_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('SLEEP', 'WAKE')),
  check_time TEXT NOT NULL,
  reflection TEXT NOT NULL DEFAULT '',
  happy_thing TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT OR IGNORE INTO users (username, password_hash, salt, created_at)
SELECT DISTINCT
  username,
  '',
  '',
  COALESCE(created_at, datetime('now'))
FROM checkins
WHERE username IS NOT NULL AND username != '';

INSERT INTO checkins_new (id, user_id, type, check_time, reflection, happy_thing, plan, created_at)
SELECT
  c.id,
  u.id,
  c.type,
  c.check_time,
  COALESCE(c.reflection, ''),
  '',
  COALESCE(c.plan, ''),
  COALESCE(c.created_at, datetime('now'))
FROM checkins c
JOIN users u ON u.username = c.username;

DROP TABLE checkins;
ALTER TABLE checkins_new RENAME TO checkins;

CREATE INDEX IF NOT EXISTS idx_checkins_user_created
  ON checkins(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkins_type_time
  ON checkins(type, check_time);

PRAGMA foreign_keys = ON;
