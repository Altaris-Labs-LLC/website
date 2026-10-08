import AscentSubscription from "@/components/AscentSubscription";

export const metadata = {
  title: "Subscription — Ascent Games",
  description:
    "Ascent Premium is $5.99 a month or $49.99 a year. Pay with a card or PayPal, or subscribe in the apps.",
};

export default function Page() {
  return (
    <section className="ascent-section ascent-account-page">
      <div className="container ascent-page-layout">
        <div>
          <p className="ascent-kicker">Ascent Premium</p>
          <h2>Subscribe and manage.</h2>
          <p className="ascent-lead">
            One plan unlocks Chess Ascent, Checkers Ascent, and the website.
            Pay here with a card or PayPal, or subscribe in either app while
            signed in. Website payments are collected by Stripe. Change or
            cancel website billing from this page.
          </p>
        </div>
        <AscentSubscription />
      </div>
    </section>
  );
}
