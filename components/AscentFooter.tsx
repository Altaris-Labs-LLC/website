import Link from "next/link";

import AscentAccountLink from "@/components/AscentAccountLink";

export default function AscentFooter() {
  return (
    <footer className="ascent-footer">
      <div className="container ascent-footer-inner">
        <div>
          <p className="ascent-footer-brand">Ascent Games</p>
          <p className="ascent-footer-copy">
            Rise Above the Rest. A home for the games you want to master.
          </p>
        </div>
        <div className="ascent-footer-links">
          <AscentAccountLink />
          <Link href="/ascentgames#library">Games</Link>
          <Link href="/ascentgames/subscription">Subscription</Link>
          <Link href="/ascentgames/leaderboard">Leaderboard</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </div>
      <div className="ascent-leave-panel">
        <div className="container ascent-leave-panel-inner">
          <div>
            <p className="ascent-leave-kicker">You are leaving Ascent Games</p>
            <p className="ascent-leave-title">Altaris Labs</p>
          </div>
          <Link className="ascent-leave-button" href="/">
            Return to Altaris Labs
          </Link>
        </div>
      </div>
    </footer>
  );
}
