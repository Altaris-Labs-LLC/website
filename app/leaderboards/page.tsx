export const metadata = {
  title: "Leaderboards — Ascent Games",
  description: "Ascent Games leaderboards have moved.",
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <section className="ascent-section ascent-account-page">
      <div className="container">
        <p className="ascent-kicker">Ascent Games</p>
        <h2>Leaderboards have moved.</h2>
        <p className="ascent-lead">
          Rankings now live at{" "}
          <a className="text-link" href="/ascentgames/leaderboard">
            altarislabs.dev/ascentgames/leaderboard
          </a>
          .
        </p>
      </div>
    </section>
  );
}
