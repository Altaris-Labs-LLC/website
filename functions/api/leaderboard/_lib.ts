import { json, userFromRequest, type Env } from "../auth/_lib";

export const GAMES = new Set(["chess", "checkers"]);
export const PERIODS = new Set(["daily", "weekly", "monthly", "yearly", "all"]);
export const METRICS = new Set(["laurels", "puzzles"]);
const BOARD_LIMIT = 100;

export type LeaderboardMetric = "laurels" | "puzzles";

export type LeaderboardRow = {
  rank: number;
  displayName: string;
  points: number;
  isYou: boolean;
};

export type YouRow = {
  rank: number | null;
  displayName: string;
  points: number;
};

/** US Pacific (PST UTC-8 / PDT UTC-7). One calendar for every player. */
const PST_MINUTES = -8 * 60;
const PDT_MINUTES = -7 * 60;

function nthWeekdayUtc(year: number, monthIndex: number, weekday: number, n: number): number {
  const first = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

/** US DST: 2nd Sunday of March 02:00 PST → 1st Sunday of November 02:00 PDT. */
export function pacificOffsetMinutesEast(now: Date): number {
  const y = now.getUTCFullYear();
  const dstStart = Date.UTC(y, 2, nthWeekdayUtc(y, 2, 0, 2), 10, 0, 0);
  const dstEnd = Date.UTC(y, 10, nthWeekdayUtc(y, 10, 0, 1), 9, 0, 0);
  const t = now.getTime();
  return t >= dstStart && t < dstEnd ? PDT_MINUTES : PST_MINUTES;
}

export function periodStartIso(period: string, now = new Date()): string | null {
  if (period === "all") return null;

  const offsetMin = pacificOffsetMinutesEast(now);
  const offsetMs = offsetMin * 60 * 1000;
  const pacific = new Date(now.getTime() + offsetMs);
  const y = pacific.getUTCFullYear();
  const m = pacific.getUTCMonth();
  const d = pacific.getUTCDate();
  const pacificMidnightUtc = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month, day) - offsetMs).toISOString();

  switch (period) {
    case "daily":
      return pacificMidnightUtc(y, m, d);
    case "weekly": {
      const day = pacific.getUTCDay();
      const mondayOffset = day === 0 ? 6 : day - 1;
      return pacificMidnightUtc(y, m, d - mondayOffset);
    }
    case "monthly":
      return pacificMidnightUtc(y, m, 1);
    case "yearly":
      return pacificMidnightUtc(y, 0, 1);
    default:
      return null;
  }
}

export function periodStartUnix(period: string, now = new Date()): number | null {
  const iso = periodStartIso(period, now);
  if (!iso) return null;
  return Math.floor(new Date(iso).getTime() / 1000);
}

export function parseGameParam(value: string | null): string | "all" | null {
  const game = (value || "all").trim().toLowerCase();
  if (game === "all" || game === "overall") return "all";
  if (GAMES.has(game)) return game;
  return null;
}

export function parsePeriodParam(value: string | null): string | null {
  const period = (value || "all").trim().toLowerCase();
  if (period === "all-time" || period === "alltime") return "all";
  if (PERIODS.has(period)) return period;
  return null;
}

export function parseMetricParam(value: string | null): LeaderboardMetric {
  const metric = (value || "laurels").trim().toLowerCase();
  if (
    metric === "puzzles" ||
    metric === "puzzle" ||
    metric === "puzzle_contributions" ||
    metric === "puzzle_contribution"
  ) {
    return "puzzles";
  }
  return "laurels";
}

function whereClause(
  game: string | "all",
  sinceUnix: number | null,
  metric: LeaderboardMetric,
) {
  const parts: string[] = [];
  const binds: Array<string | number> = [];
  if (game !== "all") {
    parts.push("e.game_id = ?");
    binds.push(game);
  }
  if (metric === "puzzles") {
    parts.push("e.kind = ?");
    binds.push("puzzle_contribution");
  } else {
    // Laurels board: earn + legacy backfill. Treat missing kind as earn
    // (rows written before the kind column existed).
    parts.push("(e.kind IS NULL OR e.kind IN ('earn', 'legacy_backfill', ''))");
  }
  if (sinceUnix != null) {
    // Compare as unix seconds. SQLite datetime() mishandles trailing Z on
    // ISO strings and would keep 5pm–midnight PDT plays in the next UTC day.
    parts.push(
      "CAST(strftime('%s', replace(substr(e.earned_at, 1, 19), 'T', ' ')) AS INTEGER) >= ?",
    );
    binds.push(sinceUnix);
  }
  return {
    sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "",
    binds,
  };
}

export async function readLeaderboard(
  env: Env,
  request: Request,
  game: string | "all",
  period: string,
  metric: LeaderboardMetric = "laurels",
) {
  const sinceIso = periodStartIso(period);
  const sinceUnix = periodStartUnix(period);
  const filter = whereClause(game, sinceUnix, metric);
  const viewer = await userFromRequest(env, request);

  const listed = await env.ASCENT_DB.prepare(
    `SELECT u.id AS user_id, u.display_name AS display_name, SUM(e.points) AS points
     FROM laurel_events e
     JOIN users u ON u.id = e.user_id
     ${filter.sql}
     GROUP BY u.id
     HAVING SUM(e.points) > 0
     ORDER BY points DESC, display_name COLLATE NOCASE ASC
     LIMIT ?`,
  )
    .bind(...filter.binds, BOARD_LIMIT)
    .all<{ user_id: string; display_name: string; points: number }>();

  const rows: LeaderboardRow[] = [];
  let lastPoints = -1;
  let lastRank = 0;
  (listed.results || []).forEach((row, index) => {
    const points = Number(row.points) || 0;
    if (points !== lastPoints) {
      lastRank = index + 1;
      lastPoints = points;
    }
    rows.push({
      rank: lastRank,
      displayName: row.display_name,
      points,
      isYou: viewer ? row.user_id === viewer.id : false,
    });
  });

  let you: YouRow | null = null;
  if (viewer) {
    const mine = await env.ASCENT_DB.prepare(
      `SELECT COALESCE(SUM(e.points), 0) AS points
       FROM laurel_events e
       ${filter.sql ? `${filter.sql} AND e.user_id = ?` : "WHERE e.user_id = ?"}`,
    )
      .bind(...filter.binds, viewer.id)
      .first<{ points: number }>();
    const points = Number(mine?.points) || 0;
    let rank: number | null = null;
    if (points > 0) {
      const ahead = await env.ASCENT_DB.prepare(
        `SELECT COUNT(*) AS n FROM (
           SELECT e.user_id
           FROM laurel_events e
           ${filter.sql}
           GROUP BY e.user_id
           HAVING SUM(e.points) > ?
         ) ranked`,
      )
        .bind(...filter.binds, points)
        .first<{ n: number }>();
      rank = (Number(ahead?.n) || 0) + 1;
    }
    you = {
      rank,
      displayName: viewer.display_name,
      points,
    };
  }

  return json(request, {
    game,
    period,
    metric,
    timezone: "America/Los_Angeles",
    since: sinceIso,
    rows,
    you,
  });
}
