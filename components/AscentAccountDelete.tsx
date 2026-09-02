"use client";

import { FormEvent, useEffect, useState } from "react";

import AscentAuth from "@/components/AscentAuth";
import {
  ASCENT_AUTH_CHANGED,
  deleteAccount,
  fetchCurrentUser,
  notifyAscentAuthChanged,
  type AscentUser,
} from "@/lib/ascent-auth-client";

export default function AscentAccountDelete() {
  const [user, setUser] = useState<AscentUser | null>(null);
  const [ready, setReady] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const current = await fetchCurrentUser();
        if (!cancelled) setUser(current);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    load();
    const onAuth = () => {
      void load();
    };
    window.addEventListener(ASCENT_AUTH_CHANGED, onAuth);
    return () => {
      cancelled = true;
      window.removeEventListener(ASCENT_AUTH_CHANGED, onAuth);
    };
  }, []);

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting" || confirmation !== "delete") return;
    setError("");
    setStatus("submitting");
    try {
      await deleteAccount("delete");
      setDeleted(true);
      setUser(null);
      notifyAscentAuthChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The account could not be deleted.",
      );
    } finally {
      setStatus("idle");
    }
  }

  if (!ready) {
    return (
      <div className="auth-card">
        <p className="auth-muted">Loading…</p>
      </div>
    );
  }

  if (deleted) {
    return (
      <div className="auth-card">
        <p className="eyebrow">Deleted</p>
        <h3>Your Ascent account is gone.</h3>
        <p className="auth-copy">
          We removed your email, display name, Google sign-in identifier,
          leaderboard points, and subscription records we stored. Apple and
          Google keep their own purchase history. Cancel a paid plan in App
          Store or Play Store settings if you still have one.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <p className="ascent-lead">
          Sign in with the account you want to delete. Only that signed-in
          account can be removed.
        </p>
        <AscentAuth />
      </div>
    );
  }

  const canDelete = confirmation === "delete" && status !== "submitting";

  return (
    <div className="auth-card">
      <p className="eyebrow">Signed in as</p>
      <h3>{user.displayName}</h3>
      <p className="auth-muted">{user.email}</p>
      <p className="auth-copy">
        This permanently deletes this Ascent account: email, display name,
        Google sign-in identifier, leaderboard points, and subscription records
        we keep. It cannot be undone. Apple and Google keep their own purchase
        records; cancel those in store settings if needed. Progress stored only
        on a device stays until you uninstall or clear app data.
      </p>
      <form className="contact-form auth-form" onSubmit={handleDelete}>
        <label className="contact-field">
          <span>Type delete to confirm</span>
          <input
            name="confirmation"
            type="text"
            autoComplete="off"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            spellCheck={false}
            required
          />
        </label>
        <button className="button primary" type="submit" disabled={!canDelete}>
          {status === "submitting" ? "Deleting…" : "Delete my account"}
        </button>
        {error ? (
          <p className="contact-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
