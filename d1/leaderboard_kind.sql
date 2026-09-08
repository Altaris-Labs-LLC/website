-- Leaderboard event kinds: earn | legacy_backfill | puzzle_contribution
ALTER TABLE laurel_events ADD COLUMN kind TEXT NOT NULL DEFAULT 'earn';

CREATE INDEX IF NOT EXISTS idx_laurel_events_kind_game_time
  ON laurel_events(kind, game_id, earned_at);
