ALTER TABLE users ADD COLUMN premium_plan TEXT NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN premium_expires_at TEXT;
ALTER TABLE users ADD COLUMN premium_source TEXT;

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

UPDATE users
SET premium_plan = 'lifetime',
    premium_expires_at = NULL,
    premium_source = 'complimentary'
WHERE lower(email) = 'brentunderwood@altarislabs.dev';
