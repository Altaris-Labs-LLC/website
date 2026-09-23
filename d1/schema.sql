CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  display_name TEXT NOT NULL,
  google_sub TEXT UNIQUE,
  apple_sub TEXT UNIQUE,
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ads_free_until TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

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

CREATE TABLE IF NOT EXISTS subscription_purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  product_id TEXT NOT NULL,
  purchase_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  expires_at TEXT,
  verification_data TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (platform, purchase_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscription_purchases_user ON subscription_purchases(user_id);

CREATE TABLE IF NOT EXISTS cloud_backup_manifests (
  user_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  parts_json TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, game_id, revision),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cloud_backup_latest
  ON cloud_backup_manifests(user_id, game_id, revision DESC);

CREATE TABLE IF NOT EXISTS saved_analysis (
  game_id TEXT NOT NULL,
  fen TEXT NOT NULL,
  eval_data TEXT,
  eval_depth INTEGER,
  advantage_data TEXT,
  advantage_depth INTEGER,
  simulation_data TEXT,
  orthodoxy_data TEXT,
  orthodoxy_depth INTEGER DEFAULT 0,
  difficulty_data TEXT,
  difficulty_depth INTEGER DEFAULT 0,
  eval_think_time REAL,
  advantage_think_time REAL,
  sharpness_think_time REAL,
  simplicity_think_time REAL,
  simulation_think_time REAL,
  difficulty_think_time REAL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (game_id, fen)
);

CREATE INDEX IF NOT EXISTS idx_saved_analysis_game
  ON saved_analysis(game_id);

-- Endgame difficulty SoT (also in d1/endgames.sql for migrate).
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
  difficulty_computer_elo_coefficient REAL NOT NULL DEFAULT 1.0,
  difficulty_knowledge_coefficient REAL NOT NULL DEFAULT 1.0,
  exposures INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS endgame_table_meta (
  game_id TEXT PRIMARY KEY,
  cumulative_adjustment REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- Midgame puzzle SoT (also in d1/puzzles.sql for migrate).
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
