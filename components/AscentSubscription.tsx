"use client";

import { useEffect, useState } from "react";

import {
  ASCENT_AUTH_CHANGED,
  fetchCurrentUser,
  notifyAscentAuthChanged,
  type AscentSubscription as Sub,
  type AscentUser,
} from "@/lib/ascent-auth-client";
import {
  APPLE_EULA_URL,
  APPLE_MANAGE_URL,
  ASCENT_PLANS,
  GOOGLE_MANAGE_URL,
  PRIVACY_URL,
  TERMS_URL,
} from "@/lib/ascent-subscription";

function planTitle(plan: Sub["plan"] | undefined) {
  switch (plan) {
    case "monthly":
      return "Monthly Premium";
    case "yearly":
      return "Yearly Premium";
    case "lifetime":
      return "Lifetime Premium";
    default:
      return "Free";
  }
}

function sourceLabel(source: string | null | undefined) {
  switch (source) {
    case "apple":
      return "App Store";
    case "google":
      return "Google Play";
    case "stripe":
      return "Website";
    case "complimentary":
      return "Complimentary";
    default:
      return source || "Account";
  }
}

function formatExpiry(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const CHECKOUT_APPEARANCE = {
  theme: "stripe",
  labels: "auto",
  inputs: "spaced",
  variables: {
    borderRadius: "4px",
    colorBackground: "#ffffff",
    colorDanger: "#df1b41",
    colorPrimary: "#0570de",
    colorSuccess: "#00c853",
    colorText: "#30313d",
    fontFamily: "default",
    fontSizeBase: "16px",
    spacingUnit: "4px",
  },
};

type StripeCheckoutForm = {
  mount: (selector: string) => void;
  on: (
    event: "confirm",
    handler: (event: unknown) => void | Promise<void>,
  ) => void;
};

type StripeCheckout = {
  createForm: (options: { layout: "expanded" }) => StripeCheckoutForm;
  loadActions: () => Promise<
    | {
        type: "success";
        actions: {
          confirm: (options: { formConfirmEvent: unknown }) => Promise<void>;
        };
      }
    | { type: string }
  >;
};

type StripeFactory = (
  publishableKey: string,
  options: { betas: string[] },
) => {
  initCheckoutFormSdk: (options: {
    clientSecret: Promise<string>;
    appearance: typeof CHECKOUT_APPEARANCE;
  }) => StripeCheckout;
};

declare global {
  interface Window {
    Stripe?: StripeFactory;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(data?.error || "The request could not be completed.");
  }
  return data as T;
}

export default function AscentSubscription() {
  const [user, setUser] = useState<AscentUser | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchCurrentUser()
        .then((current) => {
          if (!cancelled) setUser(current);
        })
        .catch(() => {
          if (!cancelled) setUser(null);
        })
        .finally(() => {
          if (!cancelled) setReady(true);
        });
    };
    load();
    window.addEventListener(ASCENT_AUTH_CHANGED, load);
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("checkout") === "success" && sessionId) {
      postJson("/api/subscription/confirm", { sessionId })
        .then(() => {
          notifyAscentAuthChanged();
          if (!cancelled) setNotice("Premium is active on this account.");
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Checkout could not be confirmed.");
          }
        })
        .finally(() => {
          window.history.replaceState({}, "", "/ascentgames/subscription");
        });
    } else if (params.get("checkout") === "cancel") {
      setNotice("Checkout was canceled. You have not been charged.");
      window.history.replaceState({}, "", "/ascentgames/subscription");
    }
    return () => {
      cancelled = true;
      window.removeEventListener(ASCENT_AUTH_CHANGED, load);
    };
  }, []);

  async function startCheckout(plan: "monthly" | "yearly") {
    setError("");
    setNotice("");
    setBusy(plan);
    try {
      const pending = postJson<{
        client_secret: string;
        session_id: string;
        publishableKey: string;
      }>("/api/subscription/checkout", { plan });
      const clientSecret = pending.then((json) => json.client_secret);
      const data = await pending;
      const Stripe = window.Stripe;
      if (!Stripe) {
        throw new Error("Stripe.js failed to load.");
      }
      const stripe = Stripe(data.publishableKey, {
        betas: ["custom_checkout_payment_form_1"],
      });
      const checkout = stripe.initCheckoutFormSdk({
        clientSecret,
        appearance: CHECKOUT_APPEARANCE,
      });
      const form = checkout.createForm({ layout: "expanded" });
      form.mount("#checkout-form");
      const loadActionsResult = await checkout.loadActions();
      if (loadActionsResult.type === "success" && "actions" in loadActionsResult) {
        form.on("confirm", async (event) => {
          try {
            await loadActionsResult.actions.confirm({ formConfirmEvent: event });
            await postJson("/api/subscription/confirm", { sessionId: data.session_id });
            notifyAscentAuthChanged();
            setNotice("Premium is active on this account.");
          } catch (confirmError) {
            setError(
              confirmError instanceof Error
                ? confirmError.message
                : "Payment confirmation error.",
            );
          }
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Checkout could not be started.");
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setError("");
    setBusy("portal");
    try {
      const data = await postJson<{
        url?: string;
        ended?: boolean;
        message?: string;
      }>("/api/subscription/portal", {});
      if (data.ended) {
        setNotice(
          data.message ||
            "Premium from that checkout has been turned off.",
        );
        notifyAscentAuthChanged();
        setUser(await fetchCurrentUser());
        setBusy(null);
        return;
      }
      if (!data.url) {
        throw new Error("Billing could not be opened.");
      }
      window.location.assign(data.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Billing could not be opened.");
      setBusy(null);
    }
  }

  const sub = user?.subscription;
  const premium = Boolean(sub?.isPremium);
  const source = sub?.source || null;

  return (
    <div className="ascent-sub">
      {ready && user ? (
        <div className="ascent-sub-status">
          <p className="ascent-kicker">Your plan</p>
          <h3>{planTitle(sub?.plan)}</h3>
          <p className="ascent-sub-copy">
            {premium
              ? `Billed through ${sourceLabel(source)}. Premium follows this Ascent account in Chess Ascent, Checkers Ascent, and here.`
              : "Free account. Pay here with a card or PayPal, or subscribe in either app. Premium unlocks both apps and this site."}
          </p>
          {sub?.expiresAt && premium && sub.plan !== "lifetime" ? (
            <p className="ascent-sub-copy">
              Renews or ends {formatExpiry(sub.expiresAt)}.
            </p>
          ) : null}
          <div className="ascent-sub-actions">
            {premium && source === "stripe" && sub?.plan !== "lifetime" ? (
              <button
                type="button"
                className="button primary"
                disabled={busy !== null}
                onClick={() => void openPortal()}
              >
                {busy === "portal" ? "Opening billing…" : "Manage billing"}
              </button>
            ) : null}
            {premium && sub?.plan !== "lifetime" && source !== "complimentary" && source !== "stripe" ? (
              <>
                {(source === "apple" || source == null) ? (
                  <a className="button primary" href={APPLE_MANAGE_URL}>
                    Manage on the App Store
                  </a>
                ) : null}
                {(source === "google" || source == null) ? (
                  <a
                    className={source === "google" ? "button primary" : "button secondary"}
                    href={GOOGLE_MANAGE_URL}
                  >
                    Manage on Google Play
                  </a>
                ) : null}
              </>
            ) : null}
            {source === "complimentary" || sub?.plan === "lifetime" ? (
              <p className="ascent-sub-copy">
                This is a complimentary lifetime plan. There is no billing to
                cancel.
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="ascent-sub-status">
          <p className="ascent-kicker">Your plan</p>
          <h3>{ready ? "Sign in to subscribe" : "Loading…"}</h3>
          <p className="ascent-sub-copy">
            Ascent Premium is tied to your account. Sign in, then pay with a
            card or PayPal. The same Premium unlocks both apps.
          </p>
          {ready ? (
            <div className="ascent-sub-actions">
              <a className="button primary" href="/ascentgames/account">
                Sign in
              </a>
            </div>
          ) : null}
        </div>
      )}

      <div className="ascent-sub-plans">
        {ASCENT_PLANS.map((plan) => {
          const current = premium && sub?.plan === plan.id;
          return (
            <article
              key={plan.id}
              className={
                current ? "ascent-sub-plan is-current" : "ascent-sub-plan"
              }
            >
              <p className="ascent-kicker">{plan.title}</p>
              <h3>
                {plan.price}{" "}
                <span className="ascent-sub-cadence">{plan.cadence}</span>
              </h3>
              <p className="ascent-sub-copy">
                Unlock Premium across Chess Ascent, Checkers Ascent, and the
                website. Card and PayPal payments are collected by Stripe.
              </p>
              {current ? (
                <p className="ascent-sub-current">Your current plan</p>
              ) : user && !premium ? (
                <div className="ascent-sub-actions">
                  <button
                    type="button"
                    className="button primary"
                    disabled={busy !== null}
                    onClick={() => void startCheckout(plan.id)}
                  >
                    {busy === plan.id ? "Opening checkout…" : "Subscribe"}
                  </button>
                </div>
              ) : !user && ready ? (
                <div className="ascent-sub-actions">
                  <a className="button primary" href="/ascentgames/account">
                    Sign in to subscribe
                  </a>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div id="checkout-form" />

      {error ? <p className="ascent-sub-error">{error}</p> : null}
      {notice ? <p className="ascent-sub-notice">{notice}</p> : null}

      <p className="ascent-sub-legal">
        Website subscriptions renew through Stripe until you cancel. Card
        numbers are handled by Stripe, not this site. PayPal checkout is also
        collected by Stripe. App Store and Google Play subscriptions stay with
        those stores. Cancel at least 24 hours before the period ends.{" "}
        <a href={PRIVACY_URL}>Privacy</a>
        {" · "}
        <a href={TERMS_URL}>Terms</a>
        {" · "}
        <a href={APPLE_EULA_URL}>Apple EULA</a>
      </p>
    </div>
  );
}
