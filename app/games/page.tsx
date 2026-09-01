export const metadata = {
  title: "Ascent Games — Altaris Labs",
  description: "Sign in or create an Ascent Games account. Rise Above the Rest.",
};

export default function Page() {
  return (
    <section className="section process-intro">
      <div className="container manifesto-grid">
        <p className="eyebrow">Ascent Games</p>
        <div>
          <h2>Rise Above the Rest.</h2>
          <p className="large-copy">
            Create an account or log in at{" "}
            <a className="text-link" href="/ascentgames">
              altarislabs.dev/ascentgames
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
