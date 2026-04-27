CREATE TABLE IF NOT EXISTS users_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions_v2 (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users_v2(id)
);

CREATE TABLE IF NOT EXISTS checkins_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('SLEEP', 'WAKE')),
  check_time TEXT NOT NULL,
  reflection TEXT NOT NULL DEFAULT '',
  reflection_tag TEXT NOT NULL DEFAULT '',
  happy_thing TEXT NOT NULL DEFAULT '',
  happy_tag TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT '',
  plan_tag TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users_v2(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_v2_user
  ON sessions_v2(user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkins_v2_user_created
  ON checkins_v2(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkins_v2_type_time
  ON checkins_v2(type, check_time);

CREATE TABLE IF NOT EXISTS comments_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users_v2(id)
);

CREATE INDEX IF NOT EXISTS idx_comments_v2_created
  ON comments_v2(created_at DESC, id DESC);
