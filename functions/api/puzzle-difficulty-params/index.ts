import {
  json,
  readJson,
  requireSecret,
  type Env,
} from "../auth/_lib";

const GAMES = new Set(["chess", "checkers"]);
const PUZZLE_TYPES = new Set(["tactic", "conversion", "strategic"]);

type ParamsBody = {
  gameId?: unknown;
  puzzleType?: unknown;
  puzzle_type?: unknown;
  difficulty_computer_elo_coefficient?: unknown;
  computerEloCoefficient?: unknown;
  difficulty_knowledge_coefficient?: unknown;
  knowledgeCoefficient?: unknown;
  exposures?: unknown;
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

function publicParams(row: {
  puzzle_type: string;
  difficulty_computer_elo_coefficient: number | null;
  difficulty_knowledge_coefficient: number;
  exposures: number;
}) {
  return {
    puzzleType: row.puzzle_type,
    difficulty_computer_elo_coefficient:
      row.difficulty_computer_elo_coefficient ?? 1.0,
    difficulty_knowledge_coefficient: row.difficulty_knowledge_coefficient,
    exposures: row.exposures,
  };
}

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Puzzle params unavailable." }, 503);
  }
  const url = new URL(context.request.url);
  const gameId = gameIdOf(url.searchParams.get("gameId"));
  if (!GAMES.has(gameId)) {
    return json(context.request, { error: "Invalid gameId." }, 400);
  }

  const typeFilter = puzzleTypeOf(url.searchParams.get("puzzleType"));
  if (typeFilter && !PUZZLE_TYPES.has(typeFilter)) {
    return json(context.request, { error: "Invalid puzzleType." }, 400);
  }

  const result = typeFilter
    ? await context.env.ASCENT_DB.prepare(
        `SELECT puzzle_type, difficulty_computer_elo_coefficient,
                difficulty_knowledge_coefficient, exposures
         FROM puzzle_difficulty_params
         WHERE game_id = ? AND puzzle_type = ?`,
      )
        .bind(gameId, typeFilter)
        .all<{
          puzzle_type: string;
          difficulty_computer_elo_coefficient: number | null;
          difficulty_knowledge_coefficient: number;
          exposures: number;
        }>()
    : await context.env.ASCENT_DB.prepare(
        `SELECT puzzle_type, difficulty_computer_elo_coefficient,
                difficulty_knowledge_coefficient, exposures
         FROM puzzle_difficulty_params
         WHERE game_id = ?`,
      )
        .bind(gameId)
        .all<{
          puzzle_type: string;
          difficulty_computer_elo_coefficient: number | null;
          difficulty_knowledge_coefficient: number;
          exposures: number;
        }>();

  const rows = result.results ?? [];
  const byPuzzleType: Record<string, ReturnType<typeof publicParams>> = {};
  for (const row of rows) {
    byPuzzleType[row.puzzle_type] = publicParams(row);
  }

  // Legacy flat payload: prefer tactic, else first row, else defaults.
  const legacy =
    byPuzzleType.tactic ??
    (rows[0]
      ? publicParams(rows[0])
      : {
          puzzleType: "tactic",
          difficulty_computer_elo_coefficient: 1.0,
          difficulty_knowledge_coefficient: 1.0,
          exposures: 0,
        });

  return json(context.request, {
    gameId,
    byPuzzleType,
    paramsByType: byPuzzleType,
    ...legacy,
  });
}

/** Absolute overwrite (legacy / dirty snapshot / one-time seed). Prefer /deltas. */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Puzzle params unavailable." }, 503);
  }
  const body = await readJson<ParamsBody>(context.request);
  const gameId = gameIdOf(body?.gameId);
  if (!GAMES.has(gameId)) {
    return json(context.request, { error: "Invalid gameId." }, 400);
  }
  const puzzleType = puzzleTypeOf(body?.puzzleType ?? body?.puzzle_type) || "tactic";
  if (!PUZZLE_TYPES.has(puzzleType)) {
    return json(context.request, { error: "Invalid puzzleType." }, 400);
  }
  const cec = asNum(
    body?.difficulty_computer_elo_coefficient ?? body?.computerEloCoefficient,
    1.0,
  );
  const kc = asNum(
    body?.difficulty_knowledge_coefficient ?? body?.knowledgeCoefficient,
    1.0,
  );
  const exposures = Math.max(0, asInt(body?.exposures, 0));
  const now = new Date().toISOString();

  await context.env.ASCENT_DB.prepare(
    `INSERT INTO puzzle_difficulty_params
       (game_id, puzzle_type, difficulty_computer_elo_coefficient,
        difficulty_knowledge_coefficient, exposures, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_id, puzzle_type) DO UPDATE SET
       difficulty_computer_elo_coefficient =
         excluded.difficulty_computer_elo_coefficient,
       difficulty_knowledge_coefficient =
         excluded.difficulty_knowledge_coefficient,
       exposures = excluded.exposures,
       updated_at = excluded.updated_at`,
  )
    .bind(gameId, puzzleType, cec, kc, exposures, now)
    .run();

  return json(context.request, {
    ok: true,
    gameId,
    puzzleType,
    difficulty_computer_elo_coefficient: cec,
    difficulty_knowledge_coefficient: kc,
    exposures,
  });
}
