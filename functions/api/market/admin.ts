import { json, readJson, requireSecret, userFromRequest, type Env } from "../auth/_lib";
import { stripeFetch, StripeError } from "../subscription/_stripe";
import { errorJson, isAdminEmail, ledgerStmt, nowIso } from "../gold/_lib";
import { text } from "./_lib";

async function requireAdmin(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) return null;
  const user = await userFromRequest(context.env, context.request);
  return user && isAdminEmail(user.email) ? user : null;
}

/** Review queue: pending listings, open reports, pending cash-outs. */
export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  const admin = await requireAdmin(context);
  if (!admin) return errorJson(request, "Not authorized.", 403);
  const db = env.ASCENT_DB;

  const [listings, reports, cashouts] = await Promise.all([
    db
      .prepare(
        `SELECT l.id, l.title, l.description, l.kind, l.game_id, l.price_gold, l.item_count,
                l.content_bytes, l.seller_name, l.created_at, u.email AS seller_email
         FROM market_listings l LEFT JOIN users u ON u.id = l.seller_id
         WHERE l.status = 'pending_review'
         ORDER BY l.created_at ASC LIMIT 100`,
      )
      .all(),
    db
      .prepare(
        `SELECT r.id, r.listing_id, r.reason, r.details, r.created_at,
                l.title, l.status AS listing_status, l.seller_name,
                u.email AS reporter_email
         FROM market_reports r
         LEFT JOIN market_listings l ON l.id = r.listing_id
         LEFT JOIN users u ON u.id = r.reporter_id
         WHERE r.status = 'open'
         ORDER BY r.created_at ASC LIMIT 100`,
      )
      .all(),
    db
      .prepare(
        `SELECT c.id, c.user_id, c.gold, c.usd_cents, c.created_at,
                u.email, u.display_name, w.payout_account_id,
                (SELECT COUNT(DISTINCT p.buyer_id) FROM market_purchases p
                 WHERE p.seller_id = c.user_id AND p.price_gold > 0) AS distinct_buyers,
                (SELECT COALESCE(SUM(p.seller_gold), 0) FROM market_purchases p
                 WHERE p.seller_id = c.user_id) AS lifetime_sales_gold,
                (SELECT MAX(t.g) FROM (
                   SELECT SUM(p.seller_gold) AS g FROM market_purchases p
                   WHERE p.seller_id = c.user_id GROUP BY p.buyer_id) t) AS top_buyer_gold
         FROM gold_cashouts c
         LEFT JOIN users u ON u.id = c.user_id
         LEFT JOIN gold_wallets w ON w.user_id = c.user_id
         WHERE c.status = 'pending'
         ORDER BY c.created_at ASC LIMIT 100`,
      )
      .all(),
  ]);
  return json(request, {
    listings: listings.results || [],
    reports: reports.results || [],
    cashouts: cashouts.results || [],
  });
}

