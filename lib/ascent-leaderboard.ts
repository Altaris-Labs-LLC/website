export type LeaderboardPeriod =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "all";

export type LeaderboardGame = "all" | "chess" | "checkers";

export type LeaderboardRow = {
  rank: number;
  displayName: string;
  points: number;
  isYou: boolean;
};

export type LeaderboardYou = {
  rank: number | null;
  displayName: string;
  points: number;
};

export type LeaderboardResponse = {
  game: LeaderboardGame;
  period: LeaderboardPeriod;
  rows: LeaderboardRow[];
  you: LeaderboardYou | null;
  error?: string;
};

export async function fetchLeaderboard(
  game: LeaderboardGame,
  period: LeaderboardPeriod,
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams({ game, period });
  const response = await fetch(`/api/leaderboard?${params}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const data = (await response.json().catch(() => null)) as LeaderboardResponse | null;
  if (!response.ok || !data) {
    throw new Error(data?.error || "The leaderboard could not be loaded.");
  }
  return data;
}
