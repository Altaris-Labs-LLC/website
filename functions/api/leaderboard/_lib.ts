import { json, userFromRequest, type Env } from "../auth/_lib";

export const GAMES = new Set(["chess", "checkers"]);
export const PERIODS = new Set(["daily", "weekly", "monthly", "yearly", "all"]);
const BOARD_LIMIT = 100;

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

const LEADERBOARD_TZ = "America/Los_Angeles";

export function periodStartIso(period: string, now = new Date()): string | null {
  if (period === "all") return null;

  // One Pacific calendar for every player so day/week/month/year reset
  // together (PST in winter, PDT in summer). Not rolling windows, not UTC,
  // not the viewer's local zone.
  const offsetMin = offsetMinutesEastForTimeZone(now, LEADERBOARD_TZ);
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

/** Minutes east of UTC for [timeZone] at [now] (PDT = -420, PST = -480). */
export function offsetMinutesEastForTimeZone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return Math.round((asUtc - now.getTime()) / 60_000);
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

function whereClause(game: string | "all", since: string | null) {
  const parts: string[] = [];
  const binds: string[] = [];
  if (game !== "all") {
    parts.push("e.game_id = ?");
    binds.push(game);
  }
  if (since) {
    // Periods use the earn timestamp, not created_at (upload time).
    parts.push("datetime(e.earned_at) >= datetime(?)");
    binds.push(since);
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
) {
  const since = periodStartIso(period);
  const filter = whereClause(game, since);
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

  return json(request, { game, period, rows, you });
}
