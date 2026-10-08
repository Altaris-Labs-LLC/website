import { json, readJson, requireSecret, userFromRequest, type Env } from "../auth/_lib";
import {
  asInt,
  ensureWalletStmt,
  errorJson,
  ledgerStmt,
  MIN_CASHOUT_GOLD,
  notifyAdmin,
  nowIso,
  PAYOUT_CENTS_PER_GOLD,
  walletJson,
} from "./_lib";

/** Requests a cash-out of earned Gold. An admin approves it, then Stripe pays it. */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!requireSecret(env)) return errorJson(request, "Gold is unavailable.", 503);
  const user = await userFromRequest(env, request);
  if (!user) return errorJson(request, "Sign in to cash out.", 401);

  const body = await readJson<{ gold?: unknown }>(request);
  const gold = asInt(body?.gold);
  if (gold == null || gold < MIN_CASHOUT_GOLD) {
    return errorJson(request, `The minimum cash-out is ${MIN_CASHOUT_GOLD} Gold.`);
  }

  const wallet = await walletJson(env, user.id);
  if (!wallet.payoutsReady) {
    return errorJson(request, "Finish payout setup before cashing out.");
  }
  if (wallet.debt > 0) {
    return errorJson(request, "Your account has a refund balance to settle first.");
  }
  if (gold > wallet.earned) {
    return errorJson(request, "That is more than your available earnings.");
  }
  const pending = await env.ASCENT_DB.prepare(
    `SELECT id FROM gold_cashouts WHERE user_id = ? AND status = 'pending' LIMIT 1`,
  )
    .bind(user.id)
    .first();
  if (pending) {
    return errorJson(request, "You already have a cash-out in progress.");
  }

  const now = nowIso();
  const id = crypto.randomUUID();
  const usdCents = gold * PAYOUT_CENTS_PER_GOLD;
  try {
    await env.ASCENT_DB.batch([
      ensureWalletStmt(env.ASCENT_DB, user.id, now),
      env.ASCENT_DB.prepare(
        `UPDATE gold_wallets SET earned = earned - ?, held = held + ?, updated_at = ?
         WHERE user_id = ?`,
      ).bind(gold, gold, now, user.id),
      env.ASCENT_DB.prepare(
        `INSERT INTO gold_cashouts (id, user_id, gold, usd_cents, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
      ).bind(id, user.id, gold, usdCents, now),
      ledgerStmt(env.ASCENT_DB, {
        userId: user.id,
        kind: "cashout_request",
        earned: -gold,
        held: gold,
        ref: id,
        now,
      }),
    ]);
  } catch {
    return errorJson(request, "Your balance changed. Please try again.", 409);
  }
  await notifyAdmin(
    env,
    "Cash-out request",
    `${user.display_name} (${user.email}) requested ${gold} Gold ($${(usdCents / 100).toFixed(2)}).\nCash-out id: ${id}\nReview: https://altarislabs.dev/ascentgames/admin/marketplace`,
  );
  return json(request, {
    cashout: { id, gold, usdCents, status: "pending" },
    wallet: await walletJson(env, user.id),
  });
}
