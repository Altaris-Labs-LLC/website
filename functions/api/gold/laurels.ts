import { json, requireSecret, userFromRequest, type Env } from "../auth/_lib";
import { errorJson, nowIso } from "./_lib";

/**
 * Claims bonus Laurels from Gold packs. Each grant is returned exactly once;
 * the app adds them to its local Laurel balance.
 */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!requireSecret(env)) return errorJson(request, "Gold is unavailable.", 503);
  const user = await userFromRequest(env, request);
  if (!user) return errorJson(request, "Sign in to claim Laurels.", 401);
  const claimed = await env.ASCENT_DB.prepare(
    `UPDATE gold_laurel_grants SET claimed_at = ?
     WHERE user_id = ? AND claimed_at IS NULL
     RETURNING laurels`,
  )
    .bind(nowIso(), user.id)
    .all<{ laurels: number }>();
  const laurels = (claimed.results || []).reduce(
    (sum, row) => sum + (Number(row.laurels) || 0),
    0,
  );
  return json(request, { laurels });
}
