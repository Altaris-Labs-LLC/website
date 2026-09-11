-- Online PvP matchmaking + live games (chess / checkers).

CREATE TABLE IF NOT EXISTS pvp_seeks (
  id TEXT PRIMARY KEY,
  player_key TEXT NOT NULL,
  user_id TEXT,
  guest_id TEXT,
  display_name TEXT NOT NULL,
  game_id TEXT NOT NULL,
  tc_key TEXT NOT NULL,
  tc_base_seconds INTEGER NOT NULL,
  tc_bonus_type TEXT NOT NULL,
  tc_bonus_seconds INTEGER NOT NULL,
  elo INTEGER NOT NULL,
  is_premium INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'seeking',
  matched_game_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pvp_seeks_match
  ON pvp_seeks(game_id, tc_key, status, elo, created_at);

CREATE TABLE IF NOT EXISTS pvp_games (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  tc_key TEXT NOT NULL,
  tc_base_seconds INTEGER NOT NULL,
  tc_bonus_type TEXT NOT NULL,
  tc_bonus_seconds INTEGER NOT NULL,
  white_player_key TEXT NOT NULL,
  black_player_key TEXT NOT NULL,
  white_user_id TEXT,
  black_user_id TEXT,
  white_display_name TEXT NOT NULL,
  black_display_name TEXT NOT NULL,
  white_elo INTEGER NOT NULL,
  black_elo INTEGER NOT NULL,
  white_clock_ms INTEGER NOT NULL,
  black_clock_ms INTEGER NOT NULL,
  moves_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  result TEXT,
  result_reason TEXT,
  winner_side INTEGER,
  turn_started_at TEXT NOT NULL,
  white_last_seen TEXT NOT NULL,
  black_last_seen TEXT NOT NULL,
  created_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pvp_games_status ON pvp_games(status, turn_started_at);

CREATE TABLE IF NOT EXISTS pvp_daily_usage (
  player_key TEXT NOT NULL,
  game_id TEXT NOT NULL,
  day_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_key, game_id, day_key)
);
