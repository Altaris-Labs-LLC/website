import { json, requireSecret, type Env } from "../auth/_lib";
import {
  GAMES,
  PUZZLE_TYPES,
  asNum,
  asText,
  normalizeGameId,
  normalizePuzzleType,
  publicPuzzle,
  type PuzzleRow,
} from "./_lib";

/**
 * Pick one server puzzle near targetDifficulty (optional puzzleType filter).
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

  let target = asNum(url.searchParams.get("targetDifficulty"));
  if (!Number.isFinite(target)) target = 1200;

  const typeRaw = asText(url.searchParams.get("puzzleType") ?? "", 32);
  const puzzleType = typeRaw ? normalizePuzzleType(typeRaw) : "";
  if (puzzleType && !PUZZLE_TYPES.has(puzzleType)) {
    return json(context.request, { error: "Invalid puzzleType." }, 400);
  }

  // Prefer rows that already have playable content (move_string).
  let row: PuzzleRow | null = null;
  if (puzzleType) {
    row =
      (await context.env.ASCENT_DB.prepare(
        `SELECT game_id, puzzle_type, fen, move_string, next_fen, last_fen,
                last_move, player_color, expanded, target, top_line,
                game_played_on, difficulty, view_count, updated_at
         FROM puzzle_positions
         WHERE game_id = ?
           AND puzzle_type = ?
           AND TRIM(COALESCE(move_string, '')) != ''
         ORDER BY ABS(difficulty - ?) ASC, view_count ASC
         LIMIT 1`,
      )
        .bind(gameId, puzzleType, target)
        .first<PuzzleRow>()) ?? null;
  } else {
    row =
      (await context.env.ASCENT_DB.prepare(
        `SELECT game_id, puzzle_type, fen, move_string, next_fen, last_fen,
                last_move, player_color, expanded, target, top_line,
                game_played_on, difficulty, view_count, updated_at
         FROM puzzle_positions
         WHERE game_id = ?
           AND TRIM(COALESCE(move_string, '')) != ''
         ORDER BY ABS(difficulty - ?) ASC, view_count ASC
         LIMIT 1`,
      )
        .bind(gameId, target)
        .first<PuzzleRow>()) ?? null;
  }

  if (!row) {
    return json(context.request, { puzzle: null }, 404);
  }

  return json(context.request, { puzzle: publicPuzzle(row) });
}
