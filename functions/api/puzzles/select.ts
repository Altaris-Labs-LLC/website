import { json, requireSecret, type Env } from "../auth/_lib";
import {
  GAMES,
  PUZZLE_TYPES,
  asInt,
  asNum,
  asText,
  normalizeGameId,
  normalizePuzzleType,
  publicPuzzle,
  type PuzzleRow,
} from "./_lib";

const SELECT_COLUMNS = `game_id, puzzle_type, fen, move_string, next_fen, last_fen,
            last_move, player_color, expanded, target, top_line,
            game_played_on, difficulty, view_count, updated_at`;

/** Pipe-separated FENs the client already dealt or reported. */
function excludeFenList(raw: string | null): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split("|")) {
    const fen = part.trim();
    if (!fen || fen.length > 200 || seen.has(fen)) continue;
    seen.add(fen);
    out.push(fen);
    if (out.length >= 48) break;
  }
  return out;
}

function closer(a: PuzzleRow, b: PuzzleRow, target: number): number {
  const da = Math.abs(a.difficulty - target);
  const db = Math.abs(b.difficulty - target);
  if (da !== db) return da - db;
  if (a.view_count !== b.view_count) return a.view_count - b.view_count;
  if (a.fen < b.fen) return -1;
  if (a.fen > b.fen) return 1;
  return 0;
}

/**
 * Nearest playable rows on one side of [target], using the difficulty index.
 * `ge` walks difficulty upward from the target; `lt` walks downward.
 */
async function readDifficultySide(
  db: D1Database,
  gameId: string,
  puzzleType: string,
  excludeFens: string[],
  target: number,
  limit: number,
  side: "ge" | "lt",
): Promise<PuzzleRow[]> {
  const notIn = excludeFens.length
    ? ` AND fen NOT IN (${excludeFens.map(() => "?").join(",")})`
    : "";
  const cmp = side === "ge" ? ">=" : "<";
  const direction = side === "ge" ? "ASC" : "DESC";
  const binds: Array<string | number> = [gameId, puzzleType];
  binds.push(...excludeFens, target, limit);
  const result = await db
    .prepare(
      `SELECT ${SELECT_COLUMNS}
       FROM puzzle_positions
       WHERE game_id = ?
         AND puzzle_type = ?
         AND TRIM(move_string) != ''
         ${notIn}
         AND difficulty ${cmp} ?
       ORDER BY difficulty ${direction}, view_count ASC
       LIMIT ?`,
    )
    .bind(...binds)
    .all<PuzzleRow>();
  return result.results ?? [];
}

/**
 * The [limit] puzzles closest to [target]. Each side is an index range, so
 * this does not scan the whole type. The merged order matches
 * ABS(difficulty - target), then lower view count.
 */
async function nearestPuzzles(
  db: D1Database,
  gameId: string,
  puzzleType: string,
  excludeFens: string[],
  target: number,
  limit: number,
): Promise<PuzzleRow[]> {
  const types = puzzleType ? [puzzleType] : [...PUZZLE_TYPES];
  const sides = await Promise.all(
    types.flatMap((type) => [
      readDifficultySide(db, gameId, type, excludeFens, target, limit, "ge"),
      readDifficultySide(db, gameId, type, excludeFens, target, limit, "lt"),
    ]),
  );
  const seen = new Set<string>();
  const merged: PuzzleRow[] = [];
  for (const row of sides.flat()) {
    const key = `${row.puzzle_type}\n${row.fen}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  merged.sort((a, b) => closer(a, b, target));
  return merged.slice(0, limit);
}

/**
 * Puzzles nearest [targetDifficulty]. Optional puzzleType filter.
 * Returns up to 30 rows so the client can fill a buffer in one request.
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

  let limit = asInt(url.searchParams.get("limit"));
  if (!Number.isFinite(limit) || limit < 1) limit = 30;
  limit = Math.min(30, limit);

  const excludeFens = excludeFenList(url.searchParams.get("excludeFens"));
  const rows = await nearestPuzzles(
    context.env.ASCENT_DB,
    gameId,
    puzzleType,
    excludeFens,
    target,
    limit,
  );
  const puzzles = rows.map(publicPuzzle);
  if (puzzles.length === 0) {
    return json(context.request, { puzzle: null, puzzles: [] }, 404);
  }

  return json(context.request, { puzzle: puzzles[0], puzzles });
}
