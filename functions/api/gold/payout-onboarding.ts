import { json, requireSecret, userFromRequest, type Env } from "../auth/_lib";
import {
  siteOrigin,
  stripeConfigured,
  stripeFetch,
  StripeError,
  stripeV2Fetch,
} from "../subscription/_stripe";
import { ensureWalletStmt, errorJson, nowIso, readWallet, walletJson } from "./_lib";

/**
 * Stripe Connect onboarding link for sellers (v2 recipient account with the
 * Express dashboard). Stripe collects bank and tax details; once transfers are
 * active this returns the Stripe Express dashboard instead.
 */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!requireSecret(env)) return errorJson(request, "Payouts are unavailable.", 503);
  if (!stripeConfigured(env)) {
    return errorJson(request, "Payouts are not configured yet.", 503);
  }
  const user = await userFromRequest(env, request);
  if (!user) return errorJson(request, "Sign in to set up payouts.", 401);

  const db = env.ASCENT_DB;
  const origin = siteOrigin(request);
  try {
    const wallet = await readWallet(db, user.id);
    let accountId = wallet.payout_account_id;
    if (!accountId) {
      // Recipient-only account: the platform sets prices and collects fees,
      // and sellers receive cash-outs as transfers to their Stripe balance.
      const account = await stripeV2Fetch(env, "core/accounts", {
        method: "POST",
        idempotencyKey: `payout-account-v2-${user.id}`,
        body: {
          display_name: (user.display_name || user.email).slice(0, 100),
          contact_email: user.email,
          identity: { country: "us" },
          dashboard: "express",
          defaults: {
            responsibilities: {
              fees_collector: "application",
              losses_collector: "application",
            },
          },
          configuration: {
            recipient: {
              capabilities: {
                stripe_balance: { stripe_transfers: { requested: true } },
              },
            },
          },
          metadata: { userId: user.id },
        },
      });
      accountId = typeof account.id === "string" ? account.id : null;
      if (!accountId) return errorJson(request, "Payout setup could not start.", 502);
      const now = nowIso();
      await db.batch([
        ensureWalletStmt(db, user.id, now),
        db
          .prepare(
            `UPDATE gold_wallets SET payout_account_id = ?, updated_at = ? WHERE user_id = ?`,
          )
          .bind(accountId, now, user.id),
      ]);
    }

    const status = await walletJson(env, user.id);
    if (status.payoutsReady) {
      const link = await stripeFetch(
        env,
        `accounts/${encodeURIComponent(accountId)}/login_links`,
        { method: "POST" },
      );
      return json(request, { url: link.url, ready: true });
    }
    const link = await stripeV2Fetch(env, "core/account_links", {
      method: "POST",
      body: {
        account: accountId,
        use_case: {
          type: "account_onboarding",
          account_onboarding: {
            configurations: ["recipient"],
            refresh_url: `${origin}/ascentgames/gold?payouts=refresh`,
            return_url: `${origin}/ascentgames/gold?payouts=done`,
          },
        },
      },
    });
    return json(request, { url: link.url, ready: false });
  } catch (error) {
    const message =
      error instanceof StripeError ? error.message : "Payout setup could not start.";
    return errorJson(request, message, 502);
  }
}
