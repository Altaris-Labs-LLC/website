import Link from "next/link";

import {
  ascentSupportApps,
  ascentSupportEmail,
  ascentSupportPath,
} from "@/lib/ascent-support";

export const metadata = {
  title: "Support — Ascent Games",
  description:
    "Support for Chess Ascent, Checkers Ascent, and other Ascent Games titles. Accounts, Premium, and in-app help.",
};

export default function Page() {
  const feedbackEmail = ascentSupportEmail();

  return (
    <div className="ascent-home">
      <section className="ascent-section">
        <div className="container">
          <p className="ascent-kicker">Support</p>
          <h2>Help for every table.</h2>
          <p className="ascent-lead">
            Pick your game for product-specific help. Shared topics like
            Premium, sign-in, and cloud backup are covered on each app page —
            and you can always reach us from inside the app.
          </p>

          <div className="ascent-support-grid">
            {ascentSupportApps.map((app) => (
              <article key={app.slug} className="ascent-support-card">
                <p className="ascent-kicker">{app.productName}</p>
                <h3>{app.productName} support</h3>
                <p>{app.summary}</p>
                <Link
                  className="button primary"
                  href={ascentSupportPath(app.slug)}
                >
                  Open {app.productName} help
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ascent-section" id="shared">
        <div className="container">
          <p className="ascent-kicker">Across Ascent</p>
          <h2>Shared account help.</h2>
          <p className="ascent-lead">
            One Ascent account works across our games. Manage Premium on the
            Subscription page, or send feedback from More → Feedback in the
            app.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/ascentgames/subscription">
              Subscription &amp; account
            </Link>
            <Link className="button secondary" href="/ascentgames/account">
              Sign in
            </Link>
            <a className="button secondary" href={`mailto:${feedbackEmail}`}>
              Email {feedbackEmail}
            </a>
          </div>
          <p className="ascent-lead" style={{ marginTop: "1.5rem" }}>
            Looking for Altaris Labs custom development instead?{" "}
            <Link className="text-link" href="/support">
              Return to company support
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
