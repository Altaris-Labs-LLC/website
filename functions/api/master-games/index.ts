import {
  json,
  readJson,
  requireSecret,
  resolveSubscription,
  userFromRequest,
  type Env,
} from "../auth/_lib";
import {
  GAMES,
  MAX_FENS_PER_REQUEST,
  asFen,
  lookupMovesAtFen,
  lookupMovesAtFens,
  normalizeGameId,
  type MasterMove,
} from "./_lib";

function publicMoves(moves: MasterMove[]) {
  return moves.map((m) => ({
    move: m.move,
    nextFen: m.nextFen,
    win: m.win,
    lose: m.lose,
    draw: m.draw,
    total: m.win + m.lose + m.draw,
  }));
}

async function requirePremium(
  env: Env,
  request: Request,
): Promise<Response | null> {
  if (!requireSecret(env)) {
    return json(request, { error: "Master games API unavailable." }, 503);
  }
  if (!env.ASCENT_FILES) {
    return json(request, { error: "Master games host is unavailable." }, 503);
  }
  const user = await userFromRequest(env, request);
  if (!user) {
    return json(request, { error: "Sign in to use the complete database." }, 401);
  }
  if (!resolveSubscription(user).isPremium) {
    return json(request, { error: "Premium is required." }, 403);
  }
  return null;
}

/**
 * One position: GET /api/master-games?gameId=chess&fen=...
 * Returns only the moves at that FEN (never the CSV).
 */
export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  const denied = await requirePremium(context.env, context.request);
  if (denied) return denied;

  const url = new URL(context.request.url);
  const gameId = normalizeGameId(url.searchParams.get("gameId"));
  if (!GAMES.has(gameId)) {
    return json(context.request, { error: "Invalid gameId." }, 400);
  }
  const fen = asFen(url.searchParams.get("fen"));
  if (!fen) {
    return json(context.request, { error: "Missing fen." }, 400);
  }

  const moves = await lookupMovesAtFen(context.env, gameId, fen);
  return json(context.request, {
    gameId,
    fen,
    moves: publicMoves(moves),
  });
}

type Body = {
  gameId?: unknown;
  fens?: unknown;
};

/**
 * Several positions: POST /api/master-games { gameId, fens: string[] }
 * Each FEN is an independent shard lookup — still not the full table.
 */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const denied = await requirePremium(context.env, context.request);
  if (denied) return denied;

  const body = await readJson<Body>(context.request);
  const gameId = normalizeGameId(body?.gameId);
  if (!GAMES.has(gameId)) {
    return json(context.request, { error: "Invalid gameId." }, 400);
  }
  if (!Array.isArray(body?.fens)) {
    return json(context.request, { error: "Missing fens." }, 400);
  }

  const fens: string[] = [];
  const seen = new Set<string>();
  for (const raw of body.fens) {
    const fen = asFen(raw);
    if (!fen || seen.has(fen)) continue;
    seen.add(fen);
    fens.push(fen);
    if (fens.length >= MAX_FENS_PER_REQUEST) break;
  }

  const found = await lookupMovesAtFens(context.env, gameId, fens);
  return json(context.request, {
    gameId,
    positions: fens.map((fen) => ({
      fen,
      moves: publicMoves(found.get(fen) ?? []),
    })),
  });
}
