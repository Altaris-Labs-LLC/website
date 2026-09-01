CREATE TABLE IF NOT EXISTS laurel_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  points INTEGER NOT NULL,
  earned_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_laurel_events_user ON laurel_events(user_id);
CREATE INDEX IF NOT EXISTS idx_laurel_events_game_time ON laurel_events(game_id, earned_at);
CREATE INDEX IF NOT EXISTS idx_laurel_events_time ON laurel_events(earned_at);
