import { json, type Env } from "../auth/_lib";
import {
  PART_NAMES,
  gcOldRevisions,
  isSha256,
  latestManifest,
  objectKey,
  parseGame,
  parsePartsJson,
  requirePremiumBackup,
} from "./_lib";

type CommitBody = {
  gameId?: unknown;
  parts?: unknown;
};

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const auth = await requirePremiumBackup(context);
  if ("error" in auth) return auth.error;
  const body = (await context.request.json().catch(() => null)) as CommitBody | null;
  const gameId = parseGame(typeof body?.gameId === "string" ? body.gameId : null);
  if (!gameId) {
    return json(context.request, { error: "Unknown game." }, 400);
  }
  if (!body?.parts || typeof body.parts !== "object" || Array.isArray(body.parts)) {
    return json(context.request, { error: "Backup manifest is missing." }, 400);
  }

  const parts: Record<string, string> = {};
  for (const [name, sha] of Object.entries(body.parts as Record<string, unknown>)) {
    if (!PART_NAMES.has(name) || !isSha256(sha)) {
      return json(context.request, { error: `Invalid backup part ${name}.` }, 400);
    }
    parts[name] = sha;
  }
  for (const required of PART_NAMES) {
    if (!parts[required]) {
      return json(context.request, { error: `Missing backup part ${required}.` }, 400);
    }
  }

  const previous = await latestManifest(context.env, auth.user.id, gameId);
  const previousParts = previous ? parsePartsJson(previous.parts_json) : {};
  let byteSize = 0;
  for (const [name, sha] of Object.entries(parts)) {
    const object = await auth.bucket.head(objectKey(auth.user.id, gameId, sha));
    if (!object) {
      return json(
        context.request,
        { error: `Upload ${name} before committing the backup.` },
        400,
      );
    }
    byteSize += object.size;
  }

  const unchanged =
    previous &&
    Object.keys(parts).length === Object.keys(previousParts).length &&
    Object.entries(parts).every(([name, sha]) => previousParts[name] === sha);
  if (unchanged && previous) {
    return json(context.request, {
      ok: true,
      game: gameId,
      revision: previous.revision,
      updatedAt: previous.created_at,
      byteSize: previous.byte_size,
    });
  }

  const revision = (previous?.revision || 0) + 1;
  const createdAt = new Date().toISOString();
  await context.env.ASCENT_DB.prepare(
    `INSERT INTO cloud_backup_manifests
      (user_id, game_id, revision, created_at, parts_json, byte_size)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      auth.user.id,
      gameId,
      revision,
      createdAt,
      JSON.stringify(parts),
      byteSize,
    )
    .run();
  await gcOldRevisions(context.env, auth.bucket, auth.user.id, gameId);
  return json(context.request, {
    ok: true,
    game: gameId,
    revision,
    updatedAt: createdAt,
    byteSize,
  });
}
