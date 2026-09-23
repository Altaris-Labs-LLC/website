import {
  createSession,
  findUserByAppleSub,
  findUserByEmail,
  insertUser,
  isValidDisplayName,
  json,
  readJson,
  requireSecret,
  sessionJson,
  verifyAppleIdToken,
  type Env,
} from "./_lib";

type AppleBody = {
  identityToken?: string;
  nonce?: string;
  displayName?: string;
};

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Accounts are temporarily unavailable." }, 503);
  }

  const body = await readJson<AppleBody>(context.request);
  const identityToken = body?.identityToken || "";
  const rawNonce = body?.nonce || "";
  if (!identityToken || !rawNonce) {
    return json(context.request, { error: "Apple sign-in did not complete." }, 400);
  }

  let profile;
  try {
    profile = await verifyAppleIdToken(identityToken, rawNonce);
  } catch {
    return json(context.request, { error: "Apple sign-in could not be verified." }, 401);
  }

  let user = await findUserByAppleSub(context.env.ASCENT_DB, profile.sub);
  if (!user && profile.email) {
    user = await findUserByEmail(context.env.ASCENT_DB, profile.email);
    if (user) {
      await context.env.ASCENT_DB.prepare(
        `UPDATE users SET apple_sub = ?, last_seen_at = ? WHERE id = ?`,
      )
        .bind(profile.sub, new Date().toISOString(), user.id)
        .run();
      user = { ...user, apple_sub: profile.sub };
    }
  }

  if (!user) {
    if (!profile.email) {
      return json(
        context.request,
        {
          error:
            "Apple did not share an email address. In Settings, remove this app from Sign in with Apple and try again.",
        },
        400,
      );
    }
    const requested = (body?.displayName || "").trim();
    const displayName = isValidDisplayName(requested)
      ? requested
      : profile.email.split("@")[0].slice(0, 80);
    user = await insertUser(context.env.ASCENT_DB, {
      email: profile.email,
      displayName,
      appleSub: profile.sub,
    });
  }

  const session = await createSession(context.env, context.request, user.id);
  return sessionJson(context.request, user, session);
}
