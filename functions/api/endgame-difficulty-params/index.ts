import {
  json,
  readJson,
  requireSecret,
  type Env,
} from "../auth/_lib";

const GAMES = new Set(["chess", "checkers"]);

type ParamsBody = {
  gameId?: unknown;
  difficulty_knowledge_coefficient?: unknown;
  knowledgeCoefficient?: unknown;
  exposures?: unknown;
};

function gameIdOf(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

function asNum(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asInt(value: unknown, fallback: number): number {
  return Math.trunc(asNum(value, fallback));
}

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Endgame params unavailable." }, 503);
  }
  const url = new URL(context.request.url);
  const gameId = gameIdOf(url.searchParams.get("gameId"));
  if (!GAMES.has(gameId)) {
    return json(context.request, { error: "Invalid gameId." }, 400);
  }

  const row = await context.env.ASCENT_DB.prepare(
    `SELECT difficulty_knowledge_coefficient, exposures
     FROM endgame_difficulty_params
     WHERE game_id = ?`,
  )
    .bind(gameId)
    .first<{
      difficulty_knowledge_coefficient: number;
      exposures: number;
    }>();

  return json(context.request, {
    gameId,
    difficulty_knowledge_coefficient: row?.difficulty_knowledge_coefficient ?? 1.0,
    exposures: row?.exposures ?? 0,
  });
}

/** Absolute overwrite (legacy / dirty snapshot). Prefer /deltas. */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Endgame params unavailable." }, 503);
  }
  const body = await readJson<ParamsBody>(context.request);
  const gameId = gameIdOf(body?.gameId);
  if (!GAMES.has(gameId)) {
    return json(context.request, { error: "Invalid gameId." }, 400);
  }
  const kc = asNum(
    body?.difficulty_knowledge_coefficient ?? body?.knowledgeCoefficient,
    1.0,
  );
  const exposures = Math.max(0, asInt(body?.exposures, 0));
  const now = new Date().toISOString();

  await context.env.ASCENT_DB.prepare(
    `INSERT INTO endgame_difficulty_params
       (game_id, difficulty_knowledge_coefficient, exposures, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(game_id) DO UPDATE SET
       difficulty_knowledge_coefficient = excluded.difficulty_knowledge_coefficient,
       exposures = excluded.exposures,
       updated_at = excluded.updated_at`,
  )
    .bind(gameId, kc, exposures, now)
    .run();

  return json(context.request, {
    ok: true,
    gameId,
    difficulty_knowledge_coefficient: kc,
    exposures,
  });
}
