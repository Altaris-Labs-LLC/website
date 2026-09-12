import { json, requireSecret, type Env } from "../auth/_lib";
import {
  GAMES,
  asInt,
  asText,
  normalizeGameId,
  publicPuzzleDifficulty,
  type PuzzleRow,
} from "./_lib";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

function encodeCursor(updatedAt: string, puzzleType: string, fen: string): string {
  return `${updatedAt}||${puzzleType}||${fen}`;
}

function decodeCursor(
  raw: string,
): { updatedAt: string; puzzleType: string; fen: string } | null {
  const first = raw.indexOf("||");
  if (first <= 0) return null;
  const second = raw.indexOf("||", first + 2);
  if (second <= first + 2) return null;
  const updatedAt = raw.slice(0, first).trim();
  const puzzleType = raw.slice(first + 2, second).trim();
  const fen = raw.slice(second + 2).trim();
  if (!updatedAt || !puzzleType || !fen) return null;
  return { updatedAt, puzzleType, fen };
}

/**
 * Difficulty pull for matching local roots. Paginate with opaque `cursor`
 * (`updatedAt||puzzleType||fen`).
 */
export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Puzzles API unavailable." }, 503);
  }

  const url = new URL(context.request.url);
  const gameId = normalizeGameId(url.searchParams.get("gameId"));
  if (!GAMES.has(gameId)) {
    return json(context.request, { error: "Invalid gameId." }, 400);
  }

  const since = asText(url.searchParams.get("since") ?? "", 40);
  const cursorRaw = asText(url.searchParams.get("cursor") ?? "", 400);
  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
  let limit = asInt(url.searchParams.get("limit"));
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  limit = Math.min(MAX_LIMIT, Math.max(1, limit));

  const serverTime = new Date().toISOString();

  let rows: PuzzleRow[] = [];
  if (cursor) {
    const result = await context.env.ASCENT_DB.prepare(
      `SELECT game_id, puzzle_type, fen, move_string, next_fen, last_fen,
              last_move, player_color, expanded, target, top_line,
              game_played_on, difficulty, view_count, updated_at
       FROM puzzle_positions
       WHERE game_id = ?
         AND (
           updated_at > ?
           OR (updated_at = ? AND puzzle_type > ?)
           OR (updated_at = ? AND puzzle_type = ? AND fen > ?)
         )
       ORDER BY updated_at ASC, puzzle_type ASC, fen ASC
       LIMIT ?`,
    )
      .bind(
        gameId,
        cursor.updatedAt,
        cursor.updatedAt,
        cursor.puzzleType,
        cursor.updatedAt,
        cursor.puzzleType,
        cursor.fen,
        limit,
      )
      .all<PuzzleRow>();
    rows = result.results ?? [];
  } else if (since) {
    const result = await context.env.ASCENT_DB.prepare(
      `SELECT game_id, puzzle_type, fen, move_string, next_fen, last_fen,
              last_move, player_color, expanded, target, top_line,
              game_played_on, difficulty, view_count, updated_at
       FROM puzzle_positions
       WHERE game_id = ?
         AND updated_at > ?
       ORDER BY updated_at ASC, puzzle_type ASC, fen ASC
       LIMIT ?`,
    )
      .bind(gameId, since, limit)
      .all<PuzzleRow>();
    rows = result.results ?? [];
  } else {
    const result = await context.env.ASCENT_DB.prepare(
      `SELECT game_id, puzzle_type, fen, move_string, next_fen, last_fen,
              last_move, player_color, expanded, target, top_line,
              game_played_on, difficulty, view_count, updated_at
       FROM puzzle_positions
       WHERE game_id = ?
       ORDER BY updated_at ASC, puzzle_type ASC, fen ASC
       LIMIT ?`,
    )
      .bind(gameId, limit)
      .all<PuzzleRow>();
    rows = result.results ?? [];
  }

  const hasMore = rows.length >= limit;
  const last = rows.length > 0 ? rows[rows.length - 1]! : null;
  const nextCursor =
    hasMore && last
      ? encodeCursor(last.updated_at, last.puzzle_type, last.fen)
      : null;

  return json(context.request, {
    gameId,
    serverTime,
    hasMore,
    nextCursor,
    rows: rows.map(publicPuzzleDifficulty),
  });
}
