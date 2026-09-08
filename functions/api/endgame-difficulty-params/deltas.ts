import {
  json,
  readJson,
  requireSecret,
  type Env,
} from "../auth/_lib";

const GAMES = new Set(["chess", "checkers"]);
const MAX_KC_DELTA = 10;
const MAX_EXPOSURES_DELTA = 100;

type Body = {
  gameId?: unknown;
  difficulty_knowledge_coefficient_delta?: unknown;
  exposures_delta?: unknown;
};

function gameIdOf(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

function asNum(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function asInt(value: unknown): number {
  return Math.trunc(asNum(value));
}

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Endgame params unavailable." }, 503);
  }
  const body = await readJson<Body>(context.request);
  const gameId = gameIdOf(body?.gameId);
  if (!GAMES.has(gameId)) {
    return json(context.request, { error: "Invalid gameId." }, 400);
  }

  let kcDelta = asNum(body?.difficulty_knowledge_coefficient_delta);
  kcDelta = Math.max(-MAX_KC_DELTA, Math.min(MAX_KC_DELTA, kcDelta));
  let expDelta = asInt(body?.exposures_delta);
  expDelta = Math.max(-MAX_EXPOSURES_DELTA, Math.min(MAX_EXPOSURES_DELTA, expDelta));
  if (kcDelta === 0 && expDelta === 0) {
    return json(context.request, { ok: true, applied: false });
  }

  const now = new Date().toISOString();
  await context.env.ASCENT_DB.prepare(
    `INSERT INTO endgame_difficulty_params
       (game_id, difficulty_knowledge_coefficient, exposures, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(game_id) DO UPDATE SET
       difficulty_knowledge_coefficient =
         endgame_difficulty_params.difficulty_knowledge_coefficient + ?,
       exposures = MAX(0, endgame_difficulty_params.exposures + ?),
       updated_at = ?`,
  )
    .bind(gameId, 1.0 + kcDelta, Math.max(0, expDelta), now, kcDelta, expDelta, now)
    .run();

  return json(context.request, { ok: true, applied: true });
}
