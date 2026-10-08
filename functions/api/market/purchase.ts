import { json, readJson, requireSecret, userFromRequest, type Env } from "../auth/_lib";
import {
  ensureWalletStmt,
  errorJson,
  ledgerStmt,
  nowIso,
  readWallet,
  sellerProceeds,
  walletJson,
} from "../gold/_lib";
import { isUniqueViolation, listingJson, SELLER_PREMIUM_SQL, type ListingRow } from "./_lib";

/**
 * Buys (or claims, if free) a listing with Gold. Purchased Gold is spent
 * first so earned Gold stays cashable. The seller is credited 50%.
 */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!requireSecret(env)) return errorJson(request, "The Marketplace is unavailable.", 503);
  const user = await userFromRequest(env, request);
  if (!user) return errorJson(request, "Sign in to buy.", 401);

  const body = await readJson<{ listingId?: unknown }>(request);
  const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
  const db = env.ASCENT_DB;
  const now = nowIso();
  const listing = await db
    .prepare(
      `SELECT l.*,
              (SELECT 1 FROM market_purchases p WHERE p.listing_id = l.id AND p.buyer_id = ?) AS owned
       FROM market_listings l
       JOIN users u ON u.id = l.seller_id
       WHERE l.id = ? AND l.status = 'live' AND ${SELLER_PREMIUM_SQL}`,
    )
    .bind(user.id, listingId, now)
    .first<ListingRow>();
  if (!listing) return errorJson(request, "This listing is no longer available.", 404);
  if (listing.seller_id === user.id) {
    return errorJson(request, "You can't buy your own listing.");
  }
  const done = async () =>
    json(request, {
      listing: listingJson({ ...listing, owned: 1 }, user.id),
      wallet: await walletJson(env, user.id),
    });
  if (listing.owned) return done();

  const price = Number(listing.price_gold) || 0;
  const purchaseId = crypto.randomUUID();

  if (price <= 0) {
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO market_purchases
              (id, listing_id, buyer_id, seller_id, price_gold, seller_gold, created_at)
             VALUES (?, ?, ?, ?, 0, 0, ?)`,
          )
          .bind(purchaseId, listing.id, user.id, listing.seller_id, now),
        db
          .prepare(`UPDATE market_listings SET sales_count = sales_count + 1 WHERE id = ?`)
          .bind(listing.id),
      ]);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    return done();
  }

  const wallet = await readWallet(db, user.id);
  if (wallet.debt > 0) {
    return errorJson(request, "Your account has a refund balance to settle first.", 402);
  }
  if (wallet.purchased + wallet.earned < price) {
    return errorJson(request, "Not enough Gold.", 402);
  }
  const fromPurchased = Math.min(wallet.purchased, price);
  const fromEarned = price - fromPurchased;
  const sellerGold = sellerProceeds(price);

  try {
    await db.batch([
      ensureWalletStmt(db, user.id, now),
      ensureWalletStmt(db, listing.seller_id, now),
      db
        .prepare(
          `UPDATE gold_wallets SET purchased = purchased - ?, earned = earned - ?, updated_at = ?
           WHERE user_id = ?`,
        )
        .bind(fromPurchased, fromEarned, now, user.id),
      db
        .prepare(
          `INSERT INTO market_purchases
            (id, listing_id, buyer_id, seller_id, price_gold, seller_gold,
             purchased_used, earned_used, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          purchaseId,
          listing.id,
          user.id,
          listing.seller_id,
          price,
          sellerGold,
          fromPurchased,
          fromEarned,
          now,
        ),
      db
        .prepare(`UPDATE gold_wallets SET earned = earned + ?, updated_at = ? WHERE user_id = ?`)
        .bind(sellerGold, now, listing.seller_id),
      db
        .prepare(
          `UPDATE market_listings
           SET sales_count = sales_count + 1, earned_gold = earned_gold + ?
           WHERE id = ?`,
        )
        .bind(sellerGold, listing.id),
      ledgerStmt(db, {
        userId: user.id,
        kind: "spend",
        purchased: -fromPurchased,
        earned: -fromEarned,
        ref: purchaseId,
        now,
      }),
      ledgerStmt(db, {
        userId: listing.seller_id,
        kind: "sale",
        earned: sellerGold,
        ref: purchaseId,
        now,
      }),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) return done();
    return errorJson(request, "Your balance changed. Please try again.", 409);
  }
  return done();
}
