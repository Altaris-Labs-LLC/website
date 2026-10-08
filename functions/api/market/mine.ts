import { json, requireSecret, userFromRequest, type Env } from "../auth/_lib";
import { errorJson, GAME_IDS } from "../gold/_lib";
import { listingJson, type ListingRow } from "./_lib";

/** The seller's own listings (every status) with sales and Gold earned. */
export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!requireSecret(env)) return errorJson(request, "The Marketplace is unavailable.", 503);
  const user = await userFromRequest(env, request);
  if (!user) return errorJson(request, "Sign in to see your listings.", 401);
  const game = (new URL(request.url).searchParams.get("game") || "").trim().toLowerCase();
  const rows = GAME_IDS.has(game)
    ? await env.ASCENT_DB.prepare(
        `SELECT * FROM market_listings WHERE seller_id = ? AND game_id = ?
         ORDER BY created_at DESC LIMIT 200`,
      )
        .bind(user.id, game)
        .all<ListingRow>()
    : await env.ASCENT_DB.prepare(
        `SELECT * FROM market_listings WHERE seller_id = ?
         ORDER BY created_at DESC LIMIT 200`,
      )
        .bind(user.id)
        .all<ListingRow>();
  return json(request, {
    listings: (rows.results || []).map((row) => listingJson(row, user.id)),
  });
}
