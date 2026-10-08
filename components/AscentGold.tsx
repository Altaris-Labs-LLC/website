"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ASCENT_AUTH_CHANGED,
  fetchCurrentUser,
  type AscentUser,
} from "@/lib/ascent-auth-client";
import { PRIVACY_URL, TERMS_URL } from "@/lib/ascent-subscription";

type Wallet = {
  balance: number;
  purchased: number;
  earned: number;
  clearing: number;
  pendingCashOut: number;
  debt: number;
  payoutsReady: boolean;
  payoutAccount: boolean;
  unclaimedLaurels: number;
  minCashOutGold: number;
  payoutCentsPerGold: number;
  clearingDays: number;
};

type Pack = { id: string; gold: number; laurels: number; usdCents: number };

/** Shown before sign-in; the server's list replaces it once the wallet loads. */
const DEFAULT_PACKS: Pack[] = [
  { id: "500", gold: 500, laurels: 1000, usdCents: 500 },
  { id: "2000", gold: 2000, laurels: 5000, usdCents: 2000 },
  { id: "10000", gold: 10000, laurels: 50000, usdCents: 10000 },
];

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error || "The request could not be completed.");
  return data as T;
}

const gold = (n: number) => n.toLocaleString("en-US");
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function AscentGold() {
  const [user, setUser] = useState<AscentUser | null>(null);
  const [ready, setReady] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [packs, setPacks] = useState<Pack[]>(DEFAULT_PACKS);
  const [busy, setBusy] = useState<string | null>(null);
  const [cashOut, setCashOut] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadWallet = useCallback(async () => {
    try {
      const data = await api<{ wallet: Wallet; packs: Pack[] }>("/api/gold/wallet");
      setWallet(data.wallet);
      setPacks(data.packs);
    } catch {
      setWallet(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const current = await fetchCurrentUser().catch(() => null);
      if (cancelled) return;
      setUser(current);
      if (current) await loadWallet();
      if (!cancelled) setReady(true);
    };
    void load();
    window.addEventListener(ASCENT_AUTH_CHANGED, load);

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("checkout") === "success" && sessionId) {
      api<{ wallet: Wallet }>("/api/gold/confirm", { sessionId })
        .then((data) => {
          if (cancelled) return;
          setWallet(data.wallet);
          setNotice(
            "Gold added to your account. Bonus Laurels arrive the next time you open an Ascent app.",
          );
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Checkout could not be confirmed.");
          }
        });
    } else if (params.get("checkout") === "cancel") {
      setNotice("Checkout was canceled. You have not been charged.");
    } else if (params.get("payouts") === "done") {
      setNotice("Payout details saved. Stripe may take a moment to finish verifying them.");
    } else if (params.get("payouts") === "refresh") {
      setNotice("Your payout setup link expired. Press Set up payouts to continue.");
    }
    if (window.location.search) window.history.replaceState({}, "", "/ascentgames/gold");

    return () => {
      cancelled = true;
      window.removeEventListener(ASCENT_AUTH_CHANGED, load);
    };
  }, [loadWallet]);

  async function buy(pack: Pack) {
    setError("");
    setNotice("");
    setBusy(pack.id);
    try {
      const data = await api<{ url: string }>("/api/gold/checkout", { packId: pack.id });
      window.location.assign(data.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Checkout could not be started.");
      setBusy(null);
    }
  }

  async function payouts() {
    setError("");
    setBusy("payouts");
    try {
      const data = await api<{ url: string }>("/api/gold/payout-onboarding", {});
      window.location.assign(data.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Payout setup could not start.");
      setBusy(null);
    }
  }

  async function requestCashOut() {
    setError("");
    setNotice("");
    const amount = Number(cashOut);
    setBusy("cashout");
    try {
      const data = await api<{ wallet: Wallet }>("/api/gold/cashout", { gold: amount });
      setWallet(data.wallet);
      setCashOut("");
      setNotice("Cash-out requested. You will be paid once it is reviewed.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Cash-out request failed.");
    } finally {
      setBusy(null);
    }
  }

  const cashOutAmount = Number(cashOut);
  const cashOutValid =
    wallet != null &&
    Number.isInteger(cashOutAmount) &&
    cashOutAmount >= wallet.minCashOutGold &&
    cashOutAmount <= wallet.earned;

  return (
    <div className="ascent-sub">
      {ready && user ? (
        <div className="ascent-sub-status">
          <p className="ascent-kicker">Your Gold</p>
          <h3>{wallet ? `${gold(wallet.balance)} Gold` : "—"}</h3>
          <p className="ascent-sub-copy">
            Gold follows your Ascent account in Chess Ascent, Checkers Ascent,
            and here. Spend it on openings and lessons in the Marketplace.
          </p>
          {wallet && wallet.debt > 0 ? (
            <p className="ascent-sub-error">
              Refund balance: {gold(wallet.debt)} Gold. Spending and cash-outs
              resume once new Gold covers it.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="ascent-sub-status">
          <p className="ascent-kicker">Your Gold</p>
          <h3>{ready ? "Sign in to buy Gold" : "Loading…"}</h3>
          <p className="ascent-sub-copy">
            Gold is tied to your Ascent account and works in every Ascent app.
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
        {packs.map((pack) => (
          <article key={pack.id} className="ascent-sub-plan">
            <p className="ascent-kicker">{gold(pack.gold)} Gold</p>
            <h3>{usd(pack.usdCents)}</h3>
            <p className="ascent-sub-copy">
              Includes {gold(pack.laurels)} bonus Laurels.
            </p>
            {user ? (
              <div className="ascent-sub-actions">
                <button
                  type="button"
                  className="button primary"
                  disabled={busy !== null}
                  onClick={() => void buy(pack)}
                >
                  {busy === pack.id ? "Opening checkout…" : "Buy"}
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {user && wallet ? (
        <div className="ascent-sub-status">
          <p className="ascent-kicker">Seller earnings</p>
          <h3>
            {gold(wallet.earned)} Gold{" "}
            <span className="ascent-sub-cadence">
              ({usd(wallet.earned * wallet.payoutCentsPerGold)} available)
            </span>
          </h3>
          {wallet.clearing > 0 ? (
            <p className="ascent-sub-copy">
              {gold(wallet.clearing)} Gold from recent sales is clearing (each
              sale becomes cashable after {wallet.clearingDays} days).
            </p>
          ) : null}
          {wallet.pendingCashOut > 0 ? (
            <p className="ascent-sub-copy">
              {gold(wallet.pendingCashOut)} Gold is waiting to be paid out.
            </p>
          ) : null}
          <div className="ascent-sub-actions">
            <button
              type="button"
              className={wallet.payoutsReady ? "button secondary" : "button primary"}
              disabled={busy !== null}
              onClick={() => void payouts()}
            >
              {busy === "payouts"
                ? "Opening Stripe…"
                : wallet.payoutsReady
                  ? "Payout settings"
                  : wallet.payoutAccount
                    ? "Finish payout setup"
                    : "Set up payouts"}
            </button>
          </div>
          {wallet.payoutsReady ? (
            <div className="ascent-sub-actions">
              <input
                type="number"
                inputMode="numeric"
                min={wallet.minCashOutGold}
                max={wallet.earned}
                placeholder={`${gold(wallet.minCashOutGold)} minimum`}
                value={cashOut}
                onChange={(event) => setCashOut(event.target.value)}
                aria-label="Gold to cash out"
              />
              <button
                type="button"
                className="button primary"
                disabled={busy !== null || !cashOutValid}
                onClick={() => void requestCashOut()}
              >
                {busy === "cashout"
                  ? "Requesting…"
                  : cashOutValid
                    ? `Cash out ${usd(cashOutAmount * wallet.payoutCentsPerGold)}`
                    : "Cash out"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="ascent-sub-error">{error}</p> : null}
      {notice ? <p className="ascent-sub-notice">{notice}</p> : null}

      <p className="ascent-sub-legal">
        1 Gold costs 1 cent. Gold never expires and has no cash value; only Gold
        earned from your own Marketplace sales can be cashed out, at 1 cent per
        Gold. Card payments and payouts are handled by Stripe.{" "}
        <a href={`${TERMS_URL}#gold`}>Gold terms</a>
        {" · "}
        <a href={PRIVACY_URL}>Privacy</a>
      </p>
    </div>
  );
}
