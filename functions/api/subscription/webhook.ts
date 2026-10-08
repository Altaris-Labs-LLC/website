import { type Env } from "../auth/_lib";
import { creditStripeGoldSession, refundPack } from "../gold/_lib";
import {
  endStripePremium,
  grantStripePremium,
  metadataPlan,
  metadataUserId,
  retrieveSubscription,
  subscriptionExpiry,
  verifyStripeWebhook,
  type PaidPlan,
} from "./_stripe";

type StripeEvent = {
  type?: string;
  data?: { object?: Record<string, unknown> };
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function stringId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function subscriptionFor(
  env: Env,
  object: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const subscription = object.subscription;
  if (subscription && typeof subscription === "object") {
    return subscription as Record<string, unknown>;
  }
  const id = stringId(subscription);
  if (!id) return null;
  return retrieveSubscription(env, id);
}

async function applySubscription(
  env: Env,
  subscription: Record<string, unknown>,
  fallbackPlan: PaidPlan | null,
) {
  const userId = metadataUserId(subscription);
  const plan = metadataPlan(subscription) || fallbackPlan;
  const subscriptionId = stringId(subscription.id);
  if (!userId || !plan || !subscriptionId) return;
  const customerId = stringId(subscription.customer);
  const status = stringId(subscription.status);
  if (status === "canceled" || status === "incomplete_expired" || status === "unpaid") {
    await endStripePremium(env.ASCENT_DB, userId, subscriptionId);
    return;
  }
  await grantStripePremium(env.ASCENT_DB, {
    userId,
    plan,
    expiresAt: subscriptionExpiry(subscription, plan),
    subscriptionId,
    customerId,
  });
}

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const secret = context.env.STRIPE_WEBHOOK_SECRET;
  if (!context.env.ASCENT_DB || !context.env.STRIPE_SECRET_KEY || !secret) {
    return new Response("Subscription webhook is not configured.", { status: 503 });
  }
  const payload = await context.request.text();
  const valid = await verifyStripeWebhook(
    payload,
    context.request.headers.get("Stripe-Signature"),
    secret,
  );
  if (!valid) {
    return new Response("Invalid signature.", { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return new Response("Invalid payload.", { status: 400 });
  }
  const object = asObject(event.data?.object);
  if (!object) return new Response("ok");

  try {
    const metadata = asObject(object.metadata);
    if (
      (event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded") &&
      metadata?.kind === "gold"
    ) {
      await creditStripeGoldSession(context.env, object);
    } else if (
      (event.type === "charge.refunded" && object.refunded === true) ||
      event.type === "charge.dispute.created"
    ) {
      const intent = stringId(object.payment_intent);
      if (intent) {
        await refundPack(context.env, { platform: "stripe", paymentRef: intent });
      }
    } else if (event.type === "checkout.session.completed") {
      const subscription = await subscriptionFor(context.env, object);
      if (subscription) {
        await applySubscription(context.env, subscription, metadataPlan(object));
      }
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
      const subscription = await subscriptionFor(context.env, object);
      if (subscription) await applySubscription(context.env, subscription, null);
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      if (event.type === "customer.subscription.deleted") {
        const userId = metadataUserId(object);
        const subscriptionId = stringId(object.id);
        if (userId && subscriptionId) {
          await endStripePremium(context.env.ASCENT_DB, userId, subscriptionId);
        }
      } else {
        await applySubscription(context.env, object, null);
      }
    }
  } catch {
    return new Response("Webhook handler failed.", { status: 500 });
  }
  return new Response("ok");
}
