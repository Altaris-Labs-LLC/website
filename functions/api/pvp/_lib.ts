import {
  json,
  readJson,
  requireSecret,
  userFromRequest,
  type Env,
} from "../auth/_lib";

export { json, readJson, requireSecret };
export type { Env };

export const GAMES = new Set(["chess", "checkers"]);
export const SEEK_TTL_MS = 20_000;
export const DISCONNECT_FORFEIT_MS = 45_000;
export const ELO_MATCH_WINDOW = 200;
export const FREE_PVP_PER_DAY = 1;

export type PlayerIdentity = {
  playerKey: string;
  userId: string | null;
  guestId: string | null;
  displayName: string;
  isPremium: boolean;
};

export type SeekRow = {
  id: string;
  player_key: string;
  user_id: string | null;
  guest_id: string | null;
  display_name: string;
  game_id: string;
  tc_key: string;
  tc_base_seconds: number;
  tc_bonus_type: string;
  tc_bonus_seconds: number;
  elo: number;
  is_premium: number;
  status: string;
  matched_game_id: string | null;
  created_at: string;
  expires_at: string;
};

export type GameRow = {
  id: string;
  game_id: string;
  tc_key: string;
  tc_base_seconds: number;
  tc_bonus_type: string;
  tc_bonus_seconds: number;
  white_player_key: string;
  black_player_key: string;
  white_user_id: string | null;
  black_user_id: string | null;
  white_display_name: string;
  black_display_name: string;
  white_elo: number;
  black_elo: number;
  white_clock_ms: number;
  black_clock_ms: number;
  moves_json: string;
  status: string;
  result: string | null;
  result_reason: string | null;
  winner_side: number | null;
  turn_started_at: string;
  white_last_seen: string;
  black_last_seen: string;
  created_at: string;
  finished_at: string | null;
};

let schemaReady: Promise<void> | null = null;

export async function ensurePvpSchema(env: Env): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await env.ASCENT_DB.batch([
        env.ASCENT_DB.prepare(`CREATE TABLE IF NOT EXISTS pvp_seeks (
          id TEXT PRIMARY KEY,
          player_key TEXT NOT NULL,
          user_id TEXT,
          guest_id TEXT,
          display_name TEXT NOT NULL,
          game_id TEXT NOT NULL,
          tc_key TEXT NOT NULL,
          tc_base_seconds INTEGER NOT NULL,
          tc_bonus_type TEXT NOT NULL,
          tc_bonus_seconds INTEGER NOT NULL,
          elo INTEGER NOT NULL,
          is_premium INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'seeking',
          matched_game_id TEXT,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        )`),
        env.ASCENT_DB.prepare(
          `CREATE INDEX IF NOT EXISTS idx_pvp_seeks_match
           ON pvp_seeks(game_id, tc_key, status, elo, created_at)`,
        ),
        env.ASCENT_DB.prepare(`CREATE TABLE IF NOT EXISTS pvp_games (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          tc_key TEXT NOT NULL,
          tc_base_seconds INTEGER NOT NULL,
          tc_bonus_type TEXT NOT NULL,
          tc_bonus_seconds INTEGER NOT NULL,
          white_player_key TEXT NOT NULL,
          black_player_key TEXT NOT NULL,
          white_user_id TEXT,
          black_user_id TEXT,
          white_display_name TEXT NOT NULL,
          black_display_name TEXT NOT NULL,
          white_elo INTEGER NOT NULL,
          black_elo INTEGER NOT NULL,
          white_clock_ms INTEGER NOT NULL,
          black_clock_ms INTEGER NOT NULL,
          moves_json TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'active',
          result TEXT,
          result_reason TEXT,
          winner_side INTEGER,
          turn_started_at TEXT NOT NULL,
          white_last_seen TEXT NOT NULL,
          black_last_seen TEXT NOT NULL,
          created_at TEXT NOT NULL,
          finished_at TEXT
        )`),
        env.ASCENT_DB.prepare(
          `CREATE INDEX IF NOT EXISTS idx_pvp_games_status
           ON pvp_games(status, turn_started_at)`,
        ),
        env.ASCENT_DB.prepare(`CREATE TABLE IF NOT EXISTS pvp_daily_usage (
          player_key TEXT NOT NULL,
          game_id TEXT NOT NULL,
          day_key TEXT NOT NULL,
          count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (player_key, game_id, day_key)
        )`),
      ]);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function nowIso(ms = Date.now()): string {
  return new Date(ms).toISOString();
}

