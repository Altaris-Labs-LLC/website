"use client";

import { useEffect, useState } from "react";

import {
  fetchLeaderboard,
  type LeaderboardGame,
  type LeaderboardPeriod,
  type LeaderboardResponse,
} from "@/lib/ascent-leaderboard";

const GAMES: { id: LeaderboardGame; label: string }[] = [
  { id: "all", label: "All Ascent Games" },
  { id: "chess", label: "Chess Ascent" },
  { id: "checkers", label: "Checkers Ascent" },
];

const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: "daily", label: "Today" },
  { id: "weekly", label: "This week" },
  { id: "monthly", label: "This month" },
  { id: "yearly", label: "This year" },
  { id: "all", label: "All time" },
];

export default function AscentLeaderboard() {
  const [game, setGame] = useState<LeaderboardGame>("all");
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchLeaderboard(game, period)
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setData(null);
        setError(err instanceof Error ? err.message : "The leaderboard could not be loaded.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [game, period]);

  const youOffBoard =
    data?.you &&
    data.you.points > 0 &&
    !data.rows.some((row) => row.isYou);

  return (
    <div className="ascent-leaderboard">
      <div className="ascent-leaderboard-controls">
        <label className="ascent-leaderboard-select">
          <span>Board</span>
          <select
            value={game}
            onChange={(event) => setGame(event.target.value as LeaderboardGame)}
          >
            {GAMES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="ascent-period-tabs" role="tablist" aria-label="Period">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={period === item.id}
              className={period === item.id ? "active" : ""}
              onClick={() => setPeriod(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <p className="ascent-leaderboard-status">
        Periods follow Pacific Time so every player resets at the same moment.
      </p>
        <p className="ascent-leaderboard-status">Loading ranks…</p>
      ) : error ? (
        <p className="ascent-leaderboard-status ascent-leaderboard-error">{error}</p>
      ) : !data?.rows.length ? (
        <p className="ascent-leaderboard-status">
          No laurels recorded for this board yet. Play in the apps to climb.
        </p>
      ) : (
        <ol className="ascent-leaderboard-list">
          {data.rows.map((row) => (
            <li
              key={`${row.rank}-${row.displayName}`}
              className={row.isYou ? "is-you" : undefined}
            >
              <span className="rank">{row.rank}</span>
              <span className="name">{row.displayName}</span>
              <span className="points">{row.points}</span>
            </li>
          ))}
        </ol>
      )}

      {youOffBoard && data?.you ? (
        <p className="ascent-leaderboard-you">
          Your rank: {data.you.rank ?? "—"} · {data.you.points}{" "}
          {data.you.points === 1 ? "point" : "points"}
        </p>
      ) : null}
    </div>
  );
}
