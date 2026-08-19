import Link from "next/link";

export const metadata = {
  title: "$100 Product Consultation — Altaris Labs",
  description:
    "A $100 consultation lasting thirty minutes to a couple of hours, depending on the complexity of the app.",
};

export default function Page() {
  return (
    <section className="section process-intro">
      <div className="container manifesto-grid">
        <p className="eyebrow">Custom development</p>
        <div>
          <h2>$100 product consultation.</h2>
          <p className="large-copy">
            A focused session to understand the idea, the users, the
            requirements, and the path to a finished product. It lasts anywhere
            from thirty minutes to a couple of hours, depending on the
            complexity of the app.
          </p>
          <p className="large-copy">
            After the consultation, we draft a milestone outline. Each
            milestone is paid up front, with defined functionality and a set
            number of revisions. You choose whether to fund the next one.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/contact">
              Request a Consultation
            </Link>
            <Link className="button secondary" href="/services">
              How We Build
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
