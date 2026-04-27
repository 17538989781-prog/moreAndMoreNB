CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('SLEEP', 'WAKE')),
  check_time TEXT NOT NULL,
  reflection TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_checkins_user_created
  ON checkins(username, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkins_type_time
  ON checkins(type, check_time);
