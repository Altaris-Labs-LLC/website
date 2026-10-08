import { json, readJson, requireSecret, userFromRequest, type Env } from "../auth/_lib";
import { stripeConfigured, stripeFetch } from "../subscription/_stripe";
import { creditStripeGoldSession, errorJson, walletJson } from "./_lib";

/** Credits a finished website Gold checkout right away (the webhook is the backup). */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!requireSecret(env) || !stripeConfigured(env)) {
    return errorJson(request, "Gold checkout is unavailable.", 503);
  }
  const user = await userFromRequest(env, request);
  if (!user) return errorJson(request, "Sign in to finish checkout.", 401);
  const body = await readJson<{ sessionId?: unknown }>(request);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId.startsWith("cs_")) return errorJson(request, "Checkout not found.");

  let session: Record<string, unknown>;
  try {
    session = await stripeFetch(env, `checkout/sessions/${encodeURIComponent(sessionId)}`);
  } catch {
    return errorJson(request, "Checkout could not be confirmed.", 502);
  }
  const metadata = (session.metadata || {}) as Record<string, unknown>;
  if (metadata.kind !== "gold" || metadata.userId !== user.id) {
    return errorJson(request, "Checkout not found.", 404);
  }
  if (session.payment_status !== "paid") {
    return errorJson(request, "Payment has not completed yet.", 409);
  }
  const result = await creditStripeGoldSession(env, session);
  return json(request, {
    credited: Boolean(result?.credited),
    wallet: await walletJson(env, user.id),
  });
}