export function asInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return fallback;
}

export function asText(value: unknown, max = 80): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function parseGameId(value: unknown): string | null {
  const game = asText(value, 32).toLowerCase();
  return GAMES.has(game) ? game : null;
}

export function timeControlKey(parts: {
  baseSeconds: number;
  bonusType: string;
  bonusSeconds: number;
}): string {
  return `${parts.baseSeconds}:${parts.bonusType}:${parts.bonusSeconds}`;
}

function nthWeekdayUtc(
  year: number,
  monthIndex: number,
  weekday: number,
  n: number,
): number {
  const first = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

function pacificOffsetMinutes(now: Date): number {
  const y = now.getUTCFullYear();
  const dstStart = Date.UTC(y, 2, nthWeekdayUtc(y, 2, 0, 2), 10, 0, 0);
  const dstEnd = Date.UTC(y, 10, nthWeekdayUtc(y, 10, 0, 1), 9, 0, 0);
  const t = now.getTime();
  return t >= dstStart && t < dstEnd ? -7 * 60 : -8 * 60;
}

export function pacificDayKey(now = new Date()): string {
  const pacific = new Date(now.getTime() + pacificOffsetMinutes(now) * 60_000);
  const y = pacific.getUTCFullYear();
  const m = String(pacific.getUTCMonth() + 1).padStart(2, "0");
  const d = String(pacific.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function resolvePlayer(
  env: Env,
  request: Request,
  body: { guestId?: unknown; displayName?: unknown },
): Promise<PlayerIdentity | Response> {
  const user = await userFromRequest(env, request);
  if (user) {
    return {
      playerKey: `user:${user.id}`,
      userId: user.id,
      guestId: null,
      displayName: (user.displayName || "Player").slice(0, 80),
      isPremium: Boolean(user.subscription?.isPremium),
    };
  }
  const guestId = asText(body.guestId, 64);
  if (!guestId || guestId.length < 8) {
    return json(
      request,
      { error: "guestId is required when not signed in." },
      400,
    );
  }
  return {
    playerKey: `guest:${guestId}`,
    userId: null,
    guestId,
    displayName: asText(body.displayName, 80) || "anonymous",
    isPremium: false,
  };
}

export async function getDailyUsage(
  env: Env,
  playerKey: string,
  gameId: string,
  dayKey = pacificDayKey(),
): Promise<number> {
  const row = await env.ASCENT_DB.prepare(
    `SELECT count AS count FROM pvp_daily_usage
     WHERE player_key = ? AND game_id = ? AND day_key = ?`,
  )
    .bind(playerKey, gameId, dayKey)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function incrementDailyUsage(
  env: Env,
  playerKey: string,
  gameId: string,
  dayKey = pacificDayKey(),
): Promise<number> {
  await env.ASCENT_DB.prepare(
    `INSERT INTO pvp_daily_usage (player_key, game_id, day_key, count)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(player_key, game_id, day_key)
     DO UPDATE SET count = count + 1`,
  )
    .bind(playerKey, gameId, dayKey)
    .run();
  return getDailyUsage(env, playerKey, gameId, dayKey);
}

export async function assertCanSeek(
  env: Env,
  request: Request,
  player: PlayerIdentity,
  gameId: string,
): Promise<Response | null> {
  if (player.isPremium) return null;
  const used = await getDailyUsage(env, player.playerKey, gameId);
  if (used >= FREE_PVP_PER_DAY) {
    return json(
      request,
      {
        error: "Daily human-opponent limit reached.",
        code: "pvp_daily_limit",
        used,
        limit: FREE_PVP_PER_DAY,
        premium: false,
      },
      403,
    );
  }
  return null;
}

export function parseMoves(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((m) => String(m));
  } catch {
    return [];
  }
}

export function sideToMove(moveCount: number): 0 | 1 {
  return (moveCount % 2 === 0 ? 0 : 1) as 0 | 1;
}

export function clocksWithElapsed(
  game: GameRow,
  nowMs = Date.now(),
): { whiteClockMs: number; blackClockMs: number } {
  if (game.status !== "active") {
    return {
      whiteClockMs: game.white_clock_ms,
      blackClockMs: game.black_clock_ms,
    };
  }
  const stm = sideToMove(parseMoves(game.moves_json).length);
  const started = Date.parse(game.turn_started_at);
  const elapsed = Number.isFinite(started) ? Math.max(0, nowMs - started) : 0;
  let white = game.white_clock_ms;
  let black = game.black_clock_ms;
  if (stm === 0) white = Math.max(0, white - elapsed);
  else black = Math.max(0, black - elapsed);
  return { whiteClockMs: white, blackClockMs: black };
}

export async function finishGame(
  env: Env,
  game: GameRow,
  opts: {
    result: string;
    resultReason: string;
    winnerSide: number | null;
  },
): Promise<GameRow> {
  const finishedAt = nowIso();
  const clocks = clocksWithElapsed(game);
  await env.ASCENT_DB.prepare(
    `UPDATE pvp_games
     SET status = 'finished',
         result = ?,
         result_reason = ?,
         winner_side = ?,
         white_clock_ms = ?,
         black_clock_ms = ?,
         finished_at = ?
     WHERE id = ? AND status = 'active'`,
  )
    .bind(
      opts.result,
      opts.resultReason,
      opts.winnerSide,
      clocks.whiteClockMs,
      clocks.blackClockMs,
      finishedAt,
      game.id,
    )
    .run();
  return (
    (await env.ASCENT_DB.prepare(`SELECT * FROM pvp_games WHERE id = ?`)
      .bind(game.id)
      .first<GameRow>()) ?? {
      ...game,
      status: "finished",
      result: opts.result,
      result_reason: opts.resultReason,
      winner_side: opts.winnerSide,
      finished_at: finishedAt,
    }
  );
}

export async function loadGame(
  env: Env,
  gameId: string,
): Promise<GameRow | null> {
  return (
    (await env.ASCENT_DB.prepare(`SELECT * FROM pvp_games WHERE id = ?`)
      .bind(gameId)
      .first<GameRow>()) ?? null
  );
}

export async function reconcileGame(
  env: Env,
  game: GameRow,
  nowMs = Date.now(),
): Promise<GameRow> {
  if (game.status !== "active") return game;

  const clocks = clocksWithElapsed(game, nowMs);
  if (clocks.whiteClockMs <= 0 || clocks.blackClockMs <= 0) {
    const whiteFlagged = clocks.whiteClockMs <= 0;
    return finishGame(env, game, {
      result: whiteFlagged ? "0-1" : "1-0",
      resultReason: "timeout",
      winnerSide: whiteFlagged ? 1 : 0,
    });
  }

  const stm = sideToMove(parseMoves(game.moves_json).length);
  const stmSeen = Date.parse(
    stm === 0 ? game.white_last_seen : game.black_last_seen,
  );
  if (Number.isFinite(stmSeen) && nowMs - stmSeen > DISCONNECT_FORFEIT_MS) {
    return finishGame(env, game, {
      result: stm === 0 ? "0-1" : "1-0",
      resultReason: "disconnect",
      winnerSide: stm === 0 ? 1 : 0,
    });
  }

  for (const side of [0, 1] as const) {
    const seen = Date.parse(
      side === 0 ? game.white_last_seen : game.black_last_seen,
    );
    if (Number.isFinite(seen) && nowMs - seen > DISCONNECT_FORFEIT_MS * 2) {
      return finishGame(env, game, {
        result: side === 0 ? "0-1" : "1-0",
        resultReason: "disconnect",
        winnerSide: side === 0 ? 1 : 0,
      });
    }
  }

  return game;
}

export function gamePayload(game: GameRow, viewerKey: string) {
  const moves = parseMoves(game.moves_json);
  const clocks = clocksWithElapsed(game);
  const mySide =
    game.white_player_key === viewerKey
      ? 0
      : game.black_player_key === viewerKey
        ? 1
        : null;
  return {
    gameId: game.id,
    appGameId: game.game_id,
    status: game.status,
    result: game.result,
    resultReason: game.result_reason,
    winnerSide: game.winner_side,
    moves,
    moveCount: moves.length,
    sideToMove: sideToMove(moves.length),
    mySide,
    white: {
      displayName: game.white_display_name,
      elo: game.white_elo,
      clockMs: clocks.whiteClockMs,
    },
    black: {
      displayName: game.black_display_name,
      elo: game.black_elo,
      clockMs: clocks.blackClockMs,
    },
    timeControl: {
      key: game.tc_key,
      baseSeconds: game.tc_base_seconds,
      bonusType: game.tc_bonus_type,
      bonusSeconds: game.tc_bonus_seconds,
    },
    turnStartedAt: game.turn_started_at,
    finishedAt: game.finished_at,
  };
}
