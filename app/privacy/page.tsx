import { site } from "@/lib/site";

export const metadata = {
  title: "Privacy — Altaris Labs",
  description: "How Altaris Labs handles information submitted through this website.",
};

export default function Page() {
  return (
    <section className="section process-intro">
      <div className="container manifesto-grid">
        <p className="eyebrow">Altaris Labs</p>
        <div>
          <h2>Privacy</h2>
          <p className="large-copy">
            The contact form collects your name, email address, and a brief
            project description so we can respond to inquiries. That
            information is sent to brentunderwood@altarislabs.dev and is not
            sold or used for marketing lists.
          </p>
          <p className="large-copy">
            Chess Ascent and Checkers Ascent store progress on the device.
            Each app also creates an account with a public display name such
            as Anonymous_12 so the leaderboard can show you without an email
            address. If you connect an email, Google, or Sign in with Apple,
            we store that email and the sign-in identifier, and the display
            name is replaced. Laurel scores are sent to the server with that
            name. Premium cloud backup, when you use it, stores a copy of the
            progress on the device. You can delete the account from Profile
            in the app. We do not sell this information.
          </p>
          <p className="large-copy">
            The free apps show ads through Google AdMob. Premium removes
            those ads. On iOS the app asks before using a device identifier
            to make ads more relevant. Purchases are handled by Apple or
            Google. We receive the purchase result, not your card number.
            The privacy policy for each app is at
            altarislabs.dev/ascent_games/legal/privacy/chess and
            altarislabs.dev/ascent_games/legal/privacy/checkers. Account
            questions: {site.email}.
          </p>
          <p className="large-copy">
            The Marketplace on this website, when you use it, stores listings
            you upload, items you buy, and the display name on those listings.
            Card payments and seller payouts for that website shop are handled
            by Stripe under its own privacy policy.
          </p>
        </div>
      </div>
    </section>
  );
}
