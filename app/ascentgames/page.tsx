import Link from "next/link";

import AscentArt from "@/components/AscentArt";
import { ascentArt } from "@/lib/ascent-site";

const games: {
  name: string;
  icon: string;
  href: string | null;
}[] = [
  {
    name: "Chess Ascent",
    icon: ascentArt.chessIcon,
    href: "/ascentgames/play/chess",
  },
  {
    name: "Checkers Ascent",
    icon: ascentArt.checkersIcon,
    href: null,
  },
];

export const metadata = {
  title: "Ascent Games",
  description:
    "Play timeless classics. Discover something new. Master the games you love. Rise Above the Rest.",
};

export default function Page() {
  return (
    <div className="ascent-home">
      <section className="ascent-hero">
        <AscentArt
          src={ascentArt.hero}
          label="Ascent Games hero"
          hint="Wide welcoming banner. See image notes."
          className="ascent-hero-art"
        />
        <div className="container ascent-hero-copy">
          <p className="ascent-kicker">Welcome in</p>
          <h1>Rise Above the Rest.</h1>
          <p>
            Pull up a chair. Ascent is where familiar games become a craft —
            learn, practice, and climb at your own pace, then come back
            whenever you are ready for another match.
          </p>
        </div>
      </section>

      <section className="ascent-section" id="library">
        <div className="container">
          <p className="ascent-kicker">The library</p>
          <h2>Games with room to grow.</h2>
          <p className="ascent-lead">
            Each title has its own table, its own tools, and the same invitation:
            play well, understand more, and keep rising.
          </p>
          <div className="ascent-app-row">
            {games.map((game) => {
              const body = (
                <>
                  <img src={game.icon} alt="" />
                  <span>{game.name}</span>
                </>
              );
              if (game.href) {
                return (
                  <Link
                    key={game.name}
                    href={game.href}
                    className="ascent-app"
                    aria-label={game.name}
                  >
                    {body}
                  </Link>
                );
              }
              return (
                <div key={game.name} className="ascent-app ascent-app-idle">
                  {body}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="ascent-section" id="premium">
        <div className="container">
          <p className="ascent-kicker">Ascent Premium</p>
          <h2>One plan for every table.</h2>
          <p className="ascent-lead">
            $5.99 a month or $49.99 a year. Subscribe in Chess Ascent or
            Checkers Ascent, then manage billing from your account — including
            this site.
          </p>
          <a className="button primary" href="/ascentgames/subscription">
            View plans and manage
          </a>
        </div>
      </section>

      <section className="ascent-section" id="leaderboard">
        <div className="container">
          <p className="ascent-kicker">The climb</p>
          <h2>See who is rising.</h2>
          <p className="ascent-lead">
            Laurels earned in Chess Ascent and Checkers Ascent count on each
            game&apos;s board, and together on the overall ranking. Daily,
            weekly, monthly, yearly, and all-time — pick a window and climb.
          </p>
          <a className="button primary" href="/ascentgames/leaderboard">
            View the leaderboard
          </a>
        </div>
      </section>
    </div>
  );
}
