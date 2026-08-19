import Link from "next/link";

export const metadata = {
  title: "About — Altaris Labs",
  description:
    "Altaris Labs LLC is an independent California software company building products and custom applications.",
};

export default function Page() {
  return (
    <section className="section process-intro">
      <div className="container manifesto-grid">
        <p className="eyebrow">Altaris Labs</p>
        <div>
          <h2>An independent software company.</h2>
          <p className="large-copy">
            Altaris Labs LLC builds ambitious software: our own products, and
            applications we create for clients. The through-line is progress,
            mastery, and work that is built to achieve.
          </p>
          <p className="large-copy">
            Ascent Games is in development. Custom development is available
            now, beginning with a $100 product consultation.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/services">
              How We Build
            </Link>
            <Link className="button secondary" href="/contact">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
