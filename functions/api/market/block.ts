import { json, readJson, requireSecret, userFromRequest, type Env } from "../auth/_lib";
import { errorJson, nowIso } from "../gold/_lib";

/** Block (or unblock) the seller of a listing; their listings are hidden. */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!requireSecret(env)) return errorJson(request, "The Marketplace is unavailable.", 503);
  const user = await userFromRequest(env, request);
  if (!user) return errorJson(request, "Sign in to block sellers.", 401);

  const body = await readJson<{ listingId?: unknown; unblock?: unknown }>(request);
  const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
  const db = env.ASCENT_DB;
  const listing = await db
    .prepare(`SELECT seller_id FROM market_listings WHERE id = ?`)
    .bind(listingId)
    .first<{ seller_id: string }>();
  if (!listing) return errorJson(request, "Listing not found.", 404);
  if (listing.seller_id === user.id) return errorJson(request, "You can't block yourself.");

  if (body?.unblock === true) {
    await db
      .prepare(`DELETE FROM market_blocks WHERE user_id = ? AND blocked_user_id = ?`)
      .bind(user.id, listing.seller_id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO market_blocks (user_id, blocked_user_id, created_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id, blocked_user_id) DO NOTHING`,
      )
      .bind(user.id, listing.seller_id, nowIso())
      .run();
  }
  return json(request, { ok: true, blocked: body?.unblock !== true });
}
