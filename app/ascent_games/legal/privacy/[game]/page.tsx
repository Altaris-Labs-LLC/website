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

  const updated = "October 12, 2026";
  const training = game.slug === "chess" || game.slug === "checkers";

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
          {training ? (
            <>
              <p className="large-copy">
                <strong>Information we process.</strong> Game progress, settings,
                and training data are stored on your device. The first time the App
                can reach our server, it creates an account with a public display
                name such as Anonymous_12. That name is shown on the leaderboard
                and in online games. You do not have to give an email address to
                play or to buy Premium. If you create a login, or continue with
                Google or Sign in with Apple, we store the email address and the
                sign-in identifier those services provide, and that name replaces
                Anonymous_12 on the same account. You can delete the account from
                Profile. Deletion removes the account, its leaderboard scores, and
                its cloud backup. An Apple or Google subscription is cancelled in
                that store, not by deleting the account.
              </p>
              <p className="large-copy">
                <strong>Scores and backup.</strong> Laurel scores and puzzle
                contributions are sent to our server so the leaderboard can rank
                them under your display name. If you use Premium cloud backup, a
                copy of the progress on this device is stored with your account so
                you can restore it.
              </p>
              <p className="large-copy">
                <strong>Purchases.</strong> Premium is sold as an auto-renewing
                subscription through Apple or Google. We receive a record that the
                purchase succeeded. We do not receive your card number.
              </p>
              <p className="large-copy">
                <strong>Advertising.</strong> The free App shows ads from Google
                AdMob, including a banner and an occasional full-screen ad. On iOS
                we ask permission before using the device identifier for more
                relevant ads. In the European Economic Area, the United Kingdom,
                and Switzerland, Google’s consent form is shown before ads are
                requested. Premium removes ads. We do not sell your personal
                information.
              </p>
              <p className="large-copy">
                <strong>On-device processing.</strong> Analysis and gameplay logic
                run on your device. That processing stays on the device unless you
                back up, sync a score, or export a file. If you restore a backup
                zip, the App reads only the file you choose.
              </p>
              <p className="large-copy">
                <strong>What we do not do.</strong> We do not sell your personal
                information. An email address is optional. Core play does not
                require you to type one.
              </p>
            </>
          ) : (
            <>
              <p className="large-copy">
                <strong>Information we process.</strong> Core App features work
                without creating an account. Game progress, settings, and related
                training or save data are stored on your device. If you use optional
                device features (for example sharing a file or photo), the App only
                accesses what you choose in that moment.
              </p>
              <p className="large-copy">
                <strong>On-device processing.</strong> Analysis and gameplay logic
                may run locally on your device. That processing stays on your device
                unless you explicitly export or share content.
              </p>
              <p className="large-copy">
                <strong>What we do not do.</strong> We do not sell your personal
                information. We do not use the App to run third-party advertising
                networks. We do not require an Altaris Labs account for core use of
                this App at this time.
              </p>
            </>
          )}
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
            evolves. The “Last updated” date above will change when we do.
          </p>
          <p className="large-copy">
            <strong>Contact.</strong> {privacyContactLine()}
          </p>
        </div>
      </div>
    </section>
  );
}
