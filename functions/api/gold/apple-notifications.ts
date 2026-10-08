import { readJson, type Env } from "../auth/_lib";
import { notifyAdmin, packForProduct, refundPack } from "./_lib";
import {
  appleConfigured,
  appleTransaction,
  jwsPayload,
  type AppleTransaction,
} from "./_verify";

type Notification = {
  notificationType?: string;
  subtype?: string;
  data?: { signedTransactionInfo?: string };
};

/**
 * App Store Server Notifications V2. The payload is only used to find the
 * transaction; the refund is confirmed with an authenticated App Store
 * Server API lookup before any Gold is taken back.
 */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!env.ASCENT_DB || !appleConfigured(env)) {
    return new Response("Not configured.", { status: 503 });
  }
  const body = await readJson<{ signedPayload?: unknown }>(request);
  const notification =
    typeof body?.signedPayload === "string"
      ? jwsPayload<Notification>(body.signedPayload)
      : null;
  if (!notification) return new Response("Bad payload.", { status: 400 });

  const type = notification.notificationType || "";
  if (type !== "REFUND" && type !== "REVOKE" && type !== "REFUND_REVERSED") {
    return new Response("ok");
  }
  const claimed = notification.data?.signedTransactionInfo
    ? jwsPayload<AppleTransaction>(notification.data.signedTransactionInfo)
    : null;
  const product = claimed?.productId ? packForProduct(claimed.productId) : null;
  if (!claimed?.transactionId || !product) return new Response("ok");

  if (type === "REFUND_REVERSED") {
    await notifyAdmin(
      env,
      "Apple refund reversed",
      `Apple reversed a refund for transaction ${claimed.transactionId} (${claimed.productId}). Re-credit manually if needed.`,
    );
    return new Response("ok");
  }

  try {
    const confirmed = await appleTransaction(env, product.game, claimed.transactionId);
    if (!confirmed?.revocationDate) return new Response("ok");
    await refundPack(env, { platform: "apple", purchaseKey: claimed.transactionId });
  } catch {
    return new Response("Retry later.", { status: 500 });
  }
  return new Response("ok");
}
