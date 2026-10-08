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
          <h3 id="gold">Gold</h3>
          <p className="large-copy">
            Gold is a virtual currency tied to your Ascent account and usable
            in every Ascent Games app and on this site. Gold is sold in packs
            at one cent per Gold; each pack includes bonus Laurels, an in-game
            currency that does not count toward leaderboards. Gold does not
            expire, has no cash value, and purchased Gold cannot be exchanged
            for money. Purchases made in the App Store or Google Play are
            handled under those stores&apos; refund policies. If a Gold
            purchase is refunded or charged back, the Gold is removed from
            your account; Gold already spent becomes a balance owed that
            blocks spending and cash-outs until repaid.
          </p>
          <h3 id="marketplace">Marketplace seller terms</h3>
          <p className="large-copy">
            Ascent Premium members may list repertoires and lessons they
            created, or have the right to sell, on the Ascent Marketplace for
            a Gold price they choose, including free. Listings are reviewed
            before they appear and may be rejected or removed at any time,
            including in response to a copyright complaint. By listing, you
            grant Altaris Labs a license to host, display, and deliver the
            content to buyers, and each buyer a personal license to use it in
            Ascent Games. Buyers keep access to items they bought if a listing
            is later removed by its seller. Listings are hidden while the
            seller does not have Premium.
          </p>
          <p className="large-copy">
            Sellers receive 50% of the Gold from each sale. Earned Gold can be
            spent like any Gold, or cashed out at one cent per Gold once it is
            at least 14 days old, with a minimum cash-out of 1,000 Gold.
            Cash-outs are reviewed and paid through Stripe; you must complete
            Stripe&apos;s identity, bank, and tax onboarding, and you are
            responsible for any taxes on your earnings. We may withhold or
            reverse earnings tied to refunds, chargebacks, fraud, self-dealing,
            or content that violates these terms. You may not buy your own
            listings or use other accounts to do so.
          </p>
          <p className="large-copy">
            To report a listing that copies your work, use Report in the app
            or email{" "}
            <a className="text-link" href="mailto:brentunderwood@altarislabs.dev">
              brentunderwood@altarislabs.dev
            </a>{" "}
            with the listing title and proof of ownership.
          </p>
        </div>
      </div>
    </section>
  );
}
