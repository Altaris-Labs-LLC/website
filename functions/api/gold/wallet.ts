import { json, requireSecret, userFromRequest, type Env } from "../auth/_lib";
import { errorJson, GOLD_PACKS, walletJson } from "./_lib";

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return errorJson(context.request, "Gold is unavailable.", 503);
  }
  const user = await userFromRequest(context.env, context.request);
  if (!user) return errorJson(context.request, "Sign in to see your Gold.", 401);
  return json(context.request, {
    wallet: await walletJson(context.env, user.id),
    packs: GOLD_PACKS,
  });
}
