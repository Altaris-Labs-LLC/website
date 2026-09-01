export const metadata = {
  title: "Account — Ascent Games",
  description: "Sign in or create an Ascent Games account.",
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <section className="section process-intro">
      <div className="container manifesto-grid">
        <p className="eyebrow">Ascent Games</p>
        <div>
          <h2>Accounts have moved.</h2>
          <p className="large-copy">
            Sign in and create an account at{" "}
            <a className="text-link" href="/ascentgames/account">
              altarislabs.dev/ascentgames/account
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
