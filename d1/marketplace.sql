-- Gold wallet (Altaris-account currency) + Ascent Marketplace.
-- Apply with:
--   npx wrangler d1 execute ascent-accounts --remote --file=d1/marketplace.sql

-- One row per account. Spendable = purchased + earned.
-- purchased: bought with money; spendable, never cashable.
-- earned:    seller proceeds; spendable and cashable (after clearing).
-- held:      earned Gold locked in a pending cash-out.
-- debt:      Gold clawed back by a refund that the balance could not cover.
CREATE TABLE IF NOT EXISTS gold_wallets (
  user_id TEXT PRIMARY KEY,
  purchased INTEGER NOT NULL DEFAULT 0 CHECK (purchased >= 0),
  earned INTEGER NOT NULL DEFAULT 0 CHECK (earned >= 0),
  held INTEGER NOT NULL DEFAULT 0 CHECK (held >= 0),
  debt INTEGER NOT NULL DEFAULT 0 CHECK (debt >= 0),
  payout_account_id TEXT,
  payouts_ready INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- Append-only audit trail of every balance change.
CREATE TABLE IF NOT EXISTS gold_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  purchased_delta INTEGER NOT NULL DEFAULT 0,
  earned_delta INTEGER NOT NULL DEFAULT 0,
  held_delta INTEGER NOT NULL DEFAULT 0,
  debt_delta INTEGER NOT NULL DEFAULT 0,
  ref TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gold_ledger_user ON gold_ledger(user_id, created_at);

-- Verified Gold pack purchases (App Store, Google Play, Stripe).
-- purchase_key is the store's unique transaction / order / session id, so a
-- receipt can only ever be credited once, to one account.
CREATE TABLE IF NOT EXISTS gold_store_purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  product_id TEXT NOT NULL,
  pack_id TEXT NOT NULL,
  purchase_key TEXT NOT NULL,
  payment_ref TEXT,
  gold INTEGER NOT NULL,
  laurels INTEGER NOT NULL DEFAULT 0,
  usd_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'credited',
  created_at TEXT NOT NULL,
  refunded_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gold_store_purchases_key
  ON gold_store_purchases(platform, purchase_key);
CREATE INDEX IF NOT EXISTS idx_gold_store_purchases_payment
  ON gold_store_purchases(payment_ref);
CREATE INDEX IF NOT EXISTS idx_gold_store_purchases_user
  ON gold_store_purchases(user_id, created_at);

-- Bonus Laurels from Gold packs. Laurels live on the device, so the app claims
-- these once and adds them locally (they never count toward leaderboards).
CREATE TABLE IF NOT EXISTS gold_laurel_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  purchase_id TEXT NOT NULL,
  laurels INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  claimed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_gold_laurel_grants_user
  ON gold_laurel_grants(user_id, claimed_at);

-- Seller cash-outs. Approved by an admin, then paid with a Stripe transfer.
CREATE TABLE IF NOT EXISTS gold_cashouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  gold INTEGER NOT NULL,
  usd_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  transfer_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_gold_cashouts_status ON gold_cashouts(status, created_at);
CREATE INDEX IF NOT EXISTS idx_gold_cashouts_user ON gold_cashouts(user_id, created_at);

-- Openings / lessons for sale. Content JSON lives in R2 (ASCENT_FILES).
-- status: pending_review | live | rejected | removed | taken_down
CREATE TABLE IF NOT EXISTS market_listings (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  game_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_gold INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  source_name TEXT,
  content_key TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  content_bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_review',
  review_note TEXT,
  sales_count INTEGER NOT NULL DEFAULT 0,
  earned_gold INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_market_listings_browse
  ON market_listings(game_id, kind, status, sales_count);
CREATE INDEX IF NOT EXISTS idx_market_listings_seller
  ON market_listings(seller_id, created_at);
CREATE INDEX IF NOT EXISTS idx_market_listings_hash
  ON market_listings(content_hash);

-- Ownership. Free listings are recorded too (price_gold = 0).
CREATE TABLE IF NOT EXISTS market_purchases (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  price_gold INTEGER NOT NULL,
  seller_gold INTEGER NOT NULL,
  purchased_used INTEGER NOT NULL DEFAULT 0,
  earned_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  refunded_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_purchases_owner
  ON market_purchases(listing_id, buyer_id);
CREATE INDEX IF NOT EXISTS idx_market_purchases_buyer
  ON market_purchases(buyer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_market_purchases_seller
  ON market_purchases(seller_id, created_at);

CREATE TABLE IF NOT EXISTS market_reports (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  resolution TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_reports_once
  ON market_reports(listing_id, reporter_id);
CREATE INDEX IF NOT EXISTS idx_market_reports_status
  ON market_reports(status, created_at);

-- A user hides every listing from a seller they blocked.
CREATE TABLE IF NOT EXISTS market_blocks (
  user_id TEXT NOT NULL,
  blocked_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, blocked_user_id)
);
