import {
  json,
  readJson,
  requireSecret,
  resolveSubscription,
  userFromRequest,
  type Env,
} from "../auth/_lib";
import {
  GAMES,
  MAX_FEN_LENGTH,
  MAX_FIELD_CHARS,
  SAVED_ANALYSIS_COLUMNS,
  asInt,
  asNum,
  asText,
  hasSavedAdvantageData,
  hasSavedDifficultyData,
  hasSavedEvalData,
  hasSavedOrthodoxyData,
  publicSavedAnalysis,
  sharpnessFromAdvantageData,
  shouldPersistEngineAnalysis,
  simulationGames,
  type SavedAnalysisRow,
} from "./_lib";

type EnginePayload = {
  ran?: unknown;
  data?: unknown;
  depth?: unknown;
  thinkTime?: unknown;
  tableSecondary?: unknown;
  tablePrimary?: unknown;
};

type SubmitBody = {
  gameId?: unknown;
  fen?: unknown;
  eval?: EnginePayload;
  advantage?: EnginePayload;
  sharpness?: EnginePayload;
  simulation?: EnginePayload;
  orthodoxy?: EnginePayload;
  difficulty?: EnginePayload;
};

function parseEngine(raw: EnginePayload | undefined): {
  ran: boolean;
  data: string;
  depth: number;
  thinkTime: number;
  tableSecondary: number;
  tablePrimary: number;
} {
  return {
    ran: raw?.ran === true,
    data: asText(raw?.data),
    depth: Math.max(0, asInt(raw?.depth)),
    thinkTime: Math.max(0, asNum(raw?.thinkTime)),
    tableSecondary: Math.max(0, asInt(raw?.tableSecondary)),
    tablePrimary: Math.max(0, asInt(raw?.tablePrimary)),
  };
}

