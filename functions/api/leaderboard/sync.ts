import {
  json,
  readJson,
  requireSecret,
  userFromRequest,
  type Env,
} from "../auth/_lib";
import { GAMES } from "./_lib";

const MAX_EVENTS = 500;
const MAX_POINTS = 10_000;

type SyncEvent = {
  id?: unknown;
  gameId?: unknown;
  points?: unknown;
  earnedAt?: unknown;
};

type SyncBody = {
  gameId?: unknown;
  events?: unknown;
};

function parseIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = Date.now();
  const t = date.getTime();
  // Keep the earn instant. Only clamp impossible clocks, never substitute upload time.
  if (t > now + 24 * 60 * 60 * 1000) return new Date(now).toISOString();
  const oldest = now - 20 * 365 * 24 * 60 * 60 * 1000;
  if (t < oldest) return new Date(oldest).toISOString();
  return date.toISOString();
}

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Leaderboard is unavailable." }, 503);
  }
  const user = await userFromRequest(context.env, context.request);
  if (!user) {
    return json(context.request, { error: "Sign in to sync laurels." }, 401);
  }
  const body = await readJson<SyncBody>(context.request);
  const rawEvents = Array.isArray(body?.events) ? (body.events as SyncEvent[]) : [];
  if (rawEvents.length > MAX_EVENTS) {
    return json(context.request, { error: "Too many events in one sync." }, 400);
  }
  const defaultGame =
    typeof body?.gameId === "string" ? body.gameId.trim().toLowerCase() : "";
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  let accepted = 0;

  for (const event of rawEvents) {
    const id = typeof event.id === "string" ? event.id.trim() : "";
    if (!id || id.length > 80) continue;
    const gameId = (
      typeof event.gameId === "string" ? event.gameId : defaultGame
    )
      .trim()
      .toLowerCase();
    if (!GAMES.has(gameId)) continue;
    const points = Number(event.points);
    if (!Number.isFinite(points) || points < 1) continue;
    const pts = Math.min(MAX_POINTS, Math.round(points));
    const earnedAt = parseIso(event.earnedAt);
    if (!earnedAt) continue;
    statements.push(
      context.env.ASCENT_DB.prepare(
        `INSERT OR IGNORE INTO laurel_events
          (id, user_id, game_id, points, earned_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(id, user.id, gameId, pts, earnedAt, now),
    );
    accepted += 1;
  }

  for (let i = 0; i < statements.length; i += 50) {
    await context.env.ASCENT_DB.batch(statements.slice(i, i + 50));
  }

  return json(context.request, {
    ok: true,
    accepted,
    ignored: rawEvents.length - accepted,
  });
}
