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
