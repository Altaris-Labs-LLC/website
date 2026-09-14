-- Bug reports and feature suggestions from the Ascent Games Feedback tab.

CREATE TABLE IF NOT EXISTS feedback_bug_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  game_id TEXT,
  app_area TEXT NOT NULL,
  expected_behavior TEXT NOT NULL,
  actual_behavior TEXT NOT NULL,
  steps TEXT NOT NULL,
  app_version TEXT,
  platform TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_bugs_user
  ON feedback_bug_reports(user_id, created_at);

CREATE TABLE IF NOT EXISTS feedback_feature_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  description TEXT NOT NULL,
  laurels_awarded INTEGER NOT NULL DEFAULT 500,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_features_user
  ON feedback_feature_requests(user_id, created_at);
