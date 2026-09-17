export const GAMES = new Set(["chess", "checkers"]);
export const PUZZLE_TYPES = new Set([
  "tactic",
  "conversion",
  "strategic",
]);

export const DEFAULT_PUZZLE_DIFFICULTY = 1200;
export const MAX_DELTAS = 500;
export const MAX_FEN_LENGTH = 200;
export const MAX_MOVE_LENGTH = 800;
export const MAX_DIFFICULTY_DELTA = 5000;
export const MAX_VIEW_DELTA = 50;

export function asText(value: unknown, max = MAX_FEN_LENGTH): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function asNum(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

export function asInt(value: unknown): number {
  const n = asNum(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.trunc(n);
}

export function normalizeGameId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

export function normalizePuzzleType(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const t = raw.trim().toLowerCase();
  if (t === "strategy" || t === "strategic") return "strategic";
  if (t === "tactics" || t === "tactic") return "tactic";
  if (t === "conversion") return "conversion";
  return t;
}

export type PuzzleRow = {
  game_id: string;
  puzzle_type: string;
  fen: string;
  move_string: string;
  next_fen: string;
  last_fen: string;
  last_move: string;
  player_color: number;
  expanded: number;
  target: number | null;
  top_line: string | null;
  game_played_on: string | null;
  difficulty: number;
  view_count: number;
  flag_multiple_correct?: number;
  flag_engine_best_fails?: number;
  flag_unwinnable?: number;
  flag_dislike?: number;
  flag_other?: number;
  updated_at: string;
};

export function publicPuzzle(row: PuzzleRow) {
  return {
    gameId: row.game_id,
    puzzleType: row.puzzle_type,
    fen: row.fen,
    moveString: row.move_string,
    nextFen: row.next_fen,
    lastFen: row.last_fen,
    lastMove: row.last_move,
    playerColor: row.player_color,
    expanded: row.expanded === 1,
    target: row.target,
    topLine: row.top_line,
    gamePlayedOn: row.game_played_on,
    difficulty: row.difficulty,
    viewCount: row.view_count,
    updatedAt: row.updated_at,
    isRoot: true,
  };
}

export function publicPuzzleDifficulty(row: PuzzleRow) {
  return {
    gameId: row.game_id,
    puzzleType: row.puzzle_type,
    fen: row.fen,
    difficulty: row.difficulty,
    viewCount: row.view_count,
    updatedAt: row.updated_at,
  };
}

export async function readCumulativeAdjustment(
  db: D1Database,
  gameId: string,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT cumulative_adjustment FROM puzzle_table_meta WHERE game_id = ?`,
    )
    .bind(gameId)
    .first<{ cumulative_adjustment: number }>();
  const v = row?.cumulative_adjustment;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Adds abs(difficulty deltas) into the per-game cumulative adjustment. */
export async function bumpCumulativeAdjustment(
  db: D1Database,
  gameId: string,
  absDifficultyDeltaSum: number,
  nowIso: string,
): Promise<number> {
  const bump =
    typeof absDifficultyDeltaSum === "number" &&
    Number.isFinite(absDifficultyDeltaSum)
      ? Math.max(0, absDifficultyDeltaSum)
      : 0;
  if (bump <= 0) {
    return readCumulativeAdjustment(db, gameId);
  }
  await db
    .prepare(
      `INSERT INTO puzzle_table_meta (game_id, cumulative_adjustment, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(game_id) DO UPDATE SET
         cumulative_adjustment =
           puzzle_table_meta.cumulative_adjustment + excluded.cumulative_adjustment,
         updated_at = excluded.updated_at`,
    )
    .bind(gameId, bump, nowIso)
    .run();
  return readCumulativeAdjustment(db, gameId);
}
