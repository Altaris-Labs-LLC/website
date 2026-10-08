import AscentGold from "@/components/AscentGold";

export const metadata = {
  title: "Gold — Ascent Games",
  description:
    "Buy Gold for the Ascent Marketplace, see your balance, and cash out seller earnings.",
};

export default function Page() {
  return (
    <section className="ascent-section ascent-account-page">
      <div className="container ascent-page-layout">
        <div>
          <p className="ascent-kicker">Ascent Gold</p>
          <h2>Buy, spend, and earn.</h2>
          <p className="ascent-lead">
            Gold is the Ascent Marketplace currency. It belongs to your Ascent
            account, so the same balance works in Chess Ascent, Checkers
            Ascent, and here. Every pack includes bonus Laurels. Sellers keep
            50% of each sale and can cash out their earnings.
          </p>
        </div>
        <AscentGold />
      </div>
    </section>
  );
}
