import {
  clearSessionCookie,
  deleteAccountForUser,
  json,
  readJson,
  requireSecret,
  userFromRequest,
  type Env,
} from "./_lib";

type DeleteBody = {
  confirmation?: string;
};

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Accounts are temporarily unavailable." }, 503);
  }

  const user = await userFromRequest(context.env, context.request);
  if (!user) {
    return json(context.request, { error: "Sign in to delete your account." }, 401);
  }

  const body = await readJson<DeleteBody>(context.request);
  if ((body?.confirmation || "").trim() !== "delete") {
    return json(
      context.request,
      { error: "Type delete in the confirmation box to continue." },
      400,
    );
  }

  await deleteAccountForUser(context.env.ASCENT_DB, user.id);
  return json(context.request, { ok: true }, 200, {
    "Set-Cookie": clearSessionCookie(context.request),
  });
}
