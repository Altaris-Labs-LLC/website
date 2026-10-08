import { json, readJson, requireSecret, userFromRequest, type Env } from "../../auth/_lib";
import {
  asInt,
  errorJson,
  GAME_IDS,
  MAX_PRICE_GOLD,
  notifyAdmin,
  nowIso,
} from "../../gold/_lib";
import {
  cleanContent,
  isPremium,
  KINDS,
  likeTerm,
  listingJson,
  MAX_CONTENT_BYTES,
  MAX_LISTINGS_PER_DAY,
  SELLER_PREMIUM_SQL,
  text,
  type ListingRow,
} from "../_lib";

/** Browse live listings for one game + kind. */
export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!requireSecret(env)) return errorJson(request, "The Marketplace is unavailable.", 503);
  const url = new URL(request.url);
  const game = (url.searchParams.get("game") || "").trim().toLowerCase();
  const kind = (url.searchParams.get("kind") || "").trim().toLowerCase();
  if (!GAME_IDS.has(game) || !KINDS.has(kind)) {
    return errorJson(request, "Choose a game and listing type.");
  }
  const query = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const viewer = await userFromRequest(env, request);
  const viewerId = viewer?.id || "";

  const binds: Array<string | number> = [viewerId, game, kind, nowIso(), viewerId];
  let search = "";
  if (query) {
    const term = likeTerm(query);
    search = `AND (l.title LIKE ? ESCAPE '\\' OR l.description LIKE ? ESCAPE '\\' OR l.seller_name LIKE ? ESCAPE '\\')`;
    binds.push(term, term, term);
  }
  const rows = await env.ASCENT_DB.prepare(
    `SELECT l.*,
            (SELECT 1 FROM market_purchases p WHERE p.listing_id = l.id AND p.buyer_id = ?) AS owned
     FROM market_listings l
     JOIN users u ON u.id = l.seller_id
     WHERE l.game_id = ? AND l.kind = ? AND l.status = 'live'
       AND ${SELLER_PREMIUM_SQL}
       AND l.seller_id NOT IN (SELECT blocked_user_id FROM market_blocks WHERE user_id = ?)
       ${search}
     ORDER BY l.sales_count DESC, l.created_at DESC
     LIMIT 100`,
  )
    .bind(...binds)
    .all<ListingRow>();
  return json(request, {
    listings: (rows.results || []).map((row) => listingJson(row, viewer?.id || null)),
  });
}

type CreateBody = {
  game?: unknown;
  kind?: unknown;
  title?: unknown;
  description?: unknown;
  priceGold?: unknown;
  sourceName?: unknown;
  content?: unknown;
};

/** Upload a new listing. It goes live after review. Selling requires Premium. */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!requireSecret(env)) return errorJson(request, "The Marketplace is unavailable.", 503);
  if (!env.ASCENT_FILES) return errorJson(request, "Listing uploads are unavailable.", 503);
  const user = await userFromRequest(env, request);
  if (!user) return errorJson(request, "Sign in to sell.", 401);
  if (!isPremium(user)) {
    return errorJson(request, "Selling on the Marketplace requires Ascent Premium.", 403);
  }

  const body = await readJson<CreateBody>(request);
  const game = text(body?.game, 20).toLowerCase();
  const kind = text(body?.kind, 20).toLowerCase();
  const title = text(body?.title, 80);
  const description = text(body?.description, 2000);
  const priceGold = asInt(body?.priceGold);
  if (!GAME_IDS.has(game) || !KINDS.has(kind)) return errorJson(request, "Choose what to sell.");
  if (!title) return errorJson(request, "Give your listing a title.");
  if (priceGold == null || priceGold < 0 || priceGold > MAX_PRICE_GOLD) {
    return errorJson(request, `Price must be between 0 and ${MAX_PRICE_GOLD} Gold.`);
  }

  const db = env.ASCENT_DB;
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const recent = await db
    .prepare(`SELECT COUNT(*) AS n FROM market_listings WHERE seller_id = ? AND created_at > ?`)
    .bind(user.id, since)
    .first<{ n: number }>();
  if ((Number(recent?.n) || 0) >= MAX_LISTINGS_PER_DAY) {
    return errorJson(request, "You have reached today's listing limit. Try again tomorrow.", 429);
  }

  const cleaned = await cleanContent(kind, body?.content);
  if ("error" in cleaned) return errorJson(request, cleaned.error);
  const payload = JSON.stringify(cleaned.content);
  if (payload.length > MAX_CONTENT_BYTES) {
    return errorJson(request, "That content is too large to list.", 413);
  }

  const duplicate = await db
    .prepare(
      `SELECT seller_id FROM market_listings
       WHERE content_hash = ? AND status IN ('pending_review', 'live') LIMIT 1`,
    )
    .bind(cleaned.hash)
    .first<{ seller_id: string }>();
  if (duplicate) {
    return errorJson(
      request,
      duplicate.seller_id === user.id
        ? "You already listed this content."
        : "This content is already listed by another seller.",
      409,
    );
  }

  const id = crypto.randomUUID();
  const contentKey = `market/${id}.json`;
  await env.ASCENT_FILES.put(contentKey, payload, {
    httpMetadata: { contentType: "application/json" },
  });
  const now = nowIso();
  const row: ListingRow = {
    id,
    seller_id: user.id,
    seller_name: user.display_name,
    game_id: game,
    kind,
    title,
    description,
    price_gold: priceGold,
    item_count: cleaned.itemCount,
    source_name: text(body?.sourceName, 120) || null,
    content_key: contentKey,
    content_hash: cleaned.hash,
    content_bytes: payload.length,
    status: "pending_review",
    review_note: null,
    sales_count: 0,
    earned_gold: 0,
    created_at: now,
    updated_at: now,
  };
  await db
    .prepare(
      `INSERT INTO market_listings
        (id, seller_id, seller_name, game_id, kind, title, description, price_gold,
         item_count, source_name, content_key, content_hash, content_bytes, status,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, ?)`,
    )
    .bind(
      row.id,
      row.seller_id,
      row.seller_name,
      row.game_id,
      row.kind,
      row.title,
      row.description,
      row.price_gold,
      row.item_count,
      row.source_name,
      row.content_key,
      row.content_hash,
      row.content_bytes,
      now,
      now,
    )
    .run();
  await notifyAdmin(
    env,
    "Listing awaiting review",
    `${user.display_name} (${user.email}) listed a ${game} ${kind}: "${title}" for ${priceGold} Gold (${cleaned.itemCount} items).\nReview: https://altarislabs.dev/ascentgames/admin/marketplace`,
  );
  return json(request, { listing: listingJson(row, user.id) });
}
