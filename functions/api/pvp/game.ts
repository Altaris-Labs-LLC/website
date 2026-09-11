import {
  asInt,
  asText,
  ensurePvpSchema,
  finishGame,
  gamePayload,
  json,
  loadGame,
  nowIso,
  parseMoves,
  readJson,
  reconcileGame,
  requireSecret,
  resolvePlayer,
  sideToMove,
  type Env,
  type GameRow,
} from "./_lib";

type GameBody = {
  action?: unknown;
  gameId?: unknown;
  guestId?: unknown;
  displayName?: unknown;
  move?: unknown;
  expectedMoveCount?: unknown;
};

function sideOf(game: GameRow, playerKey: string): 0 | 1 | null {
  if (game.white_player_key === playerKey) return 0;
  if (game.black_player_key === playerKey) return 1;
  return null;
}

async function touch(env: Env, gameId: string, side: 0 | 1, when: string) {
  const col = side === 0 ? "white_last_seen" : "black_last_seen";
  await env.ASCENT_DB.prepare(
    `UPDATE pvp_games SET ${col} = ? WHERE id = ? AND status = 'active'`,
  )
    .bind(when, gameId)
    .run();
}

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "PvP unavailable." }, 503);
  }
  await ensurePvpSchema(context.env);
  const url = new URL(context.request.url);
  const gameId = asText(url.searchParams.get("gameId"), 80);
  if (!gameId) {
    return json(context.request, { error: "gameId required." }, 400);
  }
  const player = await resolvePlayer(context.env, context.request, {
    guestId: url.searchParams.get("guestId"),
    displayName: url.searchParams.get("displayName"),
  });
  if (player instanceof Response) return player;

  let game = await loadGame(context.env, gameId);
  if (!game) return json(context.request, { error: "Game not found." }, 404);
  const side = sideOf(game, player.playerKey);
  if (side == null) {
    return json(context.request, { error: "Not a participant." }, 403);
  }
  const now = nowIso();
  await touch(context.env, game.id, side, now);
  game = (await loadGame(context.env, gameId)) ?? game;
  game = await reconcileGame(context.env, game);
  return json(context.request, gamePayload(game, player.playerKey));
}

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "PvP unavailable." }, 503);
  }
  await ensurePvpSchema(context.env);
  const body = (await readJson<GameBody>(context.request)) ?? {};
  const action = asText(body.action, 32).toLowerCase() || "heartbeat";
  const gameId = asText(body.gameId, 80);
  if (!gameId) {
    return json(context.request, { error: "gameId required." }, 400);
  }
  const player = await resolvePlayer(context.env, context.request, body);
  if (player instanceof Response) return player;

  let game = await loadGame(context.env, gameId);
  if (!game) return json(context.request, { error: "Game not found." }, 404);
  const side = sideOf(game, player.playerKey);
  if (side == null) {
    return json(context.request, { error: "Not a participant." }, 403);
  }

  const nowMs = Date.now();
  const now = nowIso(nowMs);
  await touch(context.env, game.id, side, now);
  game = (await loadGame(context.env, gameId)) ?? game;
  game = await reconcileGame(context.env, game);

  if (action === "heartbeat") {
    return json(context.request, gamePayload(game, player.playerKey));
  }
  if (game.status !== "active") {
    return json(context.request, gamePayload(game, player.playerKey));
  }
  if (action === "resign") {
    game = await finishGame(context.env, game, {
      result: side === 0 ? "0-1" : "1-0",
      resultReason: "resign",
      winnerSide: side === 0 ? 1 : 0,
    });
    return json(context.request, gamePayload(game, player.playerKey));
  }
  if (action === "move") {
    const move = asText(body.move, 32).toLowerCase();
    if (!move) {
      return json(context.request, { error: "move required." }, 400);
    }
    const moves = parseMoves(game.moves_json);
    const expected = asInt(body.expectedMoveCount, moves.length);
    if (expected !== moves.length) {
      return json(
        context.request,
        {
          error: "Stale move.",
          code: "stale",
          game: gamePayload(game, player.playerKey),
        },
        409,
      );
    }
    if (sideToMove(moves.length) !== side) {
      return json(context.request, { error: "Not your turn." }, 409);
    }

    const started = Date.parse(game.turn_started_at);
    const elapsed = Number.isFinite(started)
      ? Math.max(0, nowMs - started)
      : 0;
    let whiteClock = game.white_clock_ms;
    let blackClock = game.black_clock_ms;
    if (side === 0) {
      whiteClock = Math.max(0, whiteClock - elapsed);
      if (whiteClock <= 0) {
        game = await finishGame(context.env, game, {
          result: "0-1",
          resultReason: "timeout",
          winnerSide: 1,
        });
        return json(context.request, gamePayload(game, player.playerKey));
      }
      if (game.tc_bonus_type === "Bonus") {
        whiteClock += game.tc_bonus_seconds * 1000;
      }
    } else {
      blackClock = Math.max(0, blackClock - elapsed);
      if (blackClock <= 0) {
        game = await finishGame(context.env, game, {
          result: "1-0",
          resultReason: "timeout",
          winnerSide: 0,
        });
        return json(context.request, gamePayload(game, player.playerKey));
      }
      if (game.tc_bonus_type === "Bonus") {
        blackClock += game.tc_bonus_seconds * 1000;
      }
    }

    moves.push(move);
    await context.env.ASCENT_DB.prepare(
      `UPDATE pvp_games
       SET moves_json = ?,
           white_clock_ms = ?,
           black_clock_ms = ?,
           turn_started_at = ?,
           white_last_seen = CASE WHEN ? = 0 THEN ? ELSE white_last_seen END,
           black_last_seen = CASE WHEN ? = 1 THEN ? ELSE black_last_seen END
       WHERE id = ? AND status = 'active'`,
    )
      .bind(
        JSON.stringify(moves),
        whiteClock,
        blackClock,
        now,
        side,
        now,
        side,
        now,
        game.id,
      )
      .run();
    game = (await loadGame(context.env, gameId)) ?? game;
    return json(context.request, gamePayload(game, player.playerKey));
  }

  return json(context.request, { error: "Unknown action." }, 400);
}
