"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import {
  fetchAuthConfig,
  fetchCurrentUser,
  logIn,
  logInWithGoogle,
  logOut,
  notifyAscentAuthChanged,
  signUp,
  type AscentUser,
} from "@/lib/ascent-auth-client";

type Mode = "login" | "signup";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            ux_mode?: string;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme: string;
              size: string;
              text: string;
              width: number;
              shape?: string;
            },
          ) => void;
        };
      };
    };
  }
}

function formatJoined(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function subscriptionLabel(
  subscription: AscentUser["subscription"],
) {
  if (!subscription || !subscription.isPremium) {
    return "Free account. Subscribe in Chess Ascent or Checkers Ascent.";
  }
  if (subscription.plan === "lifetime") return "Ascent Premium · lifetime";
  if (subscription.plan === "yearly") return "Ascent Premium · yearly";
  if (subscription.plan === "monthly") return "Ascent Premium · monthly";
  return "Ascent Premium";
}

export default function AscentAuth() {
  const [mode, setMode] = useState<Mode>("login");
  const [user, setUser] = useState<AscentUser | null>(null);
  const [ready, setReady] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState("");
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCurrentUser(), fetchAuthConfig()])
      .then(([current, config]) => {
        if (cancelled) return;
        setUser(current);
        setGoogleClientId(config.googleClientId);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || user || !googleClientId || !googleButtonRef.current) return;

    const mountButton = () => {
      const host = googleButtonRef.current;
      if (!host || !window.google?.accounts?.id) return;
      host.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        ux_mode: "popup",
        callback: async (response) => {
          if (!response.credential) return;
          setError("");
          setStatus("submitting");
          try {
            setUser(await logInWithGoogle(response.credential));
            notifyAscentAuthChanged();
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Google sign-in could not be completed.",
            );
          } finally {
            setStatus("idle");
          }
        },
      });
      window.google.accounts.id.renderButton(host, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        width: Math.max(host.offsetWidth || 320, 240),
        shape: "rectangular",
      });
    };

    if (window.google?.accounts?.id) {
      mountButton();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existing) {
      existing.addEventListener("load", mountButton);
      return () => existing.removeEventListener("load", mountButton);
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", mountButton);
    document.head.appendChild(script);
    return () => script.removeEventListener("load", mountButton);
  }, [googleClientId, ready, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    setError("");

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setStatus("submitting");
    try {
      const nextUser =
        mode === "signup"
          ? await signUp({ email, password, displayName })
          : await logIn({ email, password });
      setUser(nextUser);
      setPassword("");
      setConfirmPassword("");
      notifyAscentAuthChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The request could not be completed.",
      );
    } finally {
      setStatus("idle");
    }
  }

  async function handleLogout() {
    setStatus("submitting");
    setError("");
    try {
      await logOut();
      setUser(null);
      notifyAscentAuthChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign out.");
    } finally {
      setStatus("idle");
    }
  }

  if (!ready) {
    return (
      <div className="auth-card">
        <p className="eyebrow">Your table</p>
        <p className="auth-muted">Loading…</p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="auth-card">
        <p className="eyebrow">Signed in</p>
        <div className="auth-profile">
          {user.avatarUrl ? (
            <img
              className="auth-avatar"
              src={user.avatarUrl}
              alt=""
              width={56}
              height={56}
            />
          ) : (
            <div className="auth-avatar auth-avatar-fallback" aria-hidden="true">
              {user.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h3>{user.displayName}</h3>
            <p className="auth-muted">{user.email}</p>
            <p className="auth-muted">Joined {formatJoined(user.createdAt)}</p>
            <p className="auth-muted">
              {subscriptionLabel(user.subscription)}
            </p>
          </div>
        </div>
        <p className="auth-copy">
          Your seat is saved. Come back from any device and pick up where you
          left off. Premium bought in either app unlocks both.
        </p>
        <a className="button primary" href="/ascentgames/subscription">
          Manage subscription
        </a>
        <button
          className="button secondary"
          type="button"
          onClick={handleLogout}
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "Signing out…" : "Sign out"}
        </button>
        {error ? (
          <p className="contact-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="auth-card">
      <p className="eyebrow">Your table</p>
      <div className="auth-tabs" role="tablist" aria-label="Account">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={mode === "login" ? "auth-tab active" : "auth-tab"}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          Log in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={mode === "signup" ? "auth-tab active" : "auth-tab"}
          onClick={() => {
            setMode("signup");
            setError("");
          }}
        >
          Sign up
        </button>
      </div>

      <form className="contact-form auth-form" onSubmit={handleSubmit} noValidate>
        {mode === "signup" ? (
          <label className="contact-field">
            <span>Display name</span>
            <input
              name="displayName"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </label>
        ) : null}

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
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>

        {mode === "signup" ? (
          <label className="contact-field">
            <span>Confirm password</span>
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
        ) : null}

        <button
          className="button primary"
          type="submit"
          disabled={status === "submitting"}
        >
          {status === "submitting"
            ? mode === "signup"
              ? "Creating account…"
              : "Signing in…"
            : mode === "signup"
              ? "Create account"
              : "Log in"}
        </button>

        {error ? (
          <p className="contact-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {googleClientId ? (
        <>
          <div className="auth-divider">
            <span>or</span>
          </div>
          <div ref={googleButtonRef} className="auth-google" />
        </>
      ) : null}
    </div>
  );
}
