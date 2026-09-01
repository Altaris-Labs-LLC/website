import {
  json,
  publicUser,
  requireSecret,
  userFromRequest,
  type Env,
} from "../auth/_lib";

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Subscription is unavailable." }, 503);
  }
  const user = await userFromRequest(context.env, context.request);
  if (!user) {
    return json(context.request, { error: "Sign in to view your subscription." }, 401);
  }
  const pub = publicUser(user);
  return json(context.request, {
    user: pub,
    subscription: pub.subscription,
  });
}
