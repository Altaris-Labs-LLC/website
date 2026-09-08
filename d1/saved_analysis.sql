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
