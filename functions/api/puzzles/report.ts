import {
  json,
  readJson,
  requireSecret,
  type Env,
} from "../auth/_lib";
import {
  DEFAULT_PUZZLE_DIFFICULTY,
  GAMES,
  MAX_FEN_LENGTH,
  MAX_MOVE_LENGTH,
  PUZZLE_TYPES,
  asInt,
  asNum,
  asText,
  normalizeGameId,
  normalizePuzzleType,
} from "./_lib";

const REPORT_REASONS = new Set([
  "multiple_correct",
  "engine_best_fails",
  "unwinnable",
  "dislike",
  "other",
]);

const REASON_COLUMN: Record<string, string> = {
  multiple_correct: "flag_multiple_correct",
  engine_best_fails: "flag_engine_best_fails",
  unwinnable: "flag_unwinnable",
  dislike: "flag_dislike",
  other: "flag_other",
};

type Body = {
  gameId?: unknown;
  puzzleType?: unknown;
  puzzle_type?: unknown;
  fen?: unknown;
  reason?: unknown;
  detail?: unknown;
  moveString?: unknown;
  move_string?: unknown;
  nextFen?: unknown;
  next_fen?: unknown;
  lastFen?: unknown;
  last_fen?: unknown;
  lastMove?: unknown;
  last_move?: unknown;
  playerColor?: unknown;
  player_color?: unknown;
  expanded?: unknown;
  target?: unknown;
  topLine?: unknown;
  top_line?: unknown;
  difficulty?: unknown;
};

function asBoolInt(value: unknown): number {
  if (value === true || value === 1 || value === "1") return 1;
  return 0;
}

/**
 * Increment a per-reason report flag on puzzle_positions.
 * Missing rows are inserted as stubs (difficulty 1200) before incrementing.
 */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Puzzles API unavailable." }, 503);
  }

  const body = await readJson<Body>(context.request);
  const gameId = normalizeGameId(body?.gameId);
  if (!GAMES.has(gameId)) {
    return json(context.request, { error: "Invalid gameId." }, 400);
  }
  const puzzleType = normalizePuzzleType(
    body?.puzzleType ?? body?.puzzle_type,
  );
  if (!PUZZLE_TYPES.has(puzzleType)) {
    return json(context.request, { error: "Invalid puzzleType." }, 400);
  }
  const fen = asText(body?.fen, MAX_FEN_LENGTH);
  if (!fen) {
    return json(context.request, { error: "Missing fen." }, 400);
  }
  const reason = asText(body?.reason, 40).toLowerCase();
  if (!REPORT_REASONS.has(reason)) {
    return json(context.request, { error: "Invalid reason." }, 400);
  }
  if (reason === "multiple_correct" && puzzleType !== "tactic") {
    return json(
      context.request,
      { error: "multiple_correct is only valid for tactic puzzles." },
      400,
    );
  }
  const column = REASON_COLUMN[reason];
  if (!column) {
    return json(context.request, { error: "Invalid reason." }, 400);
  }

  const moveString = asText(
    body?.moveString ?? body?.move_string,
    MAX_MOVE_LENGTH,
  );
  const nextFen = asText(body?.nextFen ?? body?.next_fen, MAX_FEN_LENGTH);
  const lastFen = asText(body?.lastFen ?? body?.last_fen, MAX_FEN_LENGTH);
  const lastMove = asText(body?.lastMove ?? body?.last_move, 32);
  let playerColor = asInt(body?.playerColor ?? body?.player_color);
  if (!Number.isFinite(playerColor)) playerColor = 0;
  playerColor = playerColor === 1 ? 1 : 0;
  const expanded = asBoolInt(body?.expanded);
  let target = asNum(body?.target);
  if (!Number.isFinite(target)) target = NaN;
  const topLine =
    asText(body?.topLine ?? body?.top_line, MAX_MOVE_LENGTH) || null;
  let difficulty = asNum(body?.difficulty);
  if (!Number.isFinite(difficulty)) difficulty = DEFAULT_PUZZLE_DIFFICULTY;
  difficulty = Math.max(0, difficulty);
  // detail is accepted for future use / logging but not persisted yet
  void asText(body?.detail, 2000);

  const now = new Date().toISOString();

  // Insert stub if missing, then increment the selected flag column.
  // Column name is from a fixed allowlist — never user-controlled SQL.
  await context.env.ASCENT_DB.prepare(
    `INSERT INTO puzzle_positions
       (game_id, puzzle_type, fen, move_string, next_fen, last_fen, last_move,
        player_color, expanded, target, top_line, difficulty, view_count,
        flag_multiple_correct, flag_engine_best_fails, flag_unwinnable,
        flag_dislike, flag_other, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, ?)
     ON CONFLICT(game_id, puzzle_type, fen) DO UPDATE SET
       updated_at = excluded.updated_at`,
  )
    .bind(
      gameId,
      puzzleType,
      fen,
      moveString,
      nextFen,
      lastFen,
      lastMove,
      playerColor,
      expanded,
      Number.isFinite(target) ? target : null,
      topLine,
      difficulty,
      now,
    )
    .run();

  await context.env.ASCENT_DB.prepare(
    `UPDATE puzzle_positions
     SET ${column} = ${column} + 1,
         updated_at = ?
     WHERE game_id = ? AND puzzle_type = ? AND fen = ?`,
  )
    .bind(now, gameId, puzzleType, fen)
    .run();

  const flags = await context.env.ASCENT_DB.prepare(
    `SELECT flag_multiple_correct, flag_engine_best_fails, flag_unwinnable,
            flag_dislike, flag_other
     FROM puzzle_positions
     WHERE game_id = ? AND puzzle_type = ? AND fen = ?`,
  )
    .bind(gameId, puzzleType, fen)
    .first<{
      flag_multiple_correct: number;
      flag_engine_best_fails: number;
      flag_unwinnable: number;
      flag_dislike: number;
      flag_other: number;
    }>();

  return json(context.request, {
    ok: true,
    reason,
    flags: flags
      ? {
          multipleCorrect: flags.flag_multiple_correct,
          engineBestFails: flags.flag_engine_best_fails,
          unwinnable: flags.flag_unwinnable,
          dislike: flags.flag_dislike,
          other: flags.flag_other,
        }
      : null,
  });
}
