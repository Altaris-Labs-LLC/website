export const metadata = {
  title: "Chess — Ascent Games",
  description: "Ascent Chess is in development.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <section className="section process-intro">
      <div className="container manifesto-grid">
        <p className="eyebrow">Ascent Games</p>
        <div>
          <h2>Chess is in development.</h2>
          <p className="large-copy">
            A deep chess experience built around deliberate improvement. It is
            not public yet.
          </p>
        </div>
      </div>
    </section>
  );
}
