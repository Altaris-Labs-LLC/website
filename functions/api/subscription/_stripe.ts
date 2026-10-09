import type { Env } from "../auth/_lib";

export type PaidPlan = "monthly" | "yearly";

const STRIPE_API_VERSION =
  "2026-03-25.dahlia; custom_checkout_payment_form_preview=v1";

const PLANS: Record<
  PaidPlan,
  { amount: string; interval: "month" | "year"; name: string; days: number }
> = {
  monthly: {
    amount: "599",
    interval: "month",
    name: "Ascent Premium Monthly",
    days: 31,
  },
  yearly: {
    amount: "4999",
    interval: "year",
    name: "Ascent Premium Yearly",
    days: 366,
  },
};

export function paidPlan(value: unknown): PaidPlan | null {
  return value === "monthly" || value === "yearly" ? value : null;
}

export function stripeConfigured(env: Env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export function siteOrigin(request: Request): string {
  const origin = request.headers.get("Origin") || "";
  if (
    origin === "http://localhost:3000" ||
    origin === "http://127.0.0.1:3000" ||
    origin === "https://altarislabs.dev" ||
    origin === "https://www.altarislabs.dev"
  ) {
    return origin;
  }
  return "https://altarislabs.dev";
}

export type StripeObject = Record<string, unknown>;

export class StripeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeError";
  }
}

/** Customer or subscription exists in the other Stripe mode (test vs live). */
export function isOtherStripeMode(error: unknown): boolean {
  return (
    error instanceof StripeError &&
    /exists in (test|live) mode/i.test(error.message)
  );
}

function formBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

export async function stripeFetch(
  env: Env,
  path: string,
  init?: {
    method?: string;
    params?: Record<string, string>;
    idempotencyKey?: string;
  },
): Promise<StripeObject> {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Card and PayPal checkout is not configured.");
  const method = init?.method || "GET";
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(method === "POST"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
      ...(init?.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init?.params ? formBody(init.params) : undefined,
  });
  const data = (await response.json().catch(() => null)) as StripeObject | null;
  if (!response.ok) {
    const message =
      data &&
      typeof data.error === "object" &&
      data.error &&
      "message" in data.error &&
      typeof (data.error as { message?: unknown }).message === "string"
        ? (data.error as { message: string }).message
        : "Stripe could not start checkout.";
    throw new StripeError(message);
  }
  return data || {};
}

const STRIPE_V2_API_VERSION = "2026-09-30.endive";

