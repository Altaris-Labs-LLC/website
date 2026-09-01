import Link from "next/link";

import AscentAccountLink from "@/components/AscentAccountLink";
import AscentArt from "@/components/AscentArt";
import { ascentArt } from "@/lib/ascent-site";

export default function AscentHeader() {
  return (
    <header className="ascent-header">
      <div className="container ascent-nav">
        <Link className="ascent-brand" href="/ascentgames" aria-label="Ascent Games home">
          <AscentArt
            src={ascentArt.mark}
            label="Ascent Games mark"
            hint="Small emblem for the header. See image notes."
            className="ascent-brand-mark"
          />
          <span>Ascent Games</span>
        </Link>
        <nav className="ascent-nav-links" aria-label="Ascent">
          <Link href="/ascentgames#library">Games</Link>
          <Link href="/ascentgames/subscription">Subscription</Link>
          <Link href="/ascentgames/leaderboard">Leaderboard</Link>
          <AscentAccountLink />
        </nav>
        <Link className="ascent-leave" href="/" title="Leave Ascent Games">
          <span className="ascent-leave-kicker">Leaving Ascent</span>
          Altaris Labs
        </Link>
      </div>
    </header>
  );
}
