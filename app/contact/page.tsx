import ContactForm from "@/components/ContactForm";

export const metadata = {
  title: "Contact — Altaris Labs",
  description:
    "Tell Altaris Labs about your project. We typically respond in less than 24 hours.",
};

export default function Page() {
  return (
    <section className="section contact-page">
      <div className="container contact-layout">
        <div>
          <p className="eyebrow">Custom development</p>
          <h2>Tell us about your project.</h2>
          <p className="large-copy">
            Share your name, email, and a brief description of what you want to
            build. We will reply with next steps. Our average response time is
            less than 24 hours.
          </p>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
