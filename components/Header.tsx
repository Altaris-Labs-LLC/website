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
          <Link href="/services">Services</Link>
          <Link href="/work">Work</Link>
          <Link href="/about">About</Link>
          <Link className="nav-cta" href="/contact">Contact</Link>
        </nav>
      </div>
    </header>
  );
}
