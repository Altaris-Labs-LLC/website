import {
  ELO_MATCH_WINDOW,
  SEEK_TTL_MS,
  asInt,
  asText,
  assertCanSeek,
  ensurePvpSchema,
  gamePayload,
  incrementDailyUsage,
  json,
  loadGame,
  newId,
  nowIso,
  parseGameId,
  readJson,
  reconcileGame,
  requireSecret,
  resolvePlayer,
  timeControlKey,
  type Env,
  type SeekRow,
} from "./_lib";

type SeekBody = {
  action?: unknown;
  seekId?: unknown;
  gameId?: unknown;
  guestId?: unknown;
  displayName?: unknown;
  elo?: unknown;
  timeControl?: {
    key?: unknown;
    baseSeconds?: unknown;
    bonusType?: unknown;
    bonusSeconds?: unknown;
  };
};

async function expireSeeks(env: Env, now: string) {
  await env.ASCENT_DB.prepare(
    `UPDATE pvp_seeks SET status = 'expired'
     WHERE status = 'seeking' AND expires_at < ?`,
  )
    .bind(now)
    .run();
}

async function createGame(env: Env, a: SeekRow, b: SeekRow, now: string) {
  const id = newId("pvpgame");
  const aWhite = Math.random() < 0.5;
  const white = aWhite ? a : b;
  const black = aWhite ? b : a;
  const baseMs = white.tc_base_seconds * 1000;
  await env.ASCENT_DB.batch([
    env.ASCENT_DB.prepare(
      `INSERT INTO pvp_games (
        id, game_id, tc_key, tc_base_seconds, tc_bonus_type, tc_bonus_seconds,
        white_player_key, black_player_key, white_user_id, black_user_id,
        white_display_name, black_display_name, white_elo, black_elo,
        white_clock_ms, black_clock_ms, moves_json, status,
        turn_started_at, white_last_seen, black_last_seen, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'active', ?, ?, ?, ?)`,
    ).bind(
      id,
      white.game_id,
      white.tc_key,
      white.tc_base_seconds,
      white.tc_bonus_type,
      white.tc_bonus_seconds,
      white.player_key,
      black.player_key,
      white.user_id,
      black.user_id,
      white.display_name,
      black.display_name,
      white.elo,
      black.elo,
      baseMs,
      baseMs,
      now,
      now,
      now,
      now,
    ),
    env.ASCENT_DB.prepare(
      `UPDATE pvp_seeks SET status = 'matched', matched_game_id = ?
       WHERE id IN (?, ?) AND status = 'seeking'`,
    ).bind(id, a.id, b.id),
  ]);
  return id;
}

