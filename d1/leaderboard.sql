CREATE TABLE IF NOT EXISTS laurel_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  points INTEGER NOT NULL,
  earned_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'earn',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_laurel_events_user ON laurel_events(user_id);
CREATE INDEX IF NOT EXISTS idx_laurel_events_game_time ON laurel_events(game_id, earned_at);
CREATE INDEX IF NOT EXISTS idx_laurel_events_time ON laurel_events(earned_at);
CREATE INDEX IF NOT EXISTS idx_laurel_events_kind_game_time
  ON laurel_events(kind, game_id, earned_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_laurel_events_one_legacy
  ON laurel_events(user_id, game_id)
  WHERE earned_at < '2021-01-01';