/** Stripe v2 endpoints (Connect accounts / account links) take JSON bodies. */
export async function stripeV2Fetch(
  env: Env,
  path: string,
  init?: {
    method?: string;
    body?: unknown;
    idempotencyKey?: string;
  },
): Promise<StripeObject> {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Payouts are not configured yet.");
  const method = init?.method || "GET";
  const response = await fetch(`https://api.stripe.com/v2/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": STRIPE_V2_API_VERSION,
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init?.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = (await response.json().catch(() => null)) as StripeObject | null;
  if (!response.ok) {
    const error = data?.error as { message?: unknown } | undefined;
    throw new StripeError(
      typeof error?.message === "string" ? error.message : "Stripe request failed.",
    );
  }
  return data || {};
}

export async function createCheckoutSession(
  env: Env,
  input: {
    userId: string;
    email: string;
    plan: PaidPlan;
    customerId: string | null;
    returnUrl: string;
  },
): Promise<{ clientSecret: string; sessionId: string }> {
  const plan = PLANS[input.plan];
  const params: Record<string, string> = {
    ui_mode: "form",
    mode: "subscription",
    billing_address_collection: "auto",
    "phone_number_collection[enabled]": "false",
    "automatic_tax[enabled]": "false",
    payment_method_collection: "always",
    submit_type: "auto",
    integration_identifier: "custom_embedded_web_0001",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": plan.amount,
    "line_items[0][price_data][recurring][interval]": plan.interval,
    "line_items[0][price_data][product_data][name]": plan.name,
    client_reference_id: input.userId,
    "metadata[userId]": input.userId,
    "metadata[plan]": input.plan,
    "subscription_data[metadata][userId]": input.userId,
    "subscription_data[metadata][plan]": input.plan,
    return_url: input.returnUrl,
  };
  if (input.customerId) {
    params.customer = input.customerId;
  } else {
    params.customer_email = input.email;
  }
  const session = await stripeFetch(env, "checkout/sessions", {
    method: "POST",
    params,
  });
  const clientSecret = session.client_secret;
  const sessionId = session.id;
  if (typeof clientSecret !== "string" || !clientSecret || typeof sessionId !== "string") {
    throw new StripeError("Stripe did not return a checkout form.");
  }
  return { clientSecret, sessionId };
}

async function portalConfigurationId(env: Env): Promise<string> {
  const listed = await stripeFetch(
    env,
    "billing_portal/configurations?active=true&limit=10",
  );
  const rows = listed.data;
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const id = (row as { id?: unknown }).id;
      const cancel = (
        row as {
          features?: { subscription_cancel?: { enabled?: unknown } };
        }
      ).features?.subscription_cancel;
      if (typeof id === "string" && cancel?.enabled === true) return id;
    }
  }
  const created = await stripeFetch(env, "billing_portal/configurations", {
    method: "POST",
    params: {
      "features[invoice_history][enabled]": "true",
      "features[payment_method_update][enabled]": "true",
      "features[subscription_cancel][enabled]": "true",
      "features[subscription_cancel][mode]": "at_period_end",
      "features[subscription_cancel][proration_behavior]": "none",
      "business_profile[privacy_policy_url]": "https://altarislabs.dev/privacy",
      "business_profile[terms_of_service_url]": "https://altarislabs.dev/terms",
      default_return_url: "https://altarislabs.dev/ascentgames/subscription",
    },
  });
  const id = created.id;
  if (typeof id !== "string" || !id) {
    throw new StripeError("Billing settings could not be prepared.");
  }
  return id;
}

export async function createPortalSession(
  env: Env,
  customerId: string,
  origin: string,
): Promise<string> {
  const configuration = await portalConfigurationId(env);
  const session = await stripeFetch(env, "billing_portal/sessions", {
    method: "POST",
    params: {
      customer: customerId,
      configuration,
      return_url: `${origin}/ascentgames/subscription`,
    },
  });
  const url = session.url;
  if (typeof url !== "string" || !url) {
    throw new StripeError("Stripe did not return a billing page.");
  }
  return url;
}

export async function retrieveCheckoutSession(
  env: Env,
  sessionId: string,
): Promise<StripeObject> {
  return stripeFetch(
    env,
    `checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`,
  );
}

export async function retrieveSubscription(
  env: Env,
  subscriptionId: string,
): Promise<StripeObject> {
  return stripeFetch(
    env,
    `subscriptions/${encodeURIComponent(subscriptionId)}`,
  );
}

function unixEnd(subscription: StripeObject): number | null {
  if (typeof subscription.current_period_end === "number") {
    return subscription.current_period_end;
  }
  const items = subscription.items;
  if (!items || typeof items !== "object") return null;
  const data = (items as { data?: unknown }).data;
  if (!Array.isArray(data) || !data.length) return null;
  const first = data[0];
  if (
    first &&
    typeof first === "object" &&
    typeof (first as { current_period_end?: unknown }).current_period_end ===
      "number"
  ) {
    return (first as { current_period_end: number }).current_period_end;
  }
  return null;
}

export function subscriptionExpiry(
  subscription: StripeObject,
  plan: PaidPlan,
): string {
  const unix = unixEnd(subscription);
  if (unix && unix * 1000 > Date.now()) {
    return new Date(unix * 1000).toISOString();
  }
  return new Date(
    Date.now() + PLANS[plan].days * 24 * 60 * 60 * 1000,
  ).toISOString();
}

export function metadataUserId(object: StripeObject): string | null {
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const userId = (metadata as { userId?: unknown }).userId;
  return typeof userId === "string" && userId.trim() ? userId.trim() : null;
}

export function metadataPlan(object: StripeObject): PaidPlan | null {
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  return paidPlan((metadata as { plan?: unknown }).plan);
}

export async function latestStripeCustomerId(
  db: D1Database,
  userId: string,
): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT verification_data
       FROM subscription_purchases
       WHERE user_id = ? AND platform = 'stripe'
       ORDER BY created_at DESC
       LIMIT 8`,
    )
    .bind(userId)
    .all<{ verification_data: string | null }>();
  for (const item of row.results || []) {
    const customerId = customerIdFromVerification(item.verification_data);
    if (customerId) return customerId;
  }
  return null;
}

