import AscentMarketAdmin from "@/components/AscentMarketAdmin";

export const metadata = {
  title: "Marketplace review — Ascent Games",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <section className="ascent-section ascent-account-page">
      <div className="container">
        <p className="ascent-kicker">Admin</p>
        <h2>Marketplace review</h2>
        <AscentMarketAdmin />
      </div>
    </section>
  );
}
