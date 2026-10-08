import { json, requireSecret, userFromRequest, type Env } from "../auth/_lib";
import {
  StripeError,
  createCheckoutSession,
  isOtherStripeMode,
  latestStripeCustomerId,
  paidPlan,
  siteOrigin,
  stripeConfigured,
} from "./_stripe";

type CheckoutBody = {
  plan?: unknown;
};

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Subscription is unavailable." }, 503);
  }
  if (!stripeConfigured(context.env)) {
    return json(
      context.request,
      { error: "Card and PayPal checkout is not configured." },
      503,
    );
  }
  const user = await userFromRequest(context.env, context.request);
  if (!user) {
    return json(context.request, { error: "Sign in to subscribe." }, 401);
  }
  if (user.premium_plan === "lifetime") {
    return json(
      context.request,
      { error: "This account already has lifetime Premium." },
      400,
    );
  }

  const publishableKey = context.env.STRIPE_PUBLISHABLE_KEY?.trim() || "";
  if (!publishableKey) {
    return json(
      context.request,
      { error: "Card and PayPal checkout is not configured." },
      503,
    );
  }

  const body = await context.request.json().catch(() => null) as CheckoutBody | null;
  const plan = paidPlan(body?.plan);
  if (!plan) {
    return json(context.request, { error: "Choose a plan." }, 400);
  }

  try {
    const customerId = await latestStripeCustomerId(context.env.ASCENT_DB, user.id);
    const returnUrl = `${siteOrigin(context.request)}/ascentgames/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    let session;
    try {
      session = await createCheckoutSession(context.env, {
        userId: user.id,
        email: user.email,
        plan,
        customerId,
        returnUrl,
      });
    } catch (error) {
      if (!customerId || !isOtherStripeMode(error)) throw error;
      session = await createCheckoutSession(context.env, {
        userId: user.id,
        email: user.email,
        plan,
        customerId: null,
        returnUrl,
      });
    }
    return json(context.request, {
      client_secret: session.clientSecret,
      session_id: session.sessionId,
      publishableKey,
    });
  } catch (error) {
    const message =
      error instanceof StripeError
        ? error.message
        : "Checkout could not be started.";
    return json(context.request, { error: message }, 400);
  }
}
