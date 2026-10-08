import { json, requireSecret, userFromRequest, type Env } from "../auth/_lib";
import {
  StripeError,
  createPortalSession,
  endUnbillableStripePremium,
  isOtherStripeMode,
  latestStripeCustomerId,
  siteOrigin,
  stripeConfigured,
} from "./_stripe";

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env) || !stripeConfigured(context.env)) {
    return json(context.request, { error: "Subscription is unavailable." }, 503);
  }
  const user = await userFromRequest(context.env, context.request);
  if (!user) {
    return json(context.request, { error: "Sign in to manage billing." }, 401);
  }
  const customerId = await latestStripeCustomerId(context.env.ASCENT_DB, user.id);
  if (!customerId) {
    return json(
      context.request,
      { error: "This account has no website subscription to manage." },
      404,
    );
  }
  try {
    const url = await createPortalSession(
      context.env,
      customerId,
      siteOrigin(context.request),
    );
    return json(context.request, { url });
  } catch (error) {
    if (
      isOtherStripeMode(error) &&
      error instanceof StripeError &&
      /exists in test mode/i.test(error.message)
    ) {
      await endUnbillableStripePremium(context.env.ASCENT_DB, user.id);
      return json(context.request, {
        ended: true,
        message:
          "This subscription was created in Stripe test mode, so there is no live payment to cancel. Premium from that checkout has been turned off.",
      });
    }
    const message =
      error instanceof StripeError
        ? error.message
        : "Billing could not be opened.";
    return json(context.request, { error: message }, 400);
  }
}
