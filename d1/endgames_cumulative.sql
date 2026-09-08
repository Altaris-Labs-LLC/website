-- Additive migration if endgames.sql was already applied without meta.
CREATE TABLE IF NOT EXISTS endgame_table_meta (
  game_id TEXT PRIMARY KEY,
  cumulative_adjustment REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
