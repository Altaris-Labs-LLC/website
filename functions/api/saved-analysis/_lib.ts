export const GAMES = new Set(["chess", "checkers"]);

export const SAVED_ANALYSIS_COLUMNS =
  "game_id, fen, eval_data, eval_depth, advantage_data, advantage_depth, simulation_data, orthodoxy_data, orthodoxy_depth, difficulty_data, difficulty_depth, eval_think_time, advantage_think_time, sharpness_think_time, simplicity_think_time, simulation_think_time, difficulty_think_time, updated_at";

export const MAX_FEN_LENGTH = 300;
export const MAX_FIELD_CHARS = 400_000;

export type SavedAnalysisRow = {
  game_id: string;
  fen: string;
  eval_data?: string | null;
  eval_depth?: number | null;
  advantage_data?: string | null;
  advantage_depth?: number | null;
  simulation_data?: string | null;
  orthodoxy_data?: string | null;
  orthodoxy_depth?: number | null;
  difficulty_data?: string | null;
  difficulty_depth?: number | null;
  eval_think_time?: number | null;
  advantage_think_time?: number | null;
  sharpness_think_time?: number | null;
  simplicity_think_time?: number | null;
  simulation_think_time?: number | null;
  difficulty_think_time?: number | null;
  updated_at?: string | null;
};

export function asInt(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return fallback;
}

export function asNum(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function asText(value: unknown, max = MAX_FIELD_CHARS): string {
  if (typeof value !== "string") return "";
  if (value.length > max) return "";
  return value;
}

/** Same rule as GameController._shouldPersistEngineAnalysis. */
export function shouldPersistEngineAnalysis(opts: {
  ranThisSession: boolean;
  currentDepth: number;
  savedDepth: number;
  hasExistingSavedData: boolean;
}): boolean {
  if (!opts.ranThisSession) return false;
  if (!opts.hasExistingSavedData) return opts.currentDepth > 0;
  return opts.currentDepth > opts.savedDepth;
}

export function hasSavedEvalData(row: SavedAnalysisRow | null): boolean {
  if (!row) return false;
  return asInt(row.eval_depth) > 0 || Boolean((row.eval_data || "").trim());
}

export function hasSavedAdvantageData(row: SavedAnalysisRow | null): boolean {
  return asInt(row?.advantage_depth) > 0;
}

export function hasSavedOrthodoxyData(row: SavedAnalysisRow | null): boolean {
  if (!row) return false;
  return asInt(row.orthodoxy_depth) > 0 || Boolean((row.orthodoxy_data || "").trim());
}

export function hasSavedDifficultyData(row: SavedAnalysisRow | null): boolean {
  if (!row) return false;
  return asInt(row.difficulty_depth) > 0 || Boolean((row.difficulty_data || "").trim());
}

export function sharpnessTableDepthScore(secondary: number, primary: number): number {
  return secondary + primary;
}

export function sharpnessFromAdvantageData(data: string): {
  secondary: number;
  primary: number;
  score: number;
} {
  if (!data.trim()) return { secondary: 0, primary: 0, score: 0 };
  try {
    const parsed = JSON.parse(data) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { secondary: 0, primary: 0, score: 0 };
    }
    const rec = parsed as Record<string, unknown>;
    const secondary = asInt(rec.sharp_table_secondary);
    const primary = asInt(rec.sharp_table_primary);
    return {
      secondary,
      primary,
      score: sharpnessTableDepthScore(secondary, primary),
    };
  } catch {
    return { secondary: 0, primary: 0, score: 0 };
  }
}

/** Monte Carlo games, matching GameController._totalSimulationGames. */
export function simulationGames(data: string): number {
  if (!data.trim()) return 0;
  try {
    const parsed = JSON.parse(data) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return 0;
    let total = 0;
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const rec = value as Record<string, unknown>;
      const w = asInt(rec.w, 1);
      const l = asInt(rec.l, 1);
      const d = asInt(rec.d, 1);
      total += Math.max(0, w - 1) + Math.max(0, l - 1) + Math.max(0, d - 1);
    }
    return total;
  } catch {
    return 0;
  }
}

export function publicSavedAnalysis(row: SavedAnalysisRow) {
  return {
    gameId: row.game_id,
    fen: row.fen,
    evalData: row.eval_data || "",
    evalDepth: asInt(row.eval_depth),
    advantageData: row.advantage_data || "",
    advantageDepth: asInt(row.advantage_depth),
    simulationData: row.simulation_data || "",
    orthodoxyData: row.orthodoxy_data || "",
    orthodoxyDepth: asInt(row.orthodoxy_depth),
    difficultyData: row.difficulty_data || "",
    difficultyDepth: asInt(row.difficulty_depth),
    evalThinkTime: asNum(row.eval_think_time),
    advantageThinkTime: asNum(row.advantage_think_time),
    sharpnessThinkTime: asNum(row.sharpness_think_time),
    simplicityThinkTime: asNum(row.simplicity_think_time),
    simulationThinkTime: asNum(row.simulation_think_time),
    difficultyThinkTime: asNum(row.difficulty_think_time),
  };
}
