import Link from "next/link";

import { altarisSupportEmail } from "@/lib/ascent-support";
import { site } from "@/lib/site";

export const metadata = {
  title: "Support — Altaris Labs",
  description:
    "Get help with Ascent Games apps, or contact Altaris Labs about custom software development.",
};

/**
 * Company support hub: routes people to product support (Ascent) or
 * custom-development support (Altaris Labs services). Individual apps live
 * under /ascentgames/support/[app] so App Store Support URLs stay stable
 * as the catalog grows.
 */
export default function Page() {
  const companyEmail = altarisSupportEmail();

  return (
    <section className="section process-intro">
      <div className="container">
        <p className="eyebrow">Altaris Labs</p>
        <h2>How can we help?</h2>
        <p className="large-copy">
          Altaris Labs builds custom software and publishes Ascent Games.
          Choose the path that matches what you need — product support for
          our apps, or project support if you are building with us.
        </p>

        <div className="support-path-grid">
          <article className="support-path-card">
            <p className="eyebrow">Ascent Games</p>
            <h3>App support</h3>
            <p>
              Help with Chess Ascent, Checkers Ascent, Premium, accounts, and
              other titles in the Ascent library.
            </p>
            <Link className="button primary" href="/ascentgames/support">
              Browse Ascent support
            </Link>
          </article>

          <article className="support-path-card">
            <p className="eyebrow">Custom development</p>
            <h3>Build with Altaris</h3>
            <p>
              Questions about a project, proposal, or engagement with{" "}
              {site.legalName}. We typically reply within 24 hours.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/contact">
                Contact form
              </Link>
              <a className="button secondary" href={`mailto:${companyEmail}`}>
                Email us
              </a>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
