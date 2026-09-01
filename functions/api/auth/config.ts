import { json, type Env } from "./_lib";

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  return json(context.request, {
    googleClientId: context.env.GOOGLE_CLIENT_ID || null,
  });
}
