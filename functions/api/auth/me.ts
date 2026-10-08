import {
  clearSessionCookie,
  json,
  publicUser,
  requireSecret,
  sessionCookieIfBearerDiffers,
  userFromRequest,
  type Env,
} from "./_lib";

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { user: null });
  }
  const user = await userFromRequest(context.env, context.request);
  if (!user) {
    return json(context.request, { user: null }, 200, {
      "Set-Cookie": clearSessionCookie(context.request),
    });
  }
  const headers: Record<string, string> = {};
  const cookie = sessionCookieIfBearerDiffers(context.request);
  if (cookie) headers["Set-Cookie"] = cookie;
  return json(context.request, { user: publicUser(user) }, 200, headers);
}
