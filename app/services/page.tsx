import Link from "next/link";

export const metadata = {
  title: "How We Build — Altaris Labs",
  description:
    "A $100 consultation, a written milestone outline, and development paid in stages you can stop after any one of them.",
};

export default function Page() {
  return (
    <>
      <section className="section process-intro">
        <div className="container manifesto-grid">
          <p className="eyebrow">Custom development</p>
          <div>
            <h2>How we build.</h2>
            <p className="large-copy">
              A $100 consultation. A written outline. Then work in paid
              milestones you can stop after any one of them.
            </p>
          </div>
        </div>
      </section>

      <section className="section dark-panel">
        <div className="container process-list">
          <article className="process-step">
            <p className="process-index">01</p>
            <div>
              <p className="eyebrow">Consult</p>
              <h3>Understand the work.</h3>
              <p>
                Every project begins with a $100 product consultation. The
                session lasts anywhere from thirty minutes to a couple of hours,
                depending on the complexity of the app. We use that time to
                understand the idea, the users, the constraints, and what the
                finished product needs to do.
              </p>
              <Link className="text-link" href="/contact">
                Request a consultation →
              </Link>
            </div>
          </article>

          <article className="process-step">
            <p className="process-index">02</p>
            <div>
              <p className="eyebrow">Outline</p>
              <h3>Turn the idea into stages.</h3>
              <p>
                After the consultation, we draft a project outline. The outline
                is a sequence of milestones designed to take the app from a
                basic framework to a fully functional, production-ready product.
                Each milestone states the functionality that will ship, the
                revisions included, and the price.
              </p>
            </div>
          </article>

          <article className="process-step">
            <p className="process-index">03</p>
            <div>
              <p className="eyebrow">Build</p>
              <h3>Pay for the next step. Then we take it.</h3>
              <p>
                Each milestone is paid in full before work begins. We build what
                that milestone defines—no more, no less. The included revisions
                are part of the milestone, not extras to be negotiated later.
              </p>
            </div>
          </article>

          <article className="process-step">
            <p className="process-index">04</p>
            <div>
              <p className="eyebrow">Decide</p>
              <h3>Continue, or stop.</h3>
              <p>
                When a milestone is complete, you choose whether to fund the
                next one. You can continue. You can stop. The work already paid
                for remains yours.
              </p>
            </div>
          </article>

          <article className="process-step">
            <p className="process-index">05</p>
            <div>
              <p className="eyebrow">Support</p>
              <h3>After it ships.</h3>
              <p>
                When the app is finished and ready for production, ongoing
                support and further development are available. They are
                optional. The project can also end there.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="container catalog-policy">
          <p className="eyebrow">The catalog</p>
          <h2>See what this actually costs.</h2>
          <p className="large-copy">
            Some finished projects are listed publicly, with every milestone and
            the total cost to build them. That catalog exists so a prospective
            client can understand pricing from real examples before sending a
            request.
          </p>
          <p className="large-copy">
            A listing includes the completed product and its full
            milestone-by-milestone price. Public exposure is the benefit to the
            listed client. Pricing is part of every listing—not a separate
            option, and not exchanged for a discount.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/work">
              View the Catalog
            </Link>
            <Link className="button secondary" href="/contact">
              Request a Consultation
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
