-- Shared endgame difficulty table (server is source of truth for difficulty /
-- view_count). Rows are created lazily on first delta (default difficulty 1200)
-- or via a bulk seed import.

CREATE TABLE IF NOT EXISTS endgame_positions (
  game_id TEXT NOT NULL,
  fen TEXT NOT NULL,
  difficulty REAL NOT NULL DEFAULT 1200,
  view_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (game_id, fen)
);

CREATE INDEX IF NOT EXISTS idx_endgame_positions_updated
  ON endgame_positions (game_id, updated_at);

CREATE TABLE IF NOT EXISTS endgame_difficulty_params (
  game_id TEXT PRIMARY KEY,
  difficulty_knowledge_coefficient REAL NOT NULL DEFAULT 1.0,
  exposures INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- Per-game cumulative |difficulty delta| across the whole table.
CREATE TABLE IF NOT EXISTS endgame_table_meta (
  game_id TEXT PRIMARY KEY,
  cumulative_adjustment REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