async function tryMatch(env: Env, seek: SeekRow, now: string) {
  const other = await env.ASCENT_DB.prepare(
    `SELECT * FROM pvp_seeks
     WHERE status = 'seeking'
       AND game_id = ? AND tc_key = ?
       AND id != ? AND player_key != ?
       AND ABS(elo - ?) <= ?
       AND expires_at >= ?
     ORDER BY created_at ASC LIMIT 1`,
  )
    .bind(
      seek.game_id,
      seek.tc_key,
      seek.id,
      seek.player_key,
      seek.elo,
      ELO_MATCH_WINDOW,
      now,
    )
    .first<SeekRow>();
  if (!other) return null;
  return createGame(env, seek, other, now);
}

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "PvP unavailable." }, 503);
  }
  await ensurePvpSchema(context.env);
  const seekId = asText(
    new URL(context.request.url).searchParams.get("seekId"),
    80,
  );
  if (!seekId) {
    return json(context.request, { error: "seekId required." }, 400);
  }
  const now = nowIso();
  await expireSeeks(context.env, now);
  const seek = await context.env.ASCENT_DB.prepare(
    `SELECT * FROM pvp_seeks WHERE id = ?`,
  )
    .bind(seekId)
    .first<SeekRow>();
  if (!seek) return json(context.request, { error: "Seek not found." }, 404);

  if (seek.status === "seeking" && seek.expires_at < now) {
    await context.env.ASCENT_DB.prepare(
      `UPDATE pvp_seeks SET status = 'expired' WHERE id = ? AND status = 'seeking'`,
    )
      .bind(seek.id)
      .run();
    seek.status = "expired";
  }
  if (seek.status === "seeking") {
    const matched = await tryMatch(context.env, seek, now);
    if (matched) {
      seek.status = "matched";
      seek.matched_game_id = matched;
    }
  }

  let game = null;
  if (seek.matched_game_id) {
    const row = await loadGame(context.env, seek.matched_game_id);
    if (row) {
      game = gamePayload(await reconcileGame(context.env, row), seek.player_key);
    }
  }
  return json(context.request, {
    seekId: seek.id,
    status: seek.status,
    matchedGameId: seek.matched_game_id,
    expiresAt: seek.expires_at,
    game,
  });
}

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "PvP unavailable." }, 503);
  }
  await ensurePvpSchema(context.env);
  const body = (await readJson<SeekBody>(context.request)) ?? {};
  const action = asText(body.action, 32).toLowerCase() || "seek";
  const player = await resolvePlayer(context.env, context.request, body);
  if (player instanceof Response) return player;

  const nowMs = Date.now();
  const now = nowIso(nowMs);
  await expireSeeks(context.env, now);

  if (action === "cancel") {
    const seekId = asText(body.seekId, 80);
    if (!seekId) {
      return json(context.request, { error: "seekId required." }, 400);
    }
    await context.env.ASCENT_DB.prepare(
      `UPDATE pvp_seeks SET status = 'cancelled'
       WHERE id = ? AND player_key = ? AND status = 'seeking'`,
    )
      .bind(seekId, player.playerKey)
      .run();
    return json(context.request, { ok: true, status: "cancelled" });
  }

  const gameId = parseGameId(body.gameId);
  if (!gameId) {
    return json(context.request, { error: "Invalid gameId." }, 400);
  }
  const blocked = await assertCanSeek(
    context.env,
    context.request,
    player,
    gameId,
  );
  if (blocked) return blocked;

  const tc = body.timeControl ?? {};
  const baseSeconds = asInt(tc.baseSeconds, 0);
  const bonusType = asText(tc.bonusType, 16) || "None";
  const bonusSeconds = asInt(tc.bonusSeconds, 0);
  if (baseSeconds <= 0) {
    return json(
      context.request,
      { error: "Online play requires a timed control." },
      400,
    );
  }
  if (!["None", "Bonus", "Delay"].includes(bonusType)) {
    return json(context.request, { error: "Invalid bonusType." }, 400);
  }
  const tcKey =
    asText(tc.key, 64) ||
    timeControlKey({ baseSeconds, bonusType, bonusSeconds });
  const elo = Math.max(100, Math.min(4000, asInt(body.elo, 1200)));

  await context.env.ASCENT_DB.prepare(
    `UPDATE pvp_seeks SET status = 'cancelled'
     WHERE player_key = ? AND game_id = ? AND status = 'seeking'`,
  )
    .bind(player.playerKey, gameId)
    .run();

  const seekId = newId("seek");
  const expiresAt = nowIso(nowMs + SEEK_TTL_MS);
  await context.env.ASCENT_DB.prepare(
    `INSERT INTO pvp_seeks (
      id, player_key, user_id, guest_id, display_name, game_id,
      tc_key, tc_base_seconds, tc_bonus_type, tc_bonus_seconds,
      elo, is_premium, status, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seeking', ?, ?)`,
  )
    .bind(
      seekId,
      player.playerKey,
      player.userId,
      player.guestId,
      player.displayName,
      gameId,
      tcKey,
      baseSeconds,
      bonusType,
      bonusSeconds,
      elo,
      player.isPremium ? 1 : 0,
      now,
      expiresAt,
    )
    .run();

  if (!player.isPremium) {
    await incrementDailyUsage(context.env, player.playerKey, gameId);
  }

  const seek = await context.env.ASCENT_DB.prepare(
    `SELECT * FROM pvp_seeks WHERE id = ?`,
  )
    .bind(seekId)
    .first<SeekRow>();

  let matchedGameId: string | null = null;
  if (seek) matchedGameId = await tryMatch(context.env, seek, now);

  let game = null;
  if (matchedGameId) {
    const row = await loadGame(context.env, matchedGameId);
    if (row) game = gamePayload(row, player.playerKey);
  }

  return json(context.request, {
    seekId,
    status: matchedGameId ? "matched" : "seeking",
    matchedGameId,
    expiresAt,
    game,
  });
}