function gameAndFen(gameIdRaw: unknown, fenRaw: unknown): { gameId: string; fen: string } | null {
  const gameId = typeof gameIdRaw === "string" ? gameIdRaw.trim().toLowerCase() : "";
  const fen = typeof fenRaw === "string" ? fenRaw.trim() : "";
  if (!GAMES.has(gameId) || !fen || fen.length > MAX_FEN_LENGTH) return null;
  return { gameId, fen };
}

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Saved analysis is unavailable." }, 503);
  }
  const user = await userFromRequest(context.env, context.request);
  if (!user) {
    return json(context.request, { error: "Sign in to use Altaris analysis." }, 401);
  }
  if (!resolveSubscription(user).isPremium) {
    return json(context.request, { error: "Premium is required." }, 403);
  }
  const url = new URL(context.request.url);
  const parsed = gameAndFen(url.searchParams.get("gameId"), url.searchParams.get("fen"));
  if (!parsed) {
    return json(context.request, { error: "That position could not be read." }, 400);
  }
  const row = await context.env.ASCENT_DB.prepare(
    `SELECT ${SAVED_ANALYSIS_COLUMNS} FROM saved_analysis WHERE game_id = ? AND fen = ? LIMIT 1`,
  )
    .bind(parsed.gameId, parsed.fen)
    .first<SavedAnalysisRow>();
  return json(context.request, {
    analysis: row ? publicSavedAnalysis(row) : null,
  });
}

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Saved analysis is unavailable." }, 503);
  }
  const body = await readJson<SubmitBody>(context.request);
  const parsed = gameAndFen(body?.gameId, body?.fen);
  if (!parsed) {
    return json(context.request, { error: "That position could not be read." }, 400);
  }
  const evalEngine = parseEngine(body?.eval);
  const advantage = parseEngine(body?.advantage);
  const sharpness = parseEngine(body?.sharpness);
  const simulation = parseEngine(body?.simulation);
  const orthodoxy = parseEngine(body?.orthodoxy);
  const difficulty = parseEngine(body?.difficulty);

  const payloadChars =
    evalEngine.data.length +
    advantage.data.length +
    simulation.data.length +
    orthodoxy.data.length +
    difficulty.data.length;
  if (payloadChars > MAX_FIELD_CHARS * 2) {
    return json(context.request, { error: "Analysis payload is too large." }, 413);
  }

  const existing = await context.env.ASCENT_DB.prepare(
    `SELECT ${SAVED_ANALYSIS_COLUMNS} FROM saved_analysis WHERE game_id = ? AND fen = ? LIMIT 1`,
  )
    .bind(parsed.gameId, parsed.fen)
    .first<SavedAnalysisRow>();

  const savedEvalDepth = asInt(existing?.eval_depth);
  const saveEval = shouldPersistEngineAnalysis({
    ranThisSession: evalEngine.ran,
    currentDepth: evalEngine.depth,
    savedDepth: savedEvalDepth,
    hasExistingSavedData: hasSavedEvalData(existing),
  });

  const savedAdvDepth = asInt(existing?.advantage_depth);
  const savedSharp = sharpnessFromAdvantageData(existing?.advantage_data || "");
  const incomingSharpScore = sharpness.ran
    ? sharpness.tableSecondary + sharpness.tablePrimary
    : sharpnessFromAdvantageData(advantage.data).score;
  const saveAdvantage = shouldPersistEngineAnalysis({
    ranThisSession: advantage.ran,
    currentDepth: advantage.depth,
    savedDepth: savedAdvDepth,
    hasExistingSavedData: hasSavedAdvantageData(existing),
  });
  const saveSharpness = shouldPersistEngineAnalysis({
    ranThisSession: sharpness.ran,
    currentDepth: incomingSharpScore,
    savedDepth: savedSharp.score,
    hasExistingSavedData: savedSharp.score > 0,
  });
  const saveAdvantagePayload = saveAdvantage || saveSharpness;

  const savedSimGames = simulationGames(existing?.simulation_data || "");
  const incomingSimGames = simulationGames(simulation.data);
  const saveSimulation = shouldPersistEngineAnalysis({
    ranThisSession: simulation.ran,
    currentDepth: incomingSimGames,
    savedDepth: savedSimGames,
    hasExistingSavedData: savedSimGames > 0,
  });

  const savedOrthodoxyDepth = asInt(existing?.orthodoxy_depth);
  const saveOrthodoxy = shouldPersistEngineAnalysis({
    ranThisSession: orthodoxy.ran,
    currentDepth: orthodoxy.depth,
    savedDepth: savedOrthodoxyDepth,
    hasExistingSavedData: hasSavedOrthodoxyData(existing),
  });

  const savedDifficultyDepth = asInt(existing?.difficulty_depth);
  const saveDifficulty = shouldPersistEngineAnalysis({
    ranThisSession: difficulty.ran,
    currentDepth: difficulty.depth,
    savedDepth: savedDifficultyDepth,
    hasExistingSavedData: hasSavedDifficultyData(existing),
  });

  if (
    !saveEval &&
    !saveAdvantagePayload &&
    !saveSimulation &&
    !saveOrthodoxy &&
    !saveDifficulty
  ) {
    return json(context.request, { saved: false });
  }

  const now = new Date().toISOString();
  if (!existing) {
    await context.env.ASCENT_DB.prepare(
      `INSERT INTO saved_analysis (
        game_id, fen,
        eval_data, eval_depth, advantage_data, advantage_depth, simulation_data,
        orthodoxy_data, orthodoxy_depth, difficulty_data, difficulty_depth,
        eval_think_time, advantage_think_time, sharpness_think_time,
        simplicity_think_time, simulation_think_time, difficulty_think_time,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        parsed.gameId,
        parsed.fen,
        saveEval ? evalEngine.data : null,
        saveEval ? evalEngine.depth : null,
        saveAdvantagePayload ? advantage.data : null,
        saveAdvantage ? advantage.depth : null,
        saveSimulation ? simulation.data : null,
        saveOrthodoxy ? orthodoxy.data : null,
        saveOrthodoxy ? orthodoxy.depth : 0,
        saveDifficulty ? difficulty.data : null,
        saveDifficulty ? difficulty.depth : 0,
        saveEval ? evalEngine.thinkTime : null,
        saveAdvantage ? advantage.thinkTime : null,
        saveSharpness ? sharpness.thinkTime : null,
        saveOrthodoxy ? orthodoxy.thinkTime : null,
        saveSimulation ? simulation.thinkTime : null,
        saveDifficulty ? difficulty.thinkTime : null,
        now,
      )
      .run();
    return json(context.request, { saved: true, created: true });
  }

  const sets: string[] = [];
  const binds: unknown[] = [];
  if (saveEval) {
    sets.push("eval_data = ?", "eval_depth = ?", "eval_think_time = ?");
    binds.push(evalEngine.data, evalEngine.depth, evalEngine.thinkTime);
  }
  if (saveAdvantagePayload) {
    sets.push("advantage_data = ?");
    binds.push(advantage.data);
    if (saveAdvantage) {
      sets.push("advantage_depth = ?", "advantage_think_time = ?");
      binds.push(advantage.depth, advantage.thinkTime);
    }
    if (saveSharpness) {
      sets.push("sharpness_think_time = ?");
      binds.push(sharpness.thinkTime);
    }
  }
  if (saveSimulation) {
    sets.push("simulation_data = ?", "simulation_think_time = ?");
    binds.push(simulation.data, simulation.thinkTime);
  }
  if (saveOrthodoxy) {
    sets.push("orthodoxy_data = ?", "orthodoxy_depth = ?", "simplicity_think_time = ?");
    binds.push(orthodoxy.data, orthodoxy.depth, orthodoxy.thinkTime);
  }
  if (saveDifficulty) {
    sets.push("difficulty_data = ?", "difficulty_depth = ?", "difficulty_think_time = ?");
    binds.push(difficulty.data, difficulty.depth, difficulty.thinkTime);
  }
  sets.push("updated_at = ?");
  binds.push(now, parsed.gameId, parsed.fen);
  await context.env.ASCENT_DB.prepare(
    `UPDATE saved_analysis SET ${sets.join(", ")} WHERE game_id = ? AND fen = ?`,
  )
    .bind(...binds)
    .run();
  return json(context.request, { saved: true, created: false });
}
