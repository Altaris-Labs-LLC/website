import { resolveSubscription } from "../auth/_lib";

export const KINDS = new Set(["opening", "lesson"]);

/** Listings stay visible only while the seller has Premium. */
export const SELLER_PREMIUM_SQL = `(u.premium_plan = 'lifetime' OR (u.premium_plan IN ('monthly', 'yearly') AND u.premium_expires_at > ?))`;

export const MAX_CONTENT_BYTES = 8 * 1024 * 1024;
export const MAX_LISTINGS_PER_DAY = 10;
export const MAX_REPORTS_PER_DAY = 20;

type SubscriptionRow = Parameters<typeof resolveSubscription>[0];

export function isPremium(user: SubscriptionRow): boolean {
  return resolveSubscription(user).isPremium;
}

export type ListingRow = {
  id: string;
  seller_id: string;
  seller_name: string;
  game_id: string;
  kind: string;
  title: string;
  description: string;
  price_gold: number;
  item_count: number;
  source_name: string | null;
  content_key: string;
  content_hash: string;
  content_bytes: number;
  status: string;
  review_note: string | null;
  sales_count: number;
  earned_gold: number;
  created_at: string;
  updated_at: string;
  owned?: number | null;
};

export function listingJson(row: ListingRow, viewerId: string | null) {
  const mine = Boolean(viewerId && row.seller_id === viewerId);
  return {
    id: row.id,
    kind: row.kind,
    game: row.game_id,
    title: row.title,
    description: row.description,
    sellerName: row.seller_name,
    priceGold: Number(row.price_gold) || 0,
    itemCount: Number(row.item_count) || 0,
    salesCount: Number(row.sales_count) || 0,
    owned: Boolean(row.owned),
    mine,
    status: row.status,
    createdAt: row.created_at,
    ...(mine
      ? {
          earnedGold: Number(row.earned_gold) || 0,
          reviewNote: row.review_note,
          sourceName: row.source_name,
        }
      : {}),
  };
}

export function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optionalText(value: unknown, max: number): string | null {
  const out = text(value, max);
  return out ? out : null;
}

function optionalInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type CleanContent = {
  content: Record<string, unknown>;
  itemCount: number;
  hash: string;
};

/**
 * Keeps only the known content fields (never practice stats) and returns a
 * fingerprint that ignores row order, used to stop duplicate / resold listings.
 */
export async function cleanContent(
  kind: string,
  raw: unknown,
): Promise<CleanContent | { error: string }> {
  if (!raw || typeof raw !== "object") return { error: "Listing content is missing." };
  const input = raw as Record<string, unknown>;

  if (kind === "opening") {
    const moves = Array.isArray(input.moves) ? input.moves : [];
    if (input.format !== "ascent.repertoire.v1" || !moves.length) {
      return { error: "That repertoire could not be read." };
    }
    if (moves.length > 50_000) return { error: "That repertoire is too large to list." };
    const repertoireColor = input.repertoireColor === 1 ? 1 : 0;
    const rows = moves.map((m) => {
      const move = (m || {}) as Record<string, unknown>;
      return {
        fen: text(move.fen, 200),
        move_string: text(move.move_string, 32),
        next_fen: text(move.next_fen, 200),
        player_color: move.player_color === 1 ? 1 : 0,
        ply_count: optionalInt(move.ply_count),
      };
    });
    if (rows.some((r) => !r.fen || !r.move_string || !r.next_fen)) {
      return { error: "That repertoire has unreadable moves." };
    }
    const canonical = rows
      .map((r) => `${r.fen}|${r.move_string}|${r.next_fen}|${r.player_color}`)
      .sort()
      .join("\n");
    return {
      content: {
        format: "ascent.repertoire.v1",
        repertoireColor,
        tags: text(input.tags, 200),
        moves: rows,
      },
      itemCount: rows.length,
      hash: await sha256Hex(`opening:${repertoireColor}\n${canonical}`),
    };
  }

  if (kind === "lesson") {
    const positions = Array.isArray(input.positions) ? input.positions : [];
    if (input.format !== "ascent.lesson.v1" || !positions.length) {
      return { error: "That lesson could not be read." };
    }
    if (positions.length > 20_000) return { error: "That lesson is too large to list." };
    const rows = positions.map((p) => {
      const pos = (p || {}) as Record<string, unknown>;
      return {
        fen: text(pos.fen, 200),
        lesson_type: text(pos.lesson_type, 40),
        lesson_motif: text(pos.lesson_motif, 200),
        is_root: pos.is_root === 1 || pos.is_root === true ? 1 : 0,
        move: optionalText(pos.move, 32),
        next_fen: optionalText(pos.next_fen, 200),
        last_fen: optionalText(pos.last_fen, 200),
        last_move: optionalText(pos.last_move, 32),
        computer_elo: optionalInt(pos.computer_elo) ?? 1500,
        lesson_note: text(pos.lesson_note, 4000),
        position_note: text(pos.position_note, 4000),
        knowledge_target: optionalInt(pos.knowledge_target) ?? 0,
        outcome_target: text(pos.outcome_target, 10) || "win",
        lesson_order: optionalInt(pos.lesson_order),
      };
    });
    if (rows.some((r) => !r.fen || !r.lesson_type)) {
      return { error: "That lesson has unreadable positions." };
    }
    const roots = rows.filter((r) => r.is_root === 1).length;
    if (!roots) return { error: "That lesson has no positions to practice." };
    const canonical = rows
      .map((r) => `${r.fen}|${r.move ?? ""}|${r.next_fen ?? ""}|${r.is_root}`)
      .sort()
      .join("\n");
    return {
      content: { format: "ascent.lesson.v1", positions: rows },
      itemCount: roots,
      hash: await sha256Hex(`lesson\n${canonical}`),
    };
  }

  return { error: "Unknown listing type." };
}

export function isUniqueViolation(error: unknown): boolean {
  return /UNIQUE constraint failed/i.test(String((error as Error)?.message || error));
}

/** Escapes a user search term for LIKE ... ESCAPE '\'. */
export function likeTerm(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
