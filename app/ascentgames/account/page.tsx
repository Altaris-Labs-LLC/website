import AscentAuth from "@/components/AscentAuth";

export const metadata = {
  title: "Your table — Ascent Games",
  description: "Sign in or create an Ascent Games account. Rise Above the Rest.",
};

export default function Page() {
  return (
    <section className="ascent-section ascent-account-page">
      <div className="container ascent-page-layout">
        <div>
          <p className="ascent-kicker">Your table</p>
          <h2>Save your seat.</h2>
          <p className="ascent-lead">
            Create an Ascent account or log in so this place remembers you —
            on this computer, your phone, or anywhere you come back to play.
          </p>
        </div>
        <AscentAuth />
      </div>
    </section>
  );
}
