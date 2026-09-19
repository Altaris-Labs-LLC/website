import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ascentSupportApps,
  ascentSupportEmail,
  getAscentSupportApp,
} from "@/lib/ascent-support";

type Props = {
  params: Promise<{ app: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return ascentSupportApps.map((app) => ({ app: app.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { app: slug } = await params;
  const app = getAscentSupportApp(slug);
  const name = app?.productName ?? "Ascent Games";
  return {
    title: `Support — ${name}`,
    description: `Get help with ${name}: accounts, Premium, backups, training, and feedback.`,
  };
}

export default async function Page({ params }: Props) {
  const { app: slug } = await params;
  const app = getAscentSupportApp(slug);
  if (!app) notFound();

  const feedbackEmail = ascentSupportEmail();
  const privacyHref = `/ascent_games/legal/privacy/${app.slug}`;

  return (
    <div className="ascent-home">
      <section className="ascent-section">
        <div className="container">
          <p className="ascent-kicker">Ascent Games · Support</p>
          <h2>{app.productName} support</h2>
          <p className="ascent-lead">{app.summary}</p>

          <h3 style={{ marginTop: "2rem" }}>Fastest way to reach us</h3>
          <p className="ascent-lead">
            In the app, open <strong>More → Feedback</strong> to report a bug
            or suggest a feature. That sends details straight to our team.
            You can also email{" "}
            <a className="text-link" href={`mailto:${feedbackEmail}`}>
              {feedbackEmail}
            </a>
            .
          </p>

          <h3 style={{ marginTop: "2rem" }}>Common topics</h3>
          <ul className="ascent-support-topics">
            {app.helpTopics.map((topic) => (
              <li key={topic}>{topic}</li>
            ))}
          </ul>

          <div className="hero-actions" style={{ marginTop: "1.75rem" }}>
            <Link className="button primary" href="/ascentgames/subscription">
              Manage Premium
            </Link>
            <Link className="button secondary" href="/ascentgames/account">
              Account
            </Link>
            <Link className="button secondary" href={privacyHref}>
              Privacy policy
            </Link>
            <Link className="button secondary" href="/terms">
              Terms
            </Link>
          </div>

          <p className="ascent-lead" style={{ marginTop: "2rem" }}>
            <Link className="text-link" href="/ascentgames/support">
              ← All Ascent Games support
            </Link>
            {" · "}
            <Link className="text-link" href="/support">
              Altaris Labs support
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
