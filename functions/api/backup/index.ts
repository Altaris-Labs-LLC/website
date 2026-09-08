import { json, type Env } from "../auth/_lib";
import { latestManifest, parseGame, parsePartsJson, requirePremiumBackup } from "./_lib";

export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  const auth = await requirePremiumBackup(context);
  if ("error" in auth) return auth.error;
  const url = new URL(context.request.url);
  const gameId = parseGame(url.searchParams.get("game"));
  if (!gameId) {
    return json(context.request, { error: "Unknown game." }, 400);
  }
  const row = await latestManifest(context.env, auth.user.id, gameId);
  if (!row) {
    return json(context.request, {
      game: gameId,
      revision: 0,
      updatedAt: null,
      parts: {},
      byteSize: 0,
    });
  }
  return json(context.request, {
    game: gameId,
    revision: row.revision,
    updatedAt: row.created_at,
    parts: parsePartsJson(row.parts_json),
    byteSize: row.byte_size,
  });
}
