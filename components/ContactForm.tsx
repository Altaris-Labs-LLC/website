"use client";

import { FormEvent, useMemo, useState } from "react";
import { site } from "@/lib/site";

const CONFIRMATION_MESSAGE = [
  "Thank you for contacting Altaris Labs.",
  "",
  "We have received your project inquiry and will get back to you shortly. Our average response time is less than 24 hours.",
  "",
  "— Altaris Labs",
].join("\n");

type FormStatus = "idle" | "submitting" | "success" | "error";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [project, setProject] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState("");

  const complete = useMemo(() => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    return name.trim().length > 0 && emailOk && project.trim().length > 0;
  }, [name, email, project]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || status === "submitting") return;

    if (honeypot.trim()) {
      setStatus("success");
      return;
    }

    setStatus("submitting");
    setError("");

    try {
      const response = await fetch(
        `https://formsubmit.co/ajax/${encodeURIComponent(site.email)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            project: project.trim(),
            _subject: "New project inquiry — Altaris Labs",
            _template: "table",
            _captcha: "false",
            _autoresponse: CONFIRMATION_MESSAGE,
          }),
        },
      );

      const result = await response.json().catch(() => null);
      const ok =
        response.ok &&
        (result?.success === true || result?.success === "true");

      if (!ok) {
        throw new Error(
          result?.message ||
            "The request could not be sent. Please try again.",
        );
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "The request could not be sent. Please try again.",
      );
    }
  }

  if (status === "success") {
    return (
      <div className="contact-success" role="status">
        <p className="eyebrow">Request received</p>
        <h3>We will be in touch shortly.</h3>
        <p>
          A confirmation has been sent to your email. Our average response time
          is less than 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit} noValidate>
      <label className="contact-honey" htmlFor="company-website">
        Company website
        <input
          id="company-website"
          name="company-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </label>

      <label className="contact-field">
        <span>Name</span>
        <input
          name="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>

      <label className="contact-field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      <label className="contact-field">
        <span>Project description</span>
        <textarea
          name="project"
          rows={6}
          value={project}
          onChange={(event) => setProject(event.target.value)}
          required
        />
      </label>

      <button
        className="button primary"
        type="submit"
        disabled={!complete || status === "submitting"}
      >
        {status === "submitting" ? "Sending…" : "Send"}
      </button>

      {status === "error" && (
        <p className="contact-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
