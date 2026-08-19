import Link from "next/link";

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
              <Link className="button primary" href="/services">Build With Altaris</Link>
              <Link className="button secondary" href="/contact">Contact Us</Link>
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
          <p className="eyebrow">Ascent Games</p>
          <h2 className="ascent-heading">Rise Above the Rest.</h2>
          <p className="ascent-intro">
            Play timeless classics. Discover something new. Master the games you love.
            Ascent Games brings deep, competitive games together in one place—built for
            players who want more than just a match.
          </p>
          <p className="ascent-status">In development. The library is not public yet.</p>

          <div className="ascent-feature-grid">
            <article className="ascent-feature">
              <p className="ascent-feature-label">Discover</p>
              <h3>Find your next game.</h3>
              <p>
                Explore a growing library ranging from familiar classics to games you may
                have never played before. Ascent is built to make discovery part of the
                experience.
              </p>
            </article>
            <article className="ascent-feature">
              <p className="ascent-feature-label">Master</p>
              <h3>Go beyond the rules.</h3>
              <p>
                Learn, practice, analyze, and develop your game with tools designed to help
                you understand more, improve faster, and keep climbing.
              </p>
            </article>
            <article className="ascent-feature">
              <p className="ascent-feature-label">Compete</p>
              <h3>Put yourself to the test.</h3>
              <p>
                Face other players, machines, challenges, quests, rankings, and whatever
                comes next. Every game is another opportunity to rise.
              </p>
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
              From there, work proceeds in paid milestones you can stop after any
              one of them.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/services">How We Build</Link>
              <Link className="button secondary" href="/contact">Contact Us</Link>
            </div>
            <p className="home-work-link">
              <Link className="text-link" href="/work">See past work →</Link>
            </p>
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
