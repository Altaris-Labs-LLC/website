import { json, readJson, requireSecret, userFromRequest, type Env } from "../auth/_lib";
import {
  siteOrigin,
  stripeConfigured,
  stripeFetch,
  StripeError,
} from "../subscription/_stripe";
import { errorJson, packById } from "./_lib";

/** Website Gold checkout (Stripe-hosted page). Credited by confirm / webhook. */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!requireSecret(env)) return errorJson(request, "Gold is unavailable.", 503);
  if (!stripeConfigured(env)) {
    return errorJson(request, "Card checkout is not configured.", 503);
  }
  const user = await userFromRequest(env, request);
  if (!user) return errorJson(request, "Sign in to buy Gold.", 401);

  const body = await readJson<{ packId?: unknown }>(request);
  const pack = packById(typeof body?.packId === "string" ? body.packId : String(body?.packId ?? ""));
  if (!pack) return errorJson(request, "Choose a Gold pack.");

  const origin = siteOrigin(request);
  try {
    const session = await stripeFetch(env, "checkout/sessions", {
      method: "POST",
      params: {
        mode: "payment",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(pack.usdCents),
        "line_items[0][price_data][product_data][name]": `${pack.gold.toLocaleString("en-US")} Gold`,
        "line_items[0][price_data][product_data][description]": `Includes ${pack.laurels.toLocaleString("en-US")} bonus Laurels. Gold never expires.`,
        client_reference_id: user.id,
        customer_email: user.email,
        "metadata[kind]": "gold",
        "metadata[userId]": user.id,
        "metadata[packId]": pack.id,
        "payment_intent_data[metadata][kind]": "gold",
        "payment_intent_data[metadata][userId]": user.id,
        "payment_intent_data[metadata][packId]": pack.id,
        success_url: `${origin}/ascentgames/gold?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/ascentgames/gold?checkout=cancel`,
      },
    });
    const url = session.url;
    if (typeof url !== "string" || !url) {
      return errorJson(request, "Checkout could not be started.", 502);
    }
    return json(request, { url, sessionId: session.id });
  } catch (error) {
    const message =
      error instanceof StripeError ? error.message : "Checkout could not be started.";
    return errorJson(request, message, 502);
  }
}
