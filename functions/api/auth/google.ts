import {
  createSession,
  findUserByEmail,
  findUserByGoogleSub,
  insertUser,
  json,
  readJson,
  requireSecret,
  sessionJson,
  verifyGoogleIdToken,
  type Env,
} from "./_lib";

type GoogleBody = {
  credential?: string;
};

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Accounts are temporarily unavailable." }, 503);
  }

  const clientId = context.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return json(
      context.request,
      { error: "Google sign-in is not available yet." },
      503,
    );
  }

  const body = await readJson<GoogleBody>(context.request);
  const credential = body?.credential || "";
  if (!credential) {
    return json(context.request, { error: "Google sign-in did not complete." }, 400);
  }

  let profile;
  try {
    profile = await verifyGoogleIdToken(credential, clientId);
  } catch {
    return json(context.request, { error: "Google sign-in could not be verified." }, 401);
  }

  let user = await findUserByGoogleSub(context.env.ASCENT_DB, profile.sub);
  if (!user) {
    user = await findUserByEmail(context.env.ASCENT_DB, profile.email);
    if (user) {
      await context.env.ASCENT_DB.prepare(
        `UPDATE users
         SET google_sub = ?, avatar_url = COALESCE(?, avatar_url), last_seen_at = ?
         WHERE id = ?`,
      )
        .bind(
          profile.sub,
          profile.avatarUrl,
          new Date().toISOString(),
          user.id,
        )
        .run();
      user = {
        ...user,
        google_sub: profile.sub,
        avatar_url: profile.avatarUrl || user.avatar_url,
      };
    } else {
      user = await insertUser(context.env.ASCENT_DB, {
        email: profile.email,
        displayName: profile.displayName,
        googleSub: profile.sub,
        avatarUrl: profile.avatarUrl,
      });
    }
  }

  const session = await createSession(context.env, context.request, user.id);
  return sessionJson(context.request, user, session);
}
