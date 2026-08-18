import Link from "next/link";
import { site } from "@/lib/site";

export default function Home() {
  return (
    <>
      <section className="hero hero-image">
        <div className="hero-image-overlay" />
        <div className="container hero-content">
          <div className="hero-copy-block">
            <p className="eyebrow">Independent software company</p>
            <h1>Build.<br/>Master.<br/>Ascend.</h1>
            <p className="hero-copy">
              Altaris Labs creates ambitious software built to achieve—products that
              bring your goals within reach.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/games">Explore Ascent Games</Link>
              <Link className="button secondary" href="/services">Build With Altaris</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container manifesto-grid">
          <p className="eyebrow">The Altaris principle</p>
          <div>
            <h2>Progress should be visible.</h2>
            <p className="large-copy">
              We design systems that turn challenge into momentum. Whether we are building
              our own products or yours, every experience should make the next step clear,
              meaningful, and worth pursuing.
            </p>
          </div>
        </div>
      </section>

      <section className="section dark-panel">
        <div className="container">
          <div className="section-topline">
            <div>
              <p className="eyebrow">Product ecosystem</p>
              <h2>Ascent Games</h2>
            </div>
            <Link className="text-link" href="/games">Explore the ecosystem →</Link>
          </div>

          <div className="feature-grid">
            <article className="feature-card feature-card-large">
              <span className="card-index">01</span>
              <h3>One account.<br/>Progress everywhere.</h3>
              <p>
                Play across the Ascent family while your account level, Laurels,
                achievements, and leaderboard standing follow you from game to game.
              </p>
              <Link className="text-link" href="/account">Ascent Account →</Link>
            </article>
            <article className="feature-card">
              <span className="card-index">02</span>
              <h3>Master each game.</h3>
              <p>Training, competition, progression, and discovery built into each experience.</p>
              <Link className="text-link" href="/games">View Games →</Link>
            </article>
            <article className="feature-card">
              <span className="card-index">03</span>
              <h3>Rise together.</h3>
              <p>Cross-game rankings and achievements turn individual play into a larger journey.</p>
              <Link className="text-link" href="/leaderboards">Leaderboards →</Link>
            </article>
          </div>
        </div>
      </section>

      <section className="section services-home">
        <div className="container service-split">
          <div>
            <p className="eyebrow">Custom development</p>
            <h2>Your idea.<br/>Built by Altaris.</h2>
          </div>
          <div>
            <p className="large-copy">
              Need an app of your own? Start with a $100 product consultation.
              From there, development is scoped into transparent, milestone-based work.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/services">How We Build</Link>
              <a className="button secondary" href={`mailto:${site.email}`}>Contact Us</a>
            </div>
          </div>
        </div>
      </section>

      <section className="closing-summit">
        <div className="container closing-inner">
          <p className="eyebrow">Altaris Labs</p>
          <h2>There is always<br/>a next summit.</h2>
        </div>
      </section>
    </>
  );
}
