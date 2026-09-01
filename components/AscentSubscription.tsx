"use client";

import { useEffect, useState } from "react";

import {
  ASCENT_AUTH_CHANGED,
  fetchCurrentUser,
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

export default function AscentSubscription() {
  const [user, setUser] = useState<AscentUser | null>(null);
  const [ready, setReady] = useState(false);

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
    return () => {
      cancelled = true;
      window.removeEventListener(ASCENT_AUTH_CHANGED, load);
    };
  }, []);

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
              : "Free account. Subscribe in Chess Ascent or Checkers Ascent — it unlocks both apps and this site."}
          </p>
          {sub?.expiresAt && premium && sub.plan !== "lifetime" ? (
            <p className="ascent-sub-copy">
              Renews or ends {formatExpiry(sub.expiresAt)}.
            </p>
          ) : null}
          <div className="ascent-sub-actions">
            {premium && sub?.plan !== "lifetime" && source !== "complimentary" ? (
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
          <h3>{ready ? "Sign in to manage" : "Loading…"}</h3>
          <p className="ascent-sub-copy">
            Ascent Premium is tied to your account. Sign in to see your plan
            and open the store page where billing is managed.
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
                website. Start the subscription in either iOS or Android app
                while signed in.
              </p>
              {current ? (
                <p className="ascent-sub-current">Your current plan</p>
              ) : null}
            </article>
          );
        })}
      </div>

      <p className="ascent-sub-legal">
        Auto-renewable subscriptions are charged through Apple or Google, not
        this website. They renew unless you cancel at least 24 hours before the
        period ends. Use the manage links above, or Account → Subscription in
        the apps.{" "}
        <a href={PRIVACY_URL}>Privacy</a>
        {" · "}
        <a href={TERMS_URL}>Terms</a>
        {" · "}
        <a href={APPLE_EULA_URL}>Apple EULA</a>
      </p>
    </div>
  );
}
