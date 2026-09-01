CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  display_name TEXT NOT NULL,
  google_sub TEXT UNIQUE,
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_laurel_events_user ON laurel_events(user_id);
CREATE INDEX IF NOT EXISTS idx_laurel_events_game_time ON laurel_events(game_id, earned_at);
CREATE INDEX IF NOT EXISTS idx_laurel_events_time ON laurel_events(earned_at);

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
