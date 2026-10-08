import { json, requireSecret, userFromRequest, type Env } from "../auth/_lib";
import { errorJson, GAME_IDS } from "../gold/_lib";
import { listingJson, type ListingRow } from "./_lib";

/** Everything the user owns, so purchases can be re-downloaded on any device. */
export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!requireSecret(env)) return errorJson(request, "The Marketplace is unavailable.", 503);
  const user = await userFromRequest(env, request);
  if (!user) return errorJson(request, "Sign in to see your library.", 401);
  const game = (new URL(request.url).searchParams.get("game") || "").trim().toLowerCase();
  if (!GAME_IDS.has(game)) return errorJson(request, "Choose a game.");
  const rows = await env.ASCENT_DB.prepare(
    `SELECT l.*, 1 AS owned
     FROM market_purchases p
     JOIN market_listings l ON l.id = p.listing_id
     WHERE p.buyer_id = ? AND l.game_id = ? AND p.refunded_at IS NULL
       AND l.status != 'taken_down'
     ORDER BY p.created_at DESC
     LIMIT 500`,
  )
    .bind(user.id, game)
    .all<ListingRow>();
  return json(request, {
    listings: (rows.results || []).map((row) => listingJson(row, user.id)),
  });
}
