import { readJson, type Env } from "../auth/_lib";
import { refundPack } from "./_lib";

type PubSubPush = { message?: { data?: string } };

type DeveloperNotification = {
  packageName?: string;
  voidedPurchaseNotification?: {
    purchaseToken?: string;
    orderId?: string;
    productType?: number;
  };
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/**
 * Google Play real-time developer notifications (Pub/Sub push). Push URL:
 * https://altarislabs.dev/api/gold/google-notifications?token=<GOOGLE_RTDN_TOKEN>
 * Voided (refunded / charged back) Gold packs are taken back.
 */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  const expected = env.GOOGLE_RTDN_TOKEN || "";
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!env.ASCENT_DB || !expected || !timingSafeEqual(token, expected)) {
    return new Response("Forbidden.", { status: 403 });
  }
  const push = await readJson<PubSubPush>(request);
  const raw = push?.message?.data;
  if (!raw) return new Response("ok");
  let notification: DeveloperNotification;
  try {
    notification = JSON.parse(atob(raw)) as DeveloperNotification;
  } catch {
    return new Response("ok");
  }
  const voided = notification.voidedPurchaseNotification;
  if (!voided?.purchaseToken && !voided?.orderId) return new Response("ok");
  try {
    await refundPack(env, {
      platform: "google",
      purchaseKey: voided.orderId || voided.purchaseToken,
      paymentRef: voided.purchaseToken,
    });
  } catch {
    return new Response("Retry later.", { status: 500 });
  }
  return new Response("ok");
}
