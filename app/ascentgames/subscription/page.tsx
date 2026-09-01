import AscentSubscription from "@/components/AscentSubscription";

export const metadata = {
  title: "Subscription — Ascent Games",
  description:
    "Ascent Premium is $5.99 a month or $49.99 a year. Subscribe in the apps and manage billing here.",
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
            Start checkout in either app while signed in. Change or cancel from
            this page — Apple and Google keep the actual billing, as their
            stores require.
          </p>
        </div>
        <AscentSubscription />
      </div>
    </section>
  );
}
