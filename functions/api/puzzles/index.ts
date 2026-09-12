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
  publicPuzzle,
  type PuzzleRow,
} from "./_lib";

type UpsertBody = {
  gameId?: unknown;
  puzzleType?: unknown;
  puzzle_type?: unknown;
  fen?: unknown;
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
  gamePlayedOn?: unknown;
  game_played_on?: unknown;
  target?: unknown;
  topLine?: unknown;
  top_line?: unknown;
  difficulty?: unknown;
  viewCount?: unknown;
  view_count?: unknown;
};

function asBoolInt(value: unknown): number {
  if (value === true || value === 1 || value === "1") return 1;
  return 0;
}

/**
 * Absolute upsert of a full puzzle row (content + difficulty/views).
 * Used for newly extracted local roots and one-time backup seeding.
 */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Puzzles API unavailable." }, 503);
  }

  const body = await readJson<UpsertBody>(context.request);
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
  const gamePlayedOn = asText(
    body?.gamePlayedOn ?? body?.game_played_on,
    40,
  ) || null;
  let target = asNum(body?.target);
  if (!Number.isFinite(target)) target = NaN;
  const topLine = asText(body?.topLine ?? body?.top_line, MAX_MOVE_LENGTH) || null;

  let difficulty = asNum(body?.difficulty);
  if (!Number.isFinite(difficulty)) difficulty = DEFAULT_PUZZLE_DIFFICULTY;
  difficulty = Math.max(0, difficulty);

  let viewCount = asInt(body?.viewCount ?? body?.view_count);
  if (!Number.isFinite(viewCount)) viewCount = 0;
  viewCount = Math.max(0, viewCount);

  const now = new Date().toISOString();

  await context.env.ASCENT_DB.prepare(
    `INSERT INTO puzzle_positions
       (game_id, puzzle_type, fen, move_string, next_fen, last_fen, last_move,
        player_color, expanded, target, top_line, game_played_on,
        difficulty, view_count, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_id, puzzle_type, fen) DO UPDATE SET
       move_string = excluded.move_string,
       next_fen = excluded.next_fen,
       last_fen = excluded.last_fen,
       last_move = excluded.last_move,
       player_color = excluded.player_color,
       expanded = excluded.expanded,
       target = excluded.target,
       top_line = excluded.top_line,
       game_played_on = excluded.game_played_on,
       difficulty = excluded.difficulty,
       view_count = excluded.view_count,
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
      gamePlayedOn,
      difficulty,
      viewCount,
      now,
    )
    .run();

  const row = await context.env.ASCENT_DB.prepare(
    `SELECT game_id, puzzle_type, fen, move_string, next_fen, last_fen,
            last_move, player_color, expanded, target, top_line,
            game_played_on, difficulty, view_count, updated_at
     FROM puzzle_positions
     WHERE game_id = ? AND puzzle_type = ? AND fen = ?`,
  )
    .bind(gameId, puzzleType, fen)
    .first<PuzzleRow>();

  return json(context.request, {
    ok: true,
    puzzle: row ? publicPuzzle(row) : null,
  });
}
