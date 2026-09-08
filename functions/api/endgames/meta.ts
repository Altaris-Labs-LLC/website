import { json, requireSecret, type Env } from "../auth/_lib";
import {
  GAMES,
  normalizeGameId,
  readCumulativeAdjustment,
} from "./_lib";

/** Lightweight meta: cumulative |difficulty| adjustment for the endgame table. */
export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Endgames API unavailable." }, 503);
  }

  const url = new URL(context.request.url);
  const gameId = normalizeGameId(url.searchParams.get("gameId"));
  if (!GAMES.has(gameId)) {
    return json(context.request, { error: "Invalid gameId." }, 400);
  }

  const cumulativeAdjustment = await readCumulativeAdjustment(
    context.env.ASCENT_DB,
    gameId,
  );

  return json(context.request, {
    gameId,
    cumulativeAdjustment,
    serverTime: new Date().toISOString(),
  });
}
