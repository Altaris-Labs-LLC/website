import {
  clearSessionCookie,
  destroySession,
  json,
  requireSecret,
  type Env,
} from "./_lib";

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (requireSecret(context.env)) {
    await destroySession(context.env, context.request);
  }
  return json(context.request, { ok: true }, 200, {
    "Set-Cookie": clearSessionCookie(context.request),
  });
}
