"use client";

import { useCallback, useEffect, useState } from "react";

type PendingListing = {
  id: string;
  title: string;
  description: string;
  kind: string;
  game_id: string;
  price_gold: number;
  item_count: number;
  content_bytes: number;
  seller_name: string;
  seller_email: string | null;
  created_at: string;
};

type OpenReport = {
  id: string;
  listing_id: string;
  reason: string;
  details: string;
  created_at: string;
  title: string | null;
  listing_status: string | null;
  seller_name: string | null;
  reporter_email: string | null;
};

type PendingCashout = {
  id: string;
  user_id: string;
  gold: number;
  usd_cents: number;
  created_at: string;
  email: string | null;
  display_name: string | null;
  payout_account_id: string | null;
  distinct_buyers: number;
  lifetime_sales_gold: number;
  top_buyer_gold: number | null;
};

type Queue = {
  listings: PendingListing[];
  reports: OpenReport[];
  cashouts: PendingCashout[];
};

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

const day = (iso: string) => new Date(iso).toLocaleString("en-US");

export default function AscentMarketAdmin() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setQueue(await api<Queue>("/api/market/admin"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Queue could not be loaded.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string, id: string, askNote?: string) {
    let note: string | undefined;
    if (askNote) {
      const value = window.prompt(askNote);
      if (value === null) return;
      note = value;
    }
    setBusy(`${action}:${id}`);
    setError("");
    try {
      await api("/api/market/admin", { action, id, note });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!queue) {
    return (
      <div className="ascent-sub">
        <p className="ascent-sub-copy">{error || "Loading…"}</p>
      </div>
    );
  }

  return (
    <div className="ascent-sub">
      {error ? <p className="ascent-sub-error">{error}</p> : null}

      <div className="ascent-sub-status">
        <p className="ascent-kicker">Listings awaiting review ({queue.listings.length})</p>
        {queue.listings.length === 0 ? <p className="ascent-sub-copy">Nothing to review.</p> : null}
        {queue.listings.map((listing) => (
          <article key={listing.id} className="ascent-sub-plan">
            <h3>{listing.title}</h3>
            <p className="ascent-sub-copy">
              {listing.game_id} {listing.kind} · {listing.item_count} items ·{" "}
              {listing.price_gold} Gold · {(listing.content_bytes / 1024).toFixed(0)} KB
            </p>
            <p className="ascent-sub-copy">
              {listing.seller_name} ({listing.seller_email || "deleted account"}) ·{" "}
              {day(listing.created_at)}
            </p>
            {listing.description ? (
              <p className="ascent-sub-copy" style={{ whiteSpace: "pre-wrap" }}>
                {listing.description}
              </p>
            ) : null}
            <div className="ascent-sub-actions">
              <a
                className="button secondary"
                href={`/api/market/content?listingId=${encodeURIComponent(listing.id)}`}
                target="_blank"
                rel="noreferrer"
              >
                View content
              </a>
              <button
                type="button"
                className="button primary"
                disabled={busy !== null}
                onClick={() => void act("approve_listing", listing.id)}
              >
                Approve
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={busy !== null}
                onClick={() =>
                  void act("reject_listing", listing.id, "Reason shown to the seller:")
                }
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="ascent-sub-status">
        <p className="ascent-kicker">Open reports ({queue.reports.length})</p>
        {queue.reports.length === 0 ? <p className="ascent-sub-copy">No open reports.</p> : null}
        {queue.reports.map((report) => (
          <article key={report.id} className="ascent-sub-plan">
            <h3>{report.title || report.listing_id}</h3>
            <p className="ascent-sub-copy">
              {report.reason} · by {report.reporter_email || "deleted account"} ·{" "}
              {day(report.created_at)} · listing is {report.listing_status || "missing"} · seller{" "}
              {report.seller_name || "?"}
            </p>
            {report.details ? <p className="ascent-sub-copy">{report.details}</p> : null}
            <div className="ascent-sub-actions">
              <a
                className="button secondary"
                href={`/api/market/content?listingId=${encodeURIComponent(report.listing_id)}`}
                target="_blank"
                rel="noreferrer"
              >
                View content
              </a>
              <button
                type="button"
                className="button secondary"
                disabled={busy !== null}
                onClick={() => void act("dismiss_report", report.id)}
              >
                Dismiss
              </button>
              <button
                type="button"
                className="button primary"
                disabled={busy !== null}
                onClick={() =>
                  void act("take_down_listing", report.listing_id, "Reason shown to the seller:")
                }
              >
                Take down listing
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="ascent-sub-status">
        <p className="ascent-kicker">Pending cash-outs ({queue.cashouts.length})</p>
        {queue.cashouts.length === 0 ? <p className="ascent-sub-copy">No pending cash-outs.</p> : null}
        {queue.cashouts.map((cashout) => {
          const topShare =
            cashout.lifetime_sales_gold > 0
              ? Math.round(((cashout.top_buyer_gold || 0) / cashout.lifetime_sales_gold) * 100)
              : 0;
          return (
            <article key={cashout.id} className="ascent-sub-plan">
              <h3>
                {cashout.gold.toLocaleString("en-US")} Gold → ${(cashout.usd_cents / 100).toFixed(2)}
              </h3>
              <p className="ascent-sub-copy">
                {cashout.display_name} ({cashout.email || "deleted account"}) ·{" "}
                {day(cashout.created_at)}
              </p>
              <p className={topShare >= 50 ? "ascent-sub-error" : "ascent-sub-copy"}>
                {cashout.distinct_buyers} paying buyers · lifetime proceeds{" "}
                {cashout.lifetime_sales_gold.toLocaleString("en-US")} Gold · top buyer{" "}
                {topShare}% of proceeds
                {topShare >= 50 ? " — check for self-dealing" : ""}
              </p>
              <div className="ascent-sub-actions">
                <button
                  type="button"
                  className="button primary"
                  disabled={busy !== null || !cashout.payout_account_id}
                  onClick={() => {
                    if (window.confirm(`Send $${(cashout.usd_cents / 100).toFixed(2)} via Stripe?`)) {
                      void act("approve_cashout", cashout.id);
                    }
                  }}
                >
                  {busy === `approve_cashout:${cashout.id}` ? "Paying…" : "Approve & pay"}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy !== null}
                  onClick={() =>
                    void act("reject_cashout", cashout.id, "Reason (Gold returns to the seller):")
                  }
                >
                  Reject
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
