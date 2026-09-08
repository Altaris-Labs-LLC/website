import {
  json,
  publicUser,
  readJson,
  requireSecret,
  userFromRequest,
  type AuthPlan,
  type Env,
} from "../auth/_lib";

const PRODUCTS: Record<
  string,
  { kind: "premium" | "ads_free"; plan: string; days: number }
> = {
  ascent_premium_monthly: { kind: "premium", plan: "monthly", days: 31 },
  ascent_premium_yearly: { kind: "premium", plan: "yearly", days: 366 },
  ascent_ad_free_month: { kind: "ads_free", plan: "ads_free", days: 31 },
};

const PLATFORMS = new Set(["apple", "google", "stripe"]);

type ActivateBody = {
  platform?: unknown;
  productId?: unknown;
  purchaseId?: unknown;
  verificationData?: unknown;
  expiresAt?: unknown;
};

function parseExpiresAt(
  value: unknown,
  fallbackDays: number,
): string {
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime()) && date.getTime() > Date.now()) {
      return date.toISOString();
    }
  }
  if (typeof value === "number" && Number.isFinite(value) && value > Date.now()) {
    return new Date(value).toISOString();
  }
  return new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000).toISOString();
}

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Subscription is unavailable." }, 503);
  }
  const user = await userFromRequest(context.env, context.request);
  if (!user) {
    return json(context.request, { error: "Sign in to subscribe." }, 401);
  }

  const body = await readJson<ActivateBody>(context.request);
  const platform =
    typeof body?.platform === "string" ? body.platform.trim().toLowerCase() : "";
  const productId =
    typeof body?.productId === "string" ? body.productId.trim() : "";
  const purchaseId =
    typeof body?.purchaseId === "string" ? body.purchaseId.trim() : "";
  const verificationData =
    typeof body?.verificationData === "string" ? body.verificationData : "";

  if (!PLATFORMS.has(platform) || !productId || !purchaseId || purchaseId.length > 200) {
    return json(context.request, { error: "That purchase could not be read." }, 400);
  }
  const product = PRODUCTS[productId];
  if (!product) {
    return json(context.request, { error: "Unknown subscription product." }, 400);
  }

  const now = new Date().toISOString();
  const expiresAt = parseExpiresAt(body?.expiresAt, product.days);

  const inserted = await context.env.ASCENT_DB.prepare(
    `INSERT OR IGNORE INTO subscription_purchases
      (id, user_id, platform, product_id, purchase_id, plan, expires_at, verification_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      user.id,
      platform,
      productId,
      purchaseId,
      product.plan,
      expiresAt,
      verificationData.slice(0, 8000),
      now,
    )
    .run();
  const isNewPurchase = (inserted.meta?.changes ?? 0) > 0;

  if (product.kind === "ads_free") {
    if (isNewPurchase) {
      const current = user.ads_free_until ? new Date(user.ads_free_until).getTime() : 0;
      const base = Math.max(current, Date.now());
      const next = new Date(base + product.days * 24 * 60 * 60 * 1000).toISOString();
      await context.env.ASCENT_DB.prepare(
        `UPDATE users SET ads_free_until = ? WHERE id = ?`,
      )
        .bind(next, user.id)
        .run();
      user.ads_free_until = next;
    }
    const pub = publicUser(user);
    return json(context.request, { user: pub, subscription: pub.subscription });
  }

  const currentPlan = (user.premium_plan || "none") as AuthPlan;
  if (currentPlan !== "lifetime") {
    const currentExpiry = user.premium_expires_at
      ? new Date(user.premium_expires_at).getTime()
      : 0;
    const nextExpiry = new Date(expiresAt).getTime();
    const keepCurrent =
      (currentPlan === "yearly" && product.plan === "monthly" && currentExpiry > Date.now()) ||
      (currentExpiry > nextExpiry && currentExpiry > Date.now());
    if (!keepCurrent) {
      await context.env.ASCENT_DB.prepare(
        `UPDATE users
         SET premium_plan = ?, premium_expires_at = ?, premium_source = ?
         WHERE id = ?`,
      )
        .bind(product.plan, expiresAt, platform, user.id)
        .run();
      user.premium_plan = product.plan;
      user.premium_expires_at = expiresAt;
      user.premium_source = platform;
    }
  }

  const pub = publicUser(user);
  return json(context.request, { user: pub, subscription: pub.subscription });
}
