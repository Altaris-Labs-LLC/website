import {
  anonymousDisplayName,
  anonymousEmail,
  createSession,
  insertUser,
  json,
  nextAnonymousNumber,
  requireSecret,
  sessionJson,
  userFromRequest,
  type Env,
} from "./_lib";

/** Creates Anonymous_[id] when the device has no account yet. */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!requireSecret(env)) {
    return json(request, { error: "Accounts are temporarily unavailable." }, 503);
  }
  const current = await userFromRequest(env, request);
  if (current) {
    const session = await createSession(env, request, current.id);
    return sessionJson(request, current, session);
  }
  try {
    const n = await nextAnonymousNumber(env.ASCENT_DB);
    const user = await insertUser(env.ASCENT_DB, {
      email: anonymousEmail(n),
      displayName: anonymousDisplayName(n),
    });
    const session = await createSession(env, request, user.id);
    return sessionJson(request, user, session, 201);
  } catch {
    return json(request, { error: "Could not create the account." }, 500);
  }
}
