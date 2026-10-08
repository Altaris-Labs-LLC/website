import { json, type Env } from "../auth/_lib";
import { sendFeedbackEmail } from "../feedback/_lib";
import { stripeFetch, stripeConfigured } from "../subscription/_stripe";

export type GoldPack = {
  id: string;
  gold: number;
  laurels: number;
  usdCents: number;
};

/** 1 Gold = 1 cent. Bonus Laurels are an in-game extra, not a discount. */
export const GOLD_PACKS: GoldPack[] = [
  { id: "500", gold: 500, laurels: 1000, usdCents: 500 },
  { id: "2000", gold: 2000, laurels: 5000, usdCents: 2000 },
  { id: "10000", gold: 10000, laurels: 50000, usdCents: 10000 },
];

/**
 * Sellers receive 50% of each sale's Gold; each earned Gold cashes out at 1
 * cent. 50% keeps every sale profitable after store / Stripe fees.
 */
export const SELLER_SHARE_PERCENT = 50;
export const PAYOUT_CENTS_PER_GOLD = 1;
export const MIN_CASHOUT_GOLD = 1000;
/** Sale proceeds cannot be cashed out until they are this old (refund window). */
export const CLEARING_DAYS = 14;
export const MAX_PRICE_GOLD = 100_000;

export const GAME_IDS = new Set(["chess", "checkers"]);

const ADMIN_EMAILS = new Set([
  "brentunderwood@altarislabs.dev",
  "brentwoodunderwood@gmail.com",
]);

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && ADMIN_EMAILS.has(email.trim().toLowerCase()));
}

export function sellerProceeds(priceGold: number): number {
  return Math.floor((priceGold * SELLER_SHARE_PERCENT) / 100);
}

export function packById(id: unknown): GoldPack | null {
  return GOLD_PACKS.find((pack) => pack.id === id) || null;
}

/** `chess_ascent_gold_500` → pack 500 for chess. */
export function packForProduct(
  productId: string,
): { pack: GoldPack; game: string } | null {
  const match = /^(chess|checkers)_ascent_gold_(\d+)$/.exec(productId);
  if (!match) return null;
  const pack = packById(match[2]);
  return pack ? { pack, game: match[1] } : null;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function asInt(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.trim()) : Number(value);
  return Number.isInteger(n) ? n : null;
}

export function errorJson(request: Request, message: string, status = 400) {
  return json(request, { error: message }, status);
}

export type WalletRow = {
  user_id: string;
  purchased: number;
  earned: number;
  held: number;
  debt: number;
  payout_account_id: string | null;
  payouts_ready: number;
};

export function ensureWalletStmt(db: D1Database, userId: string, now = nowIso()) {
  return db
    .prepare(
      `INSERT INTO gold_wallets (user_id, updated_at) VALUES (?, ?)
       ON CONFLICT(user_id) DO NOTHING`,
    )
    .bind(userId, now);
}

export async function readWallet(db: D1Database, userId: string): Promise<WalletRow> {
  const row = await db
    .prepare(
      `SELECT user_id, purchased, earned, held, debt, payout_account_id, payouts_ready
       FROM gold_wallets WHERE user_id = ?`,
    )
    .bind(userId)
    .first<WalletRow>();
  return (
    row || {
      user_id: userId,
      purchased: 0,
      earned: 0,
      held: 0,
      debt: 0,
      payout_account_id: null,
      payouts_ready: 0,
    }
  );
}

export function ledgerStmt(
  db: D1Database,
  input: {
    userId: string;
    kind: string;
    purchased?: number;
    earned?: number;
    held?: number;
    debt?: number;
    ref?: string | null;
    now?: string;
  },
) {
  return db
    .prepare(
      `INSERT INTO gold_ledger
        (id, user_id, kind, purchased_delta, earned_delta, held_delta, debt_delta, ref, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.userId,
      input.kind,
      input.purchased ?? 0,
      input.earned ?? 0,
      input.held ?? 0,
      input.debt ?? 0,
      input.ref ?? null,
      input.now ?? nowIso(),
    );
}

/** Seller proceeds from the last [CLEARING_DAYS] days (not yet cashable). */
async function clearingGold(db: D1Database, userId: string): Promise<number> {
  const since = new Date(Date.now() - CLEARING_DAYS * 86_400_000).toISOString();
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(seller_gold), 0) AS gold
       FROM market_purchases
       WHERE seller_id = ? AND created_at > ? AND refunded_at IS NULL`,
    )
    .bind(userId, since)
    .first<{ gold: number }>();
  return Number(row?.gold) || 0;
}

