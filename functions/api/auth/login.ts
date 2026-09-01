import {
  createSession,
  findUserByEmail,
  isValidEmail,
  json,
  normalizeEmail,
  readJson,
  requireSecret,
  sessionJson,
  verifyPassword,
  type Env,
} from "./_lib";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Accounts are temporarily unavailable." }, 503);
  }

  const body = await readJson<LoginBody>(context.request);
  const email = normalizeEmail(body?.email || "");
  const password = body?.password || "";

  if (!isValidEmail(email) || !password) {
    return json(context.request, { error: "Enter your email and password." }, 400);
  }

  const user = await findUserByEmail(context.env.ASCENT_DB, email);
  if (!user?.password_hash || !(await verifyPassword(password, user.password_hash))) {
    return json(context.request, { error: "Email or password is incorrect." }, 401);
  }

  const session = await createSession(context.env, context.request, user.id);
  return sessionJson(context.request, user, session);
}
