-- Per-reason report counts for midgame puzzles.
ALTER TABLE puzzle_positions ADD COLUMN flag_multiple_correct INTEGER NOT NULL DEFAULT 0;
ALTER TABLE puzzle_positions ADD COLUMN flag_engine_best_fails INTEGER NOT NULL DEFAULT 0;
ALTER TABLE puzzle_positions ADD COLUMN flag_unwinnable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE puzzle_positions ADD COLUMN flag_dislike INTEGER NOT NULL DEFAULT 0;
ALTER TABLE puzzle_positions ADD COLUMN flag_other INTEGER NOT NULL DEFAULT 0;
