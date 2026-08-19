import Link from "next/link";

export const metadata = {
  title: "Support — Altaris Labs",
  description: "How to reach Altaris Labs for development inquiries.",
};

export default function Page() {
  return (
    <section className="section process-intro">
      <div className="container manifesto-grid">
        <p className="eyebrow">Altaris Labs</p>
        <div>
          <h2>Support</h2>
          <p className="large-copy">
            For custom development, use the contact form. We typically respond
            in less than 24 hours.
          </p>
          <p className="large-copy">
            Product-specific support for Ascent Games will be added as those
            apps enter beta.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/contact">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
