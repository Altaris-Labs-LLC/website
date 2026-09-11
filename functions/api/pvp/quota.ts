import {
  FREE_PVP_PER_DAY,
  asText,
  ensurePvpSchema,
  getDailyUsage,
  json,
  pacificDayKey,
  parseGameId,
  readJson,
  requireSecret,
  resolvePlayer,
  type Env,
} from "./_lib";

async function quotaResponse(
  env: Env,
  request: Request,
  body: { gameId?: unknown; guestId?: unknown; displayName?: unknown },
) {
  const gameId = parseGameId(body.gameId);
  if (!gameId) {
    return json(request, { error: "Invalid gameId." }, 400);
  }
  const player = await resolvePlayer(env, request, body);
  if (player instanceof Response) return player;
  const dayKey = pacificDayKey();
  const used = player.isPremium
    ? 0
    : await getDailyUsage(env, player.playerKey, gameId, dayKey);
  return json(request, {
    premium: player.isPremium,
    used,
    limit: player.isPremium ? null : FREE_PVP_PER_DAY,
    remaining: player.isPremium ? null : Math.max(0, FREE_PVP_PER_DAY - used),
    dayKey,
  });
}

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "PvP unavailable." }, 503);
  }
  await ensurePvpSchema(context.env);
  const url = new URL(context.request.url);
  return quotaResponse(context.env, context.request, {
    gameId: url.searchParams.get("gameId"),
    guestId: url.searchParams.get("guestId"),
    displayName: url.searchParams.get("displayName"),
  });
}

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "PvP unavailable." }, 503);
  }
  await ensurePvpSchema(context.env);
  const body =
    (await readJson<{
      gameId?: unknown;
      guestId?: unknown;
      displayName?: unknown;
    }>(context.request)) ?? {};
  return quotaResponse(context.env, context.request, {
    gameId: body.gameId,
    guestId: body.guestId ?? asText(undefined),
    displayName: body.displayName,
  });
}
