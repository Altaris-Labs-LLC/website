import Link from "next/link";

export default function Header() {
  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <Link className="brand" href="/" aria-label="Altaris Labs home">
          <span className="brand-mark">▲</span>
          <span>ALTARIS LABS</span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/games">Ascent Games</Link>
          <Link href="/services">Services</Link>
          <Link href="/leaderboards">Leaderboards</Link>
          <Link href="/about">About</Link>
          <Link className="nav-cta" href="/account">Sign In</Link>
        </nav>
      </div>
    </header>
  );
}
