import { json, requireSecret, type Env } from "../auth/_lib";
import {
  GAMES,
  asInt,
  asText,
  normalizeGameId,
  publicEndgame,
  type EndgameRow,
} from "./_lib";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

function encodeCursor(updatedAt: string, fen: string): string {
  return `${updatedAt}||${fen}`;
}

function decodeCursor(raw: string): { updatedAt: string; fen: string } | null {
  const idx = raw.indexOf("||");
  if (idx <= 0) return null;
  const updatedAt = raw.slice(0, idx).trim();
  const fen = raw.slice(idx + 2).trim();
  if (!updatedAt || !fen) return null;
  return { updatedAt, fen };
}

/**
 * Incremental difficulty pull. Pass `since` (ISO timestamp) to receive only
 * rows with updated_at > since. Paginate with opaque `cursor` from the prior
 * response (`updatedAt||fen`).
 */
export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Endgames API unavailable." }, 503);
  }

  const url = new URL(context.request.url);
  const gameId = normalizeGameId(url.searchParams.get("gameId"));
  if (!GAMES.has(gameId)) {
    return json(context.request, { error: "Invalid gameId." }, 400);
  }

  const since = asText(url.searchParams.get("since") ?? "", 40);
  const cursorRaw = asText(url.searchParams.get("cursor") ?? "", 280);
  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
  let limit = asInt(url.searchParams.get("limit"));
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  limit = Math.min(MAX_LIMIT, Math.max(1, limit));

  const serverTime = new Date().toISOString();

  let rows: EndgameRow[] = [];
  if (cursor) {
    const result = await context.env.ASCENT_DB.prepare(
      `SELECT game_id, fen, difficulty, view_count, updated_at
       FROM endgame_positions
       WHERE game_id = ?
         AND (
           updated_at > ?
           OR (updated_at = ? AND fen > ?)
         )
       ORDER BY updated_at ASC, fen ASC
       LIMIT ?`,
    )
      .bind(gameId, cursor.updatedAt, cursor.updatedAt, cursor.fen, limit)
      .all<EndgameRow>();
    rows = result.results ?? [];
  } else if (since) {
    const result = await context.env.ASCENT_DB.prepare(
      `SELECT game_id, fen, difficulty, view_count, updated_at
       FROM endgame_positions
       WHERE game_id = ?
         AND updated_at > ?
       ORDER BY updated_at ASC, fen ASC
       LIMIT ?`,
    )
      .bind(gameId, since, limit)
      .all<EndgameRow>();
    rows = result.results ?? [];
  } else {
    const result = await context.env.ASCENT_DB.prepare(
      `SELECT game_id, fen, difficulty, view_count, updated_at
       FROM endgame_positions
       WHERE game_id = ?
       ORDER BY updated_at ASC, fen ASC
       LIMIT ?`,
    )
      .bind(gameId, limit)
      .all<EndgameRow>();
    rows = result.results ?? [];
  }

  const hasMore = rows.length >= limit;
  const last = rows.length > 0 ? rows[rows.length - 1]! : null;
  const nextCursor =
    hasMore && last ? encodeCursor(last.updated_at, last.fen) : null;

  return json(context.request, {
    gameId,
    serverTime,
    hasMore,
    nextCursor,
    rows: rows.map(publicEndgame),
  });
}
