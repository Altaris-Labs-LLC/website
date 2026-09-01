import AscentLeaderboard from "@/components/AscentLeaderboard";

export const metadata = {
  title: "Leaderboard — Ascent Games",
  description:
    "See who is climbing Chess Ascent, Checkers Ascent, and the overall Ascent Games leaderboard.",
};

export default function Page() {
  return (
    <section className="ascent-section ascent-account-page">
      <div className="container ascent-page-layout">
        <div>
          <p className="ascent-kicker">The climb</p>
          <h2>Leaderboard.</h2>
          <p className="ascent-lead">
            Each laurel earned in an Ascent app is one point on that game&apos;s
            board. The overall ranking is the sum across every game. Switch
            between today, this week, this month, this year, or all time.
          </p>
        </div>
        <AscentLeaderboard />
      </div>
    </section>
  );
}
