import {
  json,
  readJson,
  requireSecret,
  type Env,
} from "../auth/_lib";

const GAMES = new Set(["chess", "checkers"]);
const PUZZLE_TYPES = new Set(["tactic", "conversion", "strategic"]);
const MAX_CEC_DELTA = 10;
const MAX_KC_DELTA = 10;
const MAX_EXPOSURES_DELTA = 100;

type Body = {
  gameId?: unknown;
  puzzleType?: unknown;
  puzzle_type?: unknown;
  difficulty_computer_elo_coefficient_delta?: unknown;
  difficulty_knowledge_coefficient_delta?: unknown;
  exposures_delta?: unknown;
};

function gameIdOf(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

function puzzleTypeOf(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const t = raw.trim().toLowerCase();
  if (t === "strategy" || t === "strategic") return "strategic";
  if (t === "tactics" || t === "tactic") return "tactic";
  if (t === "conversion") return "conversion";
  return t;
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
    return json(context.request, { error: "Puzzle params unavailable." }, 503);
  }
  const body = await readJson<Body>(context.request);
  const gameId = gameIdOf(body?.gameId);
  if (!GAMES.has(gameId)) {
    return json(context.request, { error: "Invalid gameId." }, 400);
  }
  const puzzleType = puzzleTypeOf(body?.puzzleType ?? body?.puzzle_type);
  if (!PUZZLE_TYPES.has(puzzleType)) {
    return json(context.request, { error: "Invalid puzzleType." }, 400);
  }

  let cecDelta = asNum(body?.difficulty_computer_elo_coefficient_delta);
  cecDelta = Math.max(-MAX_CEC_DELTA, Math.min(MAX_CEC_DELTA, cecDelta));
  let kcDelta = asNum(body?.difficulty_knowledge_coefficient_delta);
  kcDelta = Math.max(-MAX_KC_DELTA, Math.min(MAX_KC_DELTA, kcDelta));
  let expDelta = asInt(body?.exposures_delta);
  expDelta = Math.max(-MAX_EXPOSURES_DELTA, Math.min(MAX_EXPOSURES_DELTA, expDelta));
  if (cecDelta === 0 && kcDelta === 0 && expDelta === 0) {
    return json(context.request, { ok: true, applied: false });
  }

  const now = new Date().toISOString();
  await context.env.ASCENT_DB.prepare(
    `INSERT INTO puzzle_difficulty_params
       (game_id, puzzle_type, difficulty_computer_elo_coefficient,
        difficulty_knowledge_coefficient, exposures, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_id, puzzle_type) DO UPDATE SET
       difficulty_computer_elo_coefficient =
         COALESCE(puzzle_difficulty_params.difficulty_computer_elo_coefficient, 1.0) + ?,
       difficulty_knowledge_coefficient =
         puzzle_difficulty_params.difficulty_knowledge_coefficient + ?,
       exposures = MAX(0, puzzle_difficulty_params.exposures + ?),
       updated_at = ?`,
  )
    .bind(
      gameId,
      puzzleType,
      1.0 + cecDelta,
      1.0 + kcDelta,
      Math.max(0, expDelta),
      now,
      cecDelta,
      kcDelta,
      expDelta,
      now,
    )
    .run();

  return json(context.request, { ok: true, applied: true });
}
