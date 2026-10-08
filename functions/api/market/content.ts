import { json, requireSecret, userFromRequest, type Env } from "../auth/_lib";
import { errorJson, isAdminEmail } from "../gold/_lib";
import { listingJson, type ListingRow } from "./_lib";

/** Download an owned listing's content (buyers, the seller, and admins). */
export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!requireSecret(env) || !env.ASCENT_FILES) {
    return errorJson(request, "The Marketplace is unavailable.", 503);
  }
  const user = await userFromRequest(env, request);
  if (!user) return errorJson(request, "Sign in to download.", 401);
  const listingId = (new URL(request.url).searchParams.get("listingId") || "").trim();
  const listing = await env.ASCENT_DB.prepare(
    `SELECT l.*,
            (SELECT 1 FROM market_purchases p
             WHERE p.listing_id = l.id AND p.buyer_id = ? AND p.refunded_at IS NULL) AS owned
     FROM market_listings l WHERE l.id = ?`,
  )
    .bind(user.id, listingId)
    .first<ListingRow>();
  if (!listing) return errorJson(request, "Listing not found.", 404);

  const admin = isAdminEmail(user.email);
  const allowed = admin || listing.seller_id === user.id || Boolean(listing.owned);
  if (!allowed) return errorJson(request, "Buy this listing to download it.", 403);
  if (listing.status === "taken_down" && !admin) {
    return errorJson(request, "This listing was taken down.", 410);
  }
  const object = await env.ASCENT_FILES.get(listing.content_key);
  if (!object) return errorJson(request, "Listing content is missing.", 404);
  const content = await object.json<Record<string, unknown>>();
  return json(request, { listing: listingJson(listing, user.id), content });
}
