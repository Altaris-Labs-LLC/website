import {
  json,
  readJson,
  requireSecret,
  type Env,
} from "../auth/_lib";
import {
  DEFAULT_ENDGAME_DIFFICULTY,
  GAMES,
  MAX_DELTAS,
  MAX_DIFFICULTY_DELTA,
  MAX_FEN_LENGTH,
  MAX_VIEW_DELTA,
  asInt,
  asNum,
  asText,
  bumpCumulativeAdjustment,
  normalizeGameId,
} from "./_lib";

type DeltaRow = {
  gameId?: unknown;
  fen?: unknown;
  difficultyDelta?: unknown;
  viewCountDelta?: unknown;
};

type Body = {
  gameId?: unknown;
  endgameDeltas?: unknown;
};

/**
 * Apply additive difficulty / view_count deltas.
 * Missing rows are inserted at difficulty 1200 before applying the delta.
 * Each applied |difficultyDelta| is added to the table cumulative adjustment.
 */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Endgames API unavailable." }, 503);
  }

  const body = await readJson<Body>(context.request);
  const defaultGame = normalizeGameId(body?.gameId);
  const rawDeltas = Array.isArray(body?.endgameDeltas)
    ? (body!.endgameDeltas as DeltaRow[])
    : [];
  if (rawDeltas.length === 0) {
    return json(context.request, { ok: true, applied: 0, cumulativeAdjustment: 0 });
  }
  if (rawDeltas.length > MAX_DELTAS) {
    return json(context.request, { error: "Too many deltas." }, 400);
  }

  const now = new Date().toISOString();
  let applied = 0;
  const absByGame = new Map<string, number>();

  for (const delta of rawDeltas) {
    const gameId = normalizeGameId(delta.gameId) || defaultGame;
    if (!GAMES.has(gameId)) continue;
    const fen = asText(delta.fen, MAX_FEN_LENGTH);
    if (!fen) continue;

    let dDelta = asNum(delta.difficultyDelta);
    if (!Number.isFinite(dDelta)) dDelta = 0;
    dDelta = Math.max(-MAX_DIFFICULTY_DELTA, Math.min(MAX_DIFFICULTY_DELTA, dDelta));

    let vDelta = asInt(delta.viewCountDelta);
    if (!Number.isFinite(vDelta)) vDelta = 0;
    vDelta = Math.max(-MAX_VIEW_DELTA, Math.min(MAX_VIEW_DELTA, vDelta));
    if (dDelta === 0 && vDelta === 0) continue;

    await context.env.ASCENT_DB.prepare(
      `INSERT INTO endgame_positions (game_id, fen, difficulty, view_count, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(game_id, fen) DO UPDATE SET
         difficulty = MAX(0, endgame_positions.difficulty + ?),
         view_count = MAX(0, endgame_positions.view_count + ?),
         updated_at = ?`,
    )
      .bind(
        gameId,
        fen,
        Math.max(0, DEFAULT_ENDGAME_DIFFICULTY + dDelta),
        Math.max(0, vDelta),
        now,
        dDelta,
        vDelta,
        now,
      )
      .run();
    applied += 1;
    if (dDelta !== 0) {
      absByGame.set(gameId, (absByGame.get(gameId) ?? 0) + Math.abs(dDelta));
    }
  }

  let cumulativeAdjustment = 0;
  for (const [gameId, absSum] of absByGame) {
    cumulativeAdjustment = await bumpCumulativeAdjustment(
      context.env.ASCENT_DB,
      gameId,
      absSum,
      now,
    );
  }
  if (absByGame.size === 0 && GAMES.has(defaultGame)) {
    cumulativeAdjustment = await bumpCumulativeAdjustment(
      context.env.ASCENT_DB,
      defaultGame,
      0,
      now,
    );
  }

  return json(context.request, {
    ok: true,
    applied,
    cumulativeAdjustment,
  });
}
