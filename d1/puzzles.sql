-- Shared midgame puzzle table (server is source of truth for difficulty /
-- view_count). Full puzzle content is stored so /select can serve rows.
-- Rows are created via absolute upsert (client extract / one-time seed) or
-- lazily on first difficulty delta (default difficulty 1200).

CREATE TABLE IF NOT EXISTS puzzle_positions (
  game_id TEXT NOT NULL,
  puzzle_type TEXT NOT NULL,
  fen TEXT NOT NULL,
  move_string TEXT NOT NULL DEFAULT '',
  next_fen TEXT NOT NULL DEFAULT '',
  last_fen TEXT NOT NULL DEFAULT '',
  last_move TEXT NOT NULL DEFAULT '',
  player_color INTEGER NOT NULL DEFAULT 0,
  expanded INTEGER NOT NULL DEFAULT 0,
  target REAL,
  top_line TEXT,
  game_played_on TEXT,
  difficulty REAL NOT NULL DEFAULT 1200,
  view_count INTEGER NOT NULL DEFAULT 0,
  flag_multiple_correct INTEGER NOT NULL DEFAULT 0,
  flag_engine_best_fails INTEGER NOT NULL DEFAULT 0,
  flag_unwinnable INTEGER NOT NULL DEFAULT 0,
  flag_dislike INTEGER NOT NULL DEFAULT 0,
  flag_other INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (game_id, puzzle_type, fen)
);

CREATE INDEX IF NOT EXISTS idx_puzzle_positions_updated
  ON puzzle_positions (game_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_puzzle_positions_difficulty
  ON puzzle_positions (game_id, puzzle_type, difficulty);

CREATE TABLE IF NOT EXISTS puzzle_difficulty_params (
  game_id TEXT NOT NULL,
  puzzle_type TEXT NOT NULL,
  difficulty_computer_elo_coefficient REAL NOT NULL DEFAULT 1.0,
  difficulty_knowledge_coefficient REAL NOT NULL DEFAULT 1.0,
  exposures INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (game_id, puzzle_type)
);

CREATE TABLE IF NOT EXISTS puzzle_table_meta (
  game_id TEXT PRIMARY KEY,
  cumulative_adjustment REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
