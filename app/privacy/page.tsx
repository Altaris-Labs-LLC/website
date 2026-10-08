import { site } from "@/lib/site";

export const metadata = {
  title: "Privacy — Altaris Labs",
  description: "How Altaris Labs handles information submitted through this website.",
};

export default function Page() {
  return (
    <section className="section process-intro">
      <div className="container manifesto-grid">
        <p className="eyebrow">Altaris Labs</p>
        <div>
          <h2>Privacy</h2>
          <p className="large-copy">
            The contact form collects your name, email address, and a brief
            project description so we can respond to inquiries. That
            information is sent to brentunderwood@altarislabs.dev and is not
            sold or used for marketing lists.
          </p>
          <p className="large-copy">
            Ascent Games accounts store your email, display name, and a
            password hash (or Google account identifier if you sign in with
            Google) so you can return later. We do not sell this information
            or use it for advertising. You can sign out at any time. Account
            questions: {site.email}.
          </p>
          <p className="large-copy">
            Gold and the Ascent Marketplace: we keep a record of your Gold
            balance, Gold purchases (store transaction or order ids, never card
            numbers), Marketplace listings you upload, items you buy, reports
            you send, and sellers you block. Listing content you upload is
            stored so buyers can download it; your practice progress is never
            uploaded with it. Your display name is shown on your listings.
            Card payments and seller payouts are handled by Stripe, which
            collects payment, identity, bank, and tax details under its own
            privacy policy; we receive only the status of your payout account.
          </p>
        </div>
      </div>
    </section>
  );
}
