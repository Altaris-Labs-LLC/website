export const metadata = {
  title: "Terms — Altaris Labs",
  description: "Terms for using the Altaris Labs website and requesting custom development.",
};

export default function Page() {
  return (
    <section className="section process-intro">
      <div className="container manifesto-grid">
        <p className="eyebrow">Altaris Labs</p>
        <div>
          <h2>Terms</h2>
          <p className="large-copy">
            This website is provided by Altaris Labs LLC to describe our
            company, products, and custom development services. Submitting a
            consultation request is an inquiry, not a contract.
          </p>
          <p className="large-copy">
            Custom development proceeds under a written project outline and
            paid milestones. Each milestone is a separate engagement: work
            begins after payment for that milestone, and you choose whether to
            fund the next one.
          </p>
          <p className="large-copy">
            Ascent Games accounts on this site are for identifying you when
            you return. The game library is still in development. Do not use
            an Ascent account if you are under 13.
          </p>
          <p className="large-copy">
            Ascent Premium is an auto-renewable subscription sold in the iOS
            and Android apps: $5.99 per month or $49.99 per year. Payment is
            charged to your Apple ID or Google Play account at confirmation.
            The subscription renews unless you cancel at least 24 hours before
            the current period ends. Manage or cancel in Account →
            Subscription in the app, on{" "}
            <a className="text-link" href="/ascentgames/subscription">
              altarislabs.dev/ascentgames/subscription
            </a>
            , or in your App Store or Google Play subscription settings.
            Complimentary lifetime access has no recurring charge. Apple
            Standard EULA:{" "}
            <a
              className="text-link"
              href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
            >
              apple.com/legal/internet-services/itunes/dev/stdeula
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