function customerIdFromVerification(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { customerId?: unknown };
    return typeof parsed.customerId === "string" && parsed.customerId.startsWith("cus_")
      ? parsed.customerId
      : null;
  } catch {
    return null;
  }
}

export async function grantStripePremium(
  db: D1Database,
  input: {
    userId: string;
    plan: PaidPlan;
    expiresAt: string;
    subscriptionId: string;
    customerId: string | null;
  },
): Promise<void> {
  const user = await db
    .prepare(
      `SELECT premium_plan, premium_expires_at FROM users WHERE id = ?`,
    )
    .bind(input.userId)
    .first<{ premium_plan: string | null; premium_expires_at: string | null }>();
  if (!user || user.premium_plan === "lifetime") return;

  const now = new Date().toISOString();
  const verification = JSON.stringify({
    customerId: input.customerId,
    subscriptionId: input.subscriptionId,
  }).slice(0, 8000);
  await db
    .prepare(
      `INSERT OR IGNORE INTO subscription_purchases
        (id, user_id, platform, product_id, purchase_id, plan, expires_at, verification_data, created_at)
       VALUES (?, ?, 'stripe', ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.userId,
      input.plan === "yearly" ? "ascent_premium_yearly" : "ascent_premium_monthly",
      input.subscriptionId.slice(0, 200),
      input.plan,
      input.expiresAt,
      verification,
      now,
    )
    .run();

  const currentExpiry = user.premium_expires_at
    ? new Date(user.premium_expires_at).getTime()
    : 0;
  const nextExpiry = new Date(input.expiresAt).getTime();
  if (currentExpiry > nextExpiry && currentExpiry > Date.now()) return;

  await db
    .prepare(
      `UPDATE users
       SET premium_plan = ?, premium_expires_at = ?, premium_source = 'stripe'
       WHERE id = ? AND premium_plan != 'lifetime'`,
    )
    .bind(input.plan, input.expiresAt, input.userId)
    .run();
}

/** Drop Premium that cannot be billed with the current Stripe key. */
export async function endUnbillableStripePremium(
  db: D1Database,
  userId: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE users
       SET premium_plan = 'none', premium_expires_at = ?, premium_source = 'stripe'
       WHERE id = ? AND premium_plan != 'lifetime' AND premium_source = 'stripe'`,
    )
    .bind(new Date().toISOString(), userId)
    .run();
}

export async function endStripePremium(
  db: D1Database,
  userId: string,
  subscriptionId: string,
): Promise<void> {
  const owned = await db
    .prepare(
      `SELECT id FROM subscription_purchases
       WHERE user_id = ? AND platform = 'stripe' AND purchase_id = ?
       LIMIT 1`,
    )
    .bind(userId, subscriptionId)
    .first();
  if (!owned) return;
  await db
    .prepare(
      `UPDATE users
       SET premium_plan = 'none', premium_expires_at = ?, premium_source = 'stripe'
       WHERE id = ? AND premium_plan != 'lifetime' AND premium_source = 'stripe'`,
    )
    .bind(new Date().toISOString(), userId)
    .run();
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyStripeWebhook(
  payload: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  const fields = new Map<string, string[]>();
  for (const part of header.split(",")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    const list = fields.get(key) || [];
    list.push(value);
    fields.set(key, list);
  }
  const timestamp = fields.get("t")?.[0];
  const signatures = fields.get("v1") || [];
  if (!timestamp || !signatures.length) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const expected = hex(signed);
  return signatures.some((signature) => timingSafeEqual(expected, signature));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
