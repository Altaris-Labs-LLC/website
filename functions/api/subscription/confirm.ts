import {
  json,
  publicUser,
  readJson,
  requireSecret,
  userFromRequest,
  type Env,
} from "../auth/_lib";
import {
  StripeError,
  grantStripePremium,
  metadataPlan,
  metadataUserId,
  paidPlan,
  retrieveCheckoutSession,
  retrieveSubscription,
  stripeConfigured,
  subscriptionExpiry,
} from "./_stripe";

type ConfirmBody = { sessionId?: unknown };

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env) || !stripeConfigured(context.env)) {
    return json(context.request, { error: "Subscription is unavailable." }, 503);
  }
  const user = await userFromRequest(context.env, context.request);
  if (!user) {
    return json(context.request, { error: "Sign in to subscribe." }, 401);
  }
  const body = await readJson<ConfirmBody>(context.request);
  const sessionId =
    typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId.startsWith("cs_")) {
    return json(context.request, { error: "That checkout could not be confirmed." }, 400);
  }

  try {
    const session = await retrieveCheckoutSession(context.env, sessionId);
    const owner = metadataUserId(session) || (
      typeof session.client_reference_id === "string"
        ? session.client_reference_id
        : null
    );
    if (owner !== user.id) {
      return json(context.request, { error: "That checkout belongs to another account." }, 403);
    }
    if (session.status !== "complete") {
      return json(context.request, { error: "Checkout is not complete yet." }, 409);
    }
    const plan = metadataPlan(session) || paidPlan(user.premium_plan);
    if (!plan) {
      return json(context.request, { error: "That checkout has no plan." }, 400);
    }
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription &&
            typeof session.subscription === "object" &&
            typeof (session.subscription as { id?: unknown }).id === "string"
          ? (session.subscription as { id: string }).id
          : "";
    if (!subscriptionId) {
      return json(context.request, { error: "Stripe did not return a subscription." }, 502);
    }
    const subscription =
      session.subscription && typeof session.subscription === "object"
        ? (session.subscription as Record<string, unknown>)
        : await retrieveSubscription(context.env, subscriptionId);
    const customerId =
      typeof session.customer === "string" ? session.customer : null;
    await grantStripePremium(context.env.ASCENT_DB, {
      userId: user.id,
      plan,
      expiresAt: subscriptionExpiry(subscription, plan),
      subscriptionId,
      customerId,
    });
    const fresh = await userFromRequest(context.env, context.request);
    const pub = publicUser(fresh || user);
    return json(context.request, { user: pub, subscription: pub.subscription });
  } catch (error) {
    const message =
      error instanceof StripeError
        ? error.message
        : "Checkout could not be confirmed.";
    return json(context.request, { error: message }, 502);
  }
}