/** Re-checks Stripe Connect onboarding until payouts are enabled. */
async function refreshPayoutsReady(env: Env, wallet: WalletRow): Promise<boolean> {
  if (wallet.payouts_ready) return true;
  if (!wallet.payout_account_id || !stripeConfigured(env)) return false;
  try {
    const account = await stripeFetch(
      env,
      `accounts/${encodeURIComponent(wallet.payout_account_id)}`,
    );
    const capabilities = account.capabilities as Record<string, unknown> | undefined;
    const ready =
      account.payouts_enabled === true && capabilities?.transfers === "active";
    if (ready) {
      await env.ASCENT_DB.prepare(
        `UPDATE gold_wallets SET payouts_ready = 1, updated_at = ? WHERE user_id = ?`,
      )
        .bind(nowIso(), wallet.user_id)
        .run();
    }
    return ready;
  } catch {
    return false;
  }
}

export async function walletJson(env: Env, userId: string) {
  const db = env.ASCENT_DB;
  const wallet = await readWallet(db, userId);
  const [clearing, laurels, payoutsReady] = await Promise.all([
    clearingGold(db, userId),
    db
      .prepare(
        `SELECT COALESCE(SUM(laurels), 0) AS laurels
         FROM gold_laurel_grants WHERE user_id = ? AND claimed_at IS NULL`,
      )
      .bind(userId)
      .first<{ laurels: number }>(),
    refreshPayoutsReady(env, wallet),
  ]);
  const cashable = Math.max(0, wallet.earned - clearing);
  return {
    balance: wallet.purchased + wallet.earned,
    purchased: wallet.purchased,
    earned: cashable,
    clearing: Math.min(wallet.earned, clearing),
    earnedTotal: wallet.earned,
    pendingCashOut: wallet.held,
    debt: wallet.debt,
    payoutsReady,
    payoutAccount: Boolean(wallet.payout_account_id),
    unclaimedLaurels: Number(laurels?.laurels) || 0,
    minCashOutGold: MIN_CASHOUT_GOLD,
    payoutCentsPerGold: PAYOUT_CENTS_PER_GOLD,
    sellerSharePercent: SELLER_SHARE_PERCENT,
    clearingDays: CLEARING_DAYS,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return /UNIQUE constraint failed/i.test(String((error as Error)?.message || error));
}

/**
 * Credits a verified Gold pack once. Returns the account that owns the
 * purchase, which differs from [userId] if the receipt was already used.
 */
export async function creditPack(
  env: Env,
  input: {
    userId: string;
    platform: string;
    productId: string;
    pack: GoldPack;
    purchaseKey: string;
    paymentRef?: string | null;
    test?: boolean;
  },
): Promise<{ credited: boolean; ownerId: string }> {
  const db = env.ASCENT_DB;
  const existing = await db
    .prepare(
      `SELECT user_id FROM gold_store_purchases WHERE platform = ? AND purchase_key = ?`,
    )
    .bind(input.platform, input.purchaseKey)
    .first<{ user_id: string }>();
  if (existing) return { credited: false, ownerId: existing.user_id };

  const wallet = await readWallet(db, input.userId);
  const payoff = Math.min(wallet.debt, input.pack.gold);
  const now = nowIso();
  const purchaseId = crypto.randomUUID();
  try {
    await db.batch([
      ensureWalletStmt(db, input.userId, now),
      db
        .prepare(
          `INSERT INTO gold_store_purchases
            (id, user_id, platform, product_id, pack_id, purchase_key, payment_ref,
             gold, laurels, usd_cents, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          purchaseId,
          input.userId,
          input.platform,
          input.productId,
          input.pack.id,
          input.purchaseKey,
          input.paymentRef ?? null,
          input.pack.gold,
          input.pack.laurels,
          input.pack.usdCents,
          input.test ? "credited_test" : "credited",
          now,
        ),
      db
        .prepare(
          `UPDATE gold_wallets
           SET purchased = purchased + ?, debt = debt - ?, updated_at = ?
           WHERE user_id = ?`,
        )
        .bind(input.pack.gold - payoff, payoff, now, input.userId),
      ledgerStmt(db, {
        userId: input.userId,
        kind: `buy_${input.platform}`,
        purchased: input.pack.gold - payoff,
        debt: -payoff,
        ref: purchaseId,
        now,
      }),
      db
        .prepare(
          `INSERT INTO gold_laurel_grants (id, user_id, purchase_id, laurels, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), input.userId, purchaseId, input.pack.laurels, now),
    ]);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const owner = await db
      .prepare(
        `SELECT user_id FROM gold_store_purchases WHERE platform = ? AND purchase_key = ?`,
      )
      .bind(input.platform, input.purchaseKey)
      .first<{ user_id: string }>();
    return { credited: false, ownerId: owner?.user_id || "" };
  }
  return { credited: true, ownerId: input.userId };
}

/**
 * Takes back the Gold from a refunded / revoked pack. Gold already spent
 * becomes debt, which blocks spending and cash-outs until repaid.
 */
export async function refundPack(
  env: Env,
  match: { platform: string; purchaseKey?: string | null; paymentRef?: string | null },
): Promise<boolean> {
  const db = env.ASCENT_DB;
  const row = await db
    .prepare(
      `SELECT id, user_id, gold, status FROM gold_store_purchases
       WHERE platform = ? AND (purchase_key = ? OR (payment_ref IS NOT NULL AND payment_ref = ?))
       LIMIT 1`,
    )
    .bind(match.platform, match.purchaseKey ?? "", match.paymentRef ?? "")
    .first<{ id: string; user_id: string; gold: number; status: string }>();
  if (!row || row.status === "refunded") return false;

  const wallet = await readWallet(db, row.user_id);
  const take = Math.min(wallet.purchased, row.gold);
  const debt = row.gold - take;
  const now = nowIso();
  await db.batch([
    ensureWalletStmt(db, row.user_id, now),
    db
      .prepare(
        `UPDATE gold_store_purchases SET status = 'refunded', refunded_at = ?
         WHERE id = ? AND status != 'refunded'`,
      )
      .bind(now, row.id),
    db
      .prepare(
        `UPDATE gold_wallets
         SET purchased = purchased - ?, debt = debt + ?, updated_at = ?
         WHERE user_id = ?`,
      )
      .bind(take, debt, now, row.user_id),
    ledgerStmt(db, {
      userId: row.user_id,
      kind: "refund",
      purchased: -take,
      debt,
      ref: row.id,
      now,
    }),
    db
      .prepare(
        `DELETE FROM gold_laurel_grants WHERE purchase_id = ? AND claimed_at IS NULL`,
      )
      .bind(row.id),
  ]);
  await notifyAdmin(
    env,
    `Gold refund (${match.platform})`,
    `A ${row.gold} Gold pack was refunded.\nUser id: ${row.user_id}\nPurchase: ${row.id}\nClawed back: ${take}\nNew debt: ${debt}`,
  );
  return true;
}

/** Credits a paid Stripe Checkout Session for a Gold pack (confirm + webhook). */
export async function creditStripeGoldSession(
  env: Env,
  session: Record<string, unknown>,
): Promise<{ credited: boolean; userId: string } | null> {
  const metadata = (session.metadata || {}) as Record<string, unknown>;
  if (metadata.kind !== "gold" || session.payment_status !== "paid") return null;
  const userId = typeof metadata.userId === "string" ? metadata.userId : "";
  const pack = packById(metadata.packId);
  const sessionId = typeof session.id === "string" ? session.id : "";
  if (!userId || !pack || !sessionId) return null;
  if (typeof session.amount_total === "number" && session.amount_total < pack.usdCents) {
    return null;
  }
  const intent = session.payment_intent;
  const paymentRef =
    typeof intent === "string"
      ? intent
      : intent && typeof intent === "object" && typeof (intent as { id?: unknown }).id === "string"
        ? (intent as { id: string }).id
        : null;
  const result = await creditPack(env, {
    userId,
    platform: "stripe",
    productId: `web_ascent_gold_${pack.id}`,
    pack,
    purchaseKey: sessionId,
    paymentRef,
    test: session.livemode === false,
  });
  return { credited: result.credited, userId: result.ownerId };
}

/** Plain-text alert to the Altaris inbox (listing reviews, cash-outs, refunds). */
export async function notifyAdmin(env: Env, subject: string, text: string) {
  try {
    await sendFeedbackEmail(env, {
      subject: `[Marketplace] ${subject}`,
      text,
      replyTo: "brentunderwood@altarislabs.dev",
    });
  } catch {
    // Alerts are best-effort.
  }
}
