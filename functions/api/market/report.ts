import { json, readJson, requireSecret, userFromRequest, type Env } from "../auth/_lib";
import { errorJson, notifyAdmin, nowIso } from "../gold/_lib";
import { isUniqueViolation, MAX_REPORTS_PER_DAY, text } from "./_lib";

/** Flag a listing for review (copyright, broken content, offensive text). */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!requireSecret(env)) return errorJson(request, "The Marketplace is unavailable.", 503);
  const user = await userFromRequest(env, request);
  if (!user) return errorJson(request, "Sign in to report a listing.", 401);

  const body = await readJson<{ listingId?: unknown; reason?: unknown; details?: unknown }>(
    request,
  );
  const listingId = text(body?.listingId, 80);
  const reason = text(body?.reason, 80);
  if (!listingId || !reason) return errorJson(request, "Choose a reason.");
  const db = env.ASCENT_DB;
  const listing = await db
    .prepare(`SELECT id, title, seller_id FROM market_listings WHERE id = ?`)
    .bind(listingId)
    .first<{ id: string; title: string; seller_id: string }>();
  if (!listing) return errorJson(request, "Listing not found.", 404);

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const recent = await db
    .prepare(`SELECT COUNT(*) AS n FROM market_reports WHERE reporter_id = ? AND created_at > ?`)
    .bind(user.id, since)
    .first<{ n: number }>();
  if ((Number(recent?.n) || 0) >= MAX_REPORTS_PER_DAY) {
    return errorJson(request, "You have sent a lot of reports today. Try again tomorrow.", 429);
  }
  try {
    await db
      .prepare(
        `INSERT INTO market_reports (id, listing_id, reporter_id, reason, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), listing.id, user.id, reason, text(body?.details, 2000), nowIso())
      .run();
  } catch (error) {
    if (isUniqueViolation(error)) return json(request, { ok: true });
    throw error;
  }
  await notifyAdmin(
    env,
    "Listing reported",
    `"${listing.title}" (${listing.id}) was reported by ${user.email}: ${reason}\nReview: https://altarislabs.dev/ascentgames/admin/marketplace`,
  );
  return json(request, { ok: true });
}
