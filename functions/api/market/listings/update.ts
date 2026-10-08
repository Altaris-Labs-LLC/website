import { json, readJson, requireSecret, userFromRequest, type Env } from "../../auth/_lib";
import { asInt, errorJson, MAX_PRICE_GOLD, nowIso } from "../../gold/_lib";
import { isPremium, listingJson, type ListingRow } from "../_lib";

type Body = { listingId?: unknown; priceGold?: unknown; remove?: unknown };

/** Seller changes a listing's price (0 = free) or removes it from the Marketplace. */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!requireSecret(env)) return errorJson(request, "The Marketplace is unavailable.", 503);
  const user = await userFromRequest(env, request);
  if (!user) return errorJson(request, "Sign in to manage listings.", 401);

  const body = await readJson<Body>(request);
  const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
  const db = env.ASCENT_DB;
  const listing = await db
    .prepare(`SELECT * FROM market_listings WHERE id = ? AND seller_id = ?`)
    .bind(listingId, user.id)
    .first<ListingRow>();
  if (!listing) return errorJson(request, "Listing not found.", 404);
  if (listing.status === "removed" || listing.status === "taken_down") {
    return errorJson(request, "This listing has been removed.");
  }

  const now = nowIso();
  if (body?.remove === true) {
    await db
      .prepare(`UPDATE market_listings SET status = 'removed', updated_at = ? WHERE id = ?`)
      .bind(now, listing.id)
      .run();
    return json(request, { listing: listingJson({ ...listing, status: "removed" }, user.id) });
  }

  const priceGold = asInt(body?.priceGold);
  if (priceGold == null || priceGold < 0 || priceGold > MAX_PRICE_GOLD) {
    return errorJson(request, `Price must be between 0 and ${MAX_PRICE_GOLD} Gold.`);
  }
  if (!isPremium(user)) {
    return errorJson(request, "Selling on the Marketplace requires Ascent Premium.", 403);
  }
  await db
    .prepare(`UPDATE market_listings SET price_gold = ?, updated_at = ? WHERE id = ?`)
    .bind(priceGold, now, listing.id)
    .run();
  return json(request, {
    listing: listingJson({ ...listing, price_gold: priceGold }, user.id),
  });
}
