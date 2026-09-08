import { json, requireSecret, type Env } from "../auth/_lib";
import {
  parseGameParam,
  parseMetricParam,
  parsePeriodParam,
  readLeaderboard,
} from "./_lib";

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Leaderboard is unavailable." }, 503);
  }
  const url = new URL(context.request.url);
  const game = parseGameParam(url.searchParams.get("game") ?? url.searchParams.get("app"));
  const period = parsePeriodParam(url.searchParams.get("period"));
  const metric = parseMetricParam(url.searchParams.get("metric"));
  if (!game || !period) {
    return json(
      context.request,
      { error: "Choose a valid game (chess, checkers, or all) and period." },
      400,
    );
  }
  return readLeaderboard(context.env, context.request, game, period, metric);
}