type Body = { action?: unknown; id?: unknown; note?: unknown };

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  const admin = await requireAdmin(context);
  if (!admin) return errorJson(request, "Not authorized.", 403);
  const body = await readJson<Body>(request);
  const action = text(body?.action, 40);
  const id = text(body?.id, 80);
  const note = text(body?.note, 1000) || null;
  if (!id) return errorJson(request, "Missing id.");
  const db = env.ASCENT_DB;
  const now = nowIso();

  switch (action) {
    case "approve_listing":
    case "reject_listing": {
      const status = action === "approve_listing" ? "live" : "rejected";
      const result = await db
        .prepare(
          `UPDATE market_listings SET status = ?, review_note = ?, reviewed_at = ?, updated_at = ?
           WHERE id = ? AND status = 'pending_review'`,
        )
        .bind(status, status === "live" ? null : note, now, now, id)
        .run();
      if (!result.meta?.changes) return errorJson(request, "Listing is not awaiting review.");
      return json(request, { ok: true });
    }
    case "take_down_listing": {
      await db.batch([
        db
          .prepare(
            `UPDATE market_listings SET status = 'taken_down', review_note = ?, updated_at = ?
             WHERE id = ?`,
          )
          .bind(note, now, id),
        db
          .prepare(
            `UPDATE market_reports SET status = 'resolved', resolution = 'taken_down', resolved_at = ?
             WHERE listing_id = ? AND status = 'open'`,
          )
          .bind(now, id),
      ]);
      return json(request, { ok: true });
    }
    case "dismiss_report": {
      await db
        .prepare(
          `UPDATE market_reports SET status = 'resolved', resolution = 'dismissed', resolved_at = ?
           WHERE id = ? AND status = 'open'`,
        )
        .bind(now, id)
        .run();
      return json(request, { ok: true });
    }
    case "approve_cashout":
      return approveCashout(context, id, now);
    case "reject_cashout": {
      const cashout = await db
        .prepare(`SELECT user_id, gold FROM gold_cashouts WHERE id = ? AND status = 'pending'`)
        .bind(id)
        .first<{ user_id: string; gold: number }>();
      if (!cashout) return errorJson(request, "Cash-out is not pending.");
      const claimed = await db
        .prepare(
          `UPDATE gold_cashouts SET status = 'rejected', note = ?, completed_at = ?
           WHERE id = ? AND status = 'pending'`,
        )
        .bind(note, now, id)
        .run();
      if (!claimed.meta?.changes) return errorJson(request, "Cash-out is not pending.");
      await db.batch([
        db
          .prepare(
            `UPDATE gold_wallets SET held = held - ?, earned = earned + ?, updated_at = ?
             WHERE user_id = ?`,
          )
          .bind(cashout.gold, cashout.gold, now, cashout.user_id),
        ledgerStmt(db, {
          userId: cashout.user_id,
          kind: "cashout_rejected",
          held: -cashout.gold,
          earned: cashout.gold,
          ref: id,
          now,
        }),
      ]);
      return json(request, { ok: true });
    }
    default:
      return errorJson(request, "Unknown action.");
  }
}

/** Pays an approved cash-out with a Stripe Connect transfer. */
async function approveCashout(
  context: EventContext<Env, string, unknown>,
  id: string,
  now: string,
) {
  const { request, env } = context;
  const db = env.ASCENT_DB;
  const cashout = await db
    .prepare(
      `SELECT c.user_id, c.gold, c.usd_cents, w.payout_account_id
       FROM gold_cashouts c LEFT JOIN gold_wallets w ON w.user_id = c.user_id
       WHERE c.id = ? AND c.status = 'pending'`,
    )
    .bind(id)
    .first<{ user_id: string; gold: number; usd_cents: number; payout_account_id: string | null }>();
  if (!cashout) return errorJson(request, "Cash-out is not pending.");
  if (!cashout.payout_account_id) return errorJson(request, "Seller has no payout account.");

  const claimed = await db
    .prepare(`UPDATE gold_cashouts SET status = 'processing' WHERE id = ? AND status = 'pending'`)
    .bind(id)
    .run();
  if (!claimed.meta?.changes) return errorJson(request, "Cash-out is not pending.");

  let transferId: string;
  try {
    const transfer = await stripeFetch(env, "transfers", {
      method: "POST",
      idempotencyKey: `cashout-${id}`,
      params: {
        amount: String(cashout.usd_cents),
        currency: "usd",
        destination: cashout.payout_account_id,
        description: `Ascent Marketplace cash-out (${cashout.gold} Gold)`,
        "metadata[cashoutId]": id,
        "metadata[userId]": cashout.user_id,
      },
    });
    transferId = typeof transfer.id === "string" ? transfer.id : "";
    if (!transferId) throw new StripeError("Stripe did not return a transfer.");
  } catch (error) {
    await db
      .prepare(`UPDATE gold_cashouts SET status = 'pending' WHERE id = ? AND status = 'processing'`)
      .bind(id)
      .run();
    const message = error instanceof StripeError ? error.message : "Transfer failed.";
    return errorJson(request, message, 502);
  }

  await db.batch([
    db
      .prepare(
        `UPDATE gold_cashouts SET status = 'paid', transfer_id = ?, completed_at = ?
         WHERE id = ?`,
      )
      .bind(transferId, now, id),
    db
      .prepare(`UPDATE gold_wallets SET held = held - ?, updated_at = ? WHERE user_id = ?`)
      .bind(cashout.gold, now, cashout.user_id),
    ledgerStmt(db, {
      userId: cashout.user_id,
      kind: "cashout_paid",
      held: -cashout.gold,
      ref: id,
      now,
    }),
  ]);
  return json(request, { ok: true, transferId });
}
