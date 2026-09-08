export const GAMES = new Set(["chess", "checkers"]);

export const DEFAULT_ENDGAME_DIFFICULTY = 1200;
export const MAX_DELTAS = 500;
export const MAX_FEN_LENGTH = 200;
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

export type EndgameRow = {
  game_id: string;
  fen: string;
  difficulty: number;
  view_count: number;
  updated_at: string;
};

export function publicEndgame(row: EndgameRow) {
  return {
    gameId: row.game_id,
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
      `SELECT cumulative_adjustment FROM endgame_table_meta WHERE game_id = ?`,
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
      `INSERT INTO endgame_table_meta (game_id, cumulative_adjustment, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(game_id) DO UPDATE SET
         cumulative_adjustment =
           endgame_table_meta.cumulative_adjustment + excluded.cumulative_adjustment,
         updated_at = excluded.updated_at`,
    )
    .bind(gameId, bump, nowIso)
    .run();
  return readCumulativeAdjustment(db, gameId);
}
