import {
  createSession,
  findUserByEmail,
  hashPassword,
  insertUser,
  isValidDisplayName,
  isValidEmail,
  isValidPassword,
  json,
  normalizeEmail,
  readJson,
  requireSecret,
  sessionJson,
  type Env,
} from "./_lib";

type SignupBody = {
  email?: string;
  password?: string;
  displayName?: string;
};

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Accounts are temporarily unavailable." }, 503);
  }

  const body = await readJson<SignupBody>(context.request);
  const email = normalizeEmail(body?.email || "");
  const password = body?.password || "";
  const displayName = (body?.displayName || "").trim();

  if (!isValidEmail(email) || !isValidPassword(password) || !isValidDisplayName(displayName)) {
    return json(
      context.request,
      {
        error:
          "Enter a valid email, a display name, and a password of at least 8 characters.",
      },
      400,
    );
  }

  const existing = await findUserByEmail(context.env.ASCENT_DB, email);
  if (existing) {
    return json(
      context.request,
      { error: "An account with this email already exists. Log in instead." },
      409,
    );
  }

  try {
    const user = await insertUser(context.env.ASCENT_DB, {
      email,
      displayName,
      passwordHash: await hashPassword(password),
    });
    const session = await createSession(context.env, context.request, user.id);
    return sessionJson(context.request, user, session, 201);
  } catch {
    return json(context.request, { error: "Could not create the account." }, 500);
  }
}
