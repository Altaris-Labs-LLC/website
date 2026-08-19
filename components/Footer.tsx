import Link from "next/link";
import { site } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <div className="footer-brand">ALTARIS LABS</div>
          <p className="footer-copy">
            Building software, games, and digital products around progression,
            mastery, and meaningful challenge.
          </p>
        </div>
        <div className="footer-links">
          <Link href="/games">Ascent Games</Link>
          <Link href="/services">Services</Link>
          <Link href="/work">Work</Link>
          <Link href="/about">About</Link>
          <Link href="/support">Support</Link>
        </div>
        <div className="footer-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href={`mailto:${site.email}`}>{site.email}</a>
        </div>
      </div>
      <div className="container footer-bottom">© 2026 {site.legalName}</div>
    </footer>
  );
}
