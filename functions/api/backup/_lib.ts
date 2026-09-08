import {
  json,
  publicUser,
  requireSecret,
  userFromRequest,
  type Env,
} from "../auth/_lib";

export const GAMES = new Set(["chess", "checkers"]);
export const PART_NAMES = new Set([
  "prefs",
  "table_repertoire",
  "meta_repertoire",
  "table_saved_games",
  "table_saved_analysis",
  "table_position_notes",
  "table_error_tracking",
  "table_eval_practice",
  "table_puzzles",
  "overlay_eco",
  "overlay_endgames",
  "overlay_lessons_official",
  "table_lessons_unofficial",
]);
export const MAX_PART_BYTES = 8 * 1024 * 1024;
export const KEEP_REVISIONS = 3;
const SHA_RE = /^[a-f0-9]{64}$/;

export type ManifestRow = {
  revision: number;
  created_at: string;
  parts_json: string;
  byte_size: number;
};

export function parseGame(value: string | null): string | null {
  const game = (value || "").trim().toLowerCase();
  return GAMES.has(game) ? game : null;
}

export function parsePartName(value: string | null): string | null {
  const name = (value || "").trim();
  return PART_NAMES.has(name) ? name : null;
}

export function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA_RE.test(value);
}

export function objectKey(userId: string, gameId: string, sha256: string) {
  return `u/${userId}/${gameId}/${sha256}`;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function parsePartsJson(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [name, sha] of Object.entries(parsed as Record<string, unknown>)) {
      if (PART_NAMES.has(name) && isSha256(sha)) out[name] = sha;
    }
    return out;
  } catch {
    return {};
  }
}

export async function requirePremiumBackup(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return {
      error: json(context.request, { error: "Cloud backup is unavailable." }, 503),
    };
  }
  if (!context.env.ASCENT_BACKUPS) {
    return {
      error: json(context.request, { error: "Cloud backup is unavailable." }, 503),
    };
  }
  const row = await userFromRequest(context.env, context.request);
  if (!row) {
    return {
      error: json(context.request, { error: "Sign in to use cloud backup." }, 401),
    };
  }
  const user = publicUser(row);
  if (!user.subscription.isPremium) {
    return {
      error: json(context.request, { error: "Cloud backup is a Premium feature." }, 403),
    };
  }
  return { user, bucket: context.env.ASCENT_BACKUPS };
}

export async function latestManifest(
  env: Env,
  userId: string,
  gameId: string,
): Promise<ManifestRow | null> {
  return env.ASCENT_DB.prepare(
    `SELECT revision, created_at, parts_json, byte_size
     FROM cloud_backup_manifests
     WHERE user_id = ? AND game_id = ?
     ORDER BY revision DESC
     LIMIT 1`,
  )
    .bind(userId, gameId)
    .first<ManifestRow>();
}

export async function gcOldRevisions(
  env: Env,
  bucket: R2Bucket,
  userId: string,
  gameId: string,
) {
  const rows = await env.ASCENT_DB.prepare(
    `SELECT revision, parts_json
     FROM cloud_backup_manifests
     WHERE user_id = ? AND game_id = ?
     ORDER BY revision DESC`,
  )
    .bind(userId, gameId)
    .all<{ revision: number; parts_json: string }>();
  const listed = rows.results || [];
  const keep = listed.slice(0, KEEP_REVISIONS);
  const drop = listed.slice(KEEP_REVISIONS);
  if (!drop.length) return;

  const live = new Set<string>();
  for (const row of keep) {
    for (const sha of Object.values(parsePartsJson(row.parts_json))) {
      live.add(sha);
    }
  }
  const stale = new Set<string>();
  for (const row of drop) {
    for (const sha of Object.values(parsePartsJson(row.parts_json))) {
      if (!live.has(sha)) stale.add(sha);
    }
  }
  await Promise.all(
    [...stale].map((sha) => bucket.delete(objectKey(userId, gameId, sha))),
  );
  await env.ASCENT_DB.prepare(
    `DELETE FROM cloud_backup_manifests
     WHERE user_id = ? AND game_id = ? AND revision <= ?`,
  )
    .bind(userId, gameId, drop[0].revision)
    .run();
}
