import type { Env } from "../auth/_lib";

/** Games that can host a complete master-games table. */
export const GAMES = new Set(["chess", "checkers"]);

export const MAX_FEN_LENGTH = 200;
export const MAX_FENS_PER_REQUEST = 64;
export const SHARD_HEX_LEN = 4;

export type MasterMove = {
  move: string;
  nextFen: string;
  win: number;
  lose: number;
  draw: number;
};

export function normalizeGameId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

export function asFen(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, MAX_FEN_LENGTH);
}

function asCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
  }
  return 0;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** R2 key for one FEN shard: master-games/{gameId}/shard/{4hex}.json */
export function shardObjectKey(gameId: string, fenSha256Hex: string): string {
  return `master-games/${gameId}/shard/${fenSha256Hex.slice(0, SHARD_HEX_LEN)}.json`;
}

export function sourceCsvKey(gameId: string): string {
  return `master-games/${gameId}/source/master_games.csv`;
}

function parseMove(raw: unknown): MasterMove | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const move = typeof row.move === "string" ? row.move.trim() : "";
  if (!move) return null;
  const nextFenRaw = row.nextFen ?? row.next_fen;
  const nextFen = typeof nextFenRaw === "string" ? nextFenRaw.trim() : "";
  return {
    move,
    nextFen,
    win: asCount(row.win),
    lose: asCount(row.lose),
    draw: asCount(row.draw),
  };
}

function movesFromShardJson(data: unknown, fen: string): MasterMove[] {
  if (!data || typeof data !== "object") return [];
  const map = data as Record<string, unknown>;
  const raw = map[fen];
  if (!Array.isArray(raw)) return [];
  const out: MasterMove[] = [];
  for (const item of raw) {
    const move = parseMove(item);
    if (move) out.push(move);
  }
  return out;
}

type ShardCache = Map<string, Promise<unknown | null>>;

async function loadShard(
  bucket: R2Bucket,
  key: string,
  cache: ShardCache,
): Promise<unknown | null> {
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = (async () => {
    const object = await bucket.get(key);
    if (!object) return null;
    try {
      return await object.json();
    } catch {
      return null;
    }
  })();
  cache.set(key, pending);
  return pending;
}

export async function lookupMovesAtFen(
  env: Env,
  gameId: string,
  fen: string,
  cache: ShardCache = new Map(),
): Promise<MasterMove[]> {
  const bucket = env.ASCENT_FILES;
  if (!bucket || !fen) return [];
  const digest = await sha256Hex(fen);
  const data = await loadShard(bucket, shardObjectKey(gameId, digest), cache);
  return movesFromShardJson(data, fen);
}

export async function lookupMovesAtFens(
  env: Env,
  gameId: string,
  fens: string[],
): Promise<Map<string, MasterMove[]>> {
  const unique = [...new Set(fens.filter(Boolean))];
  const cache: ShardCache = new Map();
  const out = new Map<string, MasterMove[]>();
  await Promise.all(
    unique.map(async (fen) => {
      out.set(fen, await lookupMovesAtFen(env, gameId, fen, cache));
    }),
  );
  return out;
}
