import { notFound } from "next/navigation";

import {
  getAscentPrivacyGame,
  ascentPrivacyGames,
  privacyContactLine,
  privacyLegalEntity,
} from "@/lib/ascent-privacy";

type Props = {
  params: Promise<{ game: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return ascentPrivacyGames.map((game) => ({ game: game.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { game: slug } = await params;
  const game = getAscentPrivacyGame(slug);
  const name = game?.productName ?? "Ascent Games";
  return {
    title: `Privacy — ${name}`,
    description: `Privacy policy for ${name}.`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: Props) {
  const { game: slug } = await params;
  const game = getAscentPrivacyGame(slug);

  if (!game) {
    notFound();
  }

  const updated = "August 28, 2026";

  return (
    <section className="section process-intro">
      <div className="container manifesto-grid">
        <p className="eyebrow">Ascent Games · Legal</p>
        <div>
          <h2>{game.productName} Privacy Policy</h2>
          <p className="large-copy">{game.summary}</p>
          <p className="large-copy">
            This policy describes how {privacyLegalEntity()} (“we”) handles
            information in connection with {game.productName} (the “App”).
            Last updated: {updated}.
          </p>
          <p className="large-copy">
            <strong>Information we process.</strong> Core App features work
            without creating an account. Game progress, settings, and related
            training or save data are stored on your device. If you use optional
            device features (for example sharing a file or photo), the App only
            accesses what you choose in that moment.
          </p>
          <p className="large-copy">
            <strong>On-device processing.</strong> Analysis and gameplay logic
            may run locally on your device (including engine calculation). That
            processing stays on your device unless you explicitly export or
            share content.
          </p>
          <p className="large-copy">
            <strong>What we do not do.</strong> We do not sell your personal
            information. We do not use the App to run third-party advertising
            networks. We do not require an Altaris Labs account for core use of
            this App at this time.
          </p>
          <p className="large-copy">
            <strong>Beta / TestFlight builds.</strong> If you install a beta
            through Apple TestFlight, Apple may process installation and crash
            diagnostic information under Apple’s terms. We use TestFlight only
            to distribute pre-release builds.
          </p>
          <p className="large-copy">
            <strong>Children.</strong> The App is not directed at children under
            13, and we do not knowingly collect personal information from
            children under 13.
          </p>
          <p className="large-copy">
            <strong>Changes.</strong> We may update this policy as the App
            evolves (for example if cloud sync or accounts are added). The
            “Last updated” date above will change when we do.
          </p>
          <p className="large-copy">
            <strong>Contact.</strong> {privacyContactLine()}
          </p>
        </div>
      </div>
    </section>
  );
}
