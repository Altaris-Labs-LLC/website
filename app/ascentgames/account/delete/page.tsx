import AscentAccountDelete from "@/components/AscentAccountDelete";

export const metadata = {
  title: "Delete your account — Ascent Games",
  description: "Permanently delete your Ascent Games account and stored data.",
};

export default function Page() {
  return (
    <section className="ascent-section ascent-account-page">
      <div className="container ascent-page-layout">
        <div>
          <p className="ascent-kicker">Privacy</p>
          <h2>Delete your Ascent account</h2>
          <p className="ascent-lead">
            This is self-service. Sign in, type delete, and we remove this
            account and the data we store for it.
          </p>
        </div>
        <AscentAccountDelete />
      </div>
    </section>
  );
}
