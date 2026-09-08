import { corsHeaders, json, type Env } from "../auth/_lib";
import {
  MAX_PART_BYTES,
  objectKey,
  parseGame,
  parsePartName,
  parsePartsJson,
  requirePremiumBackup,
  sha256Hex,
  latestManifest,
} from "./_lib";

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  const auth = await requirePremiumBackup(context);
  if ("error" in auth) return auth.error;
  const url = new URL(context.request.url);
  const gameId = parseGame(url.searchParams.get("game"));
  const name = parsePartName(url.searchParams.get("name"));
  if (!gameId || !name) {
    return json(context.request, { error: "Unknown backup part." }, 400);
  }
  const row = await latestManifest(context.env, auth.user.id, gameId);
  const sha = row ? parsePartsJson(row.parts_json)[name] : undefined;
  if (!sha) {
    return json(context.request, { error: "Backup part not found." }, 404);
  }
  const object = await auth.bucket.get(objectKey(auth.user.id, gameId, sha));
  if (!object) {
    return json(context.request, { error: "Backup part not found." }, 404);
  }
  return new Response(object.body, {
    status: 200,
    headers: {
      "Content-Type": "application/gzip",
      "Cache-Control": "no-store",
      "X-Part-Sha256": sha,
      ...corsHeaders(context.request),
    },
  });
}

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const auth = await requirePremiumBackup(context);
  if ("error" in auth) return auth.error;
  const url = new URL(context.request.url);
  const gameId = parseGame(url.searchParams.get("game"));
  const name = parsePartName(url.searchParams.get("name"));
  if (!gameId || !name) {
    return json(context.request, { error: "Unknown backup part." }, 400);
  }
  const claimed = (context.request.headers.get("X-Part-Sha256") || "").toLowerCase();
  const bytes = await context.request.arrayBuffer();
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_PART_BYTES) {
    return json(context.request, { error: "Backup part is too large." }, 413);
  }
  const sha = await sha256Hex(bytes);
  if (claimed && claimed !== sha) {
    return json(context.request, { error: "Backup part hash mismatch." }, 400);
  }
  await auth.bucket.put(objectKey(auth.user.id, gameId, sha), bytes, {
    httpMetadata: { contentType: "application/gzip" },
  });
  return json(context.request, { ok: true, name, sha256: sha, bytes: bytes.byteLength });
}
