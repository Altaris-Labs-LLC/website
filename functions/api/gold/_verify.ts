import type { Env } from "../auth/_lib";

const APPLE_BUNDLES: Record<string, string> = {
  chess: "dev.altarislabs.ascentgames.chess",
  checkers: "dev.altarislabs.ascentgames.checkers",
};

const GOOGLE_PACKAGES: Record<string, string> = {
  chess: "dev.altarislabs.ascentgames.chess",
  checkers: "dev.altarislabs.ascentgames.checkers",
};

/** A purchase that cannot be credited. [status] 503 means "retry later". */
export class VerifyError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "VerifyError";
  }
}

export type VerifiedPurchase = {
  /** Store-unique id used for idempotency (transaction id / order id). */
  purchaseKey: string;
  /** Extra id for matching refunds (Google purchase token). */
  paymentRef: string | null;
  /** Sandbox / license-tester purchase. */
  test: boolean;
};

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlText(text: string): string {
  return base64Url(new TextEncoder().encode(text));
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Payload of a JWS without verifying it (only for data fetched from Apple over TLS). */
export function jwsPayload<T>(jws: string): T | null {
  const parts = jws.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(decodeBase64Url(parts[1])) as T;
  } catch {
    return null;
  }
}

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const der = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) der[i] = binary.charCodeAt(i);
  return der;
}

async function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  key: CryptoKey,
  algorithm: AlgorithmIdentifier | EcdsaParams,
): Promise<string> {
  const signingInput = `${base64UrlText(JSON.stringify(header))}.${base64UrlText(
    JSON.stringify(payload),
  )}`;
  const signature = await crypto.subtle.sign(
    algorithm,
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

// ---------------------------------------------------------------------------
// Apple — App Store Server API
// ---------------------------------------------------------------------------

export function appleConfigured(env: Env): boolean {
  return Boolean(env.APPLE_IAP_KEY_ID && env.APPLE_IAP_ISSUER_ID && env.APPLE_IAP_PRIVATE_KEY);
}

async function appleToken(env: Env, bundleId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(env.APPLE_IAP_PRIVATE_KEY || "") as BufferSource,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const iat = Math.floor(Date.now() / 1000);
  return signJwt(
    { alg: "ES256", kid: env.APPLE_IAP_KEY_ID, typ: "JWT" },
    {
      iss: env.APPLE_IAP_ISSUER_ID,
      iat,
      exp: iat + 15 * 60,
      aud: "appstoreconnect-v1",
      bid: bundleId,
    },
    key,
    { name: "ECDSA", hash: "SHA-256" },
  );
}

export type AppleTransaction = {
  transactionId?: string;
  originalTransactionId?: string;
  bundleId?: string;
  productId?: string;
  environment?: string;
  revocationDate?: number;
  quantity?: number;
};

/** Looks a transaction up in production, then sandbox (TestFlight / App Review). */
export async function appleTransaction(
  env: Env,
  game: string,
  transactionId: string,
): Promise<AppleTransaction | null> {
  const bundleId = APPLE_BUNDLES[game];
  if (!bundleId) return null;
  const token = await appleToken(env, bundleId);
  for (const host of [
    "https://api.storekit.itunes.apple.com",
    "https://api.storekit-sandbox.itunes.apple.com",
  ]) {
    const response = await fetch(
      `${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (response.status === 404) continue;
    if (!response.ok) {
      throw new VerifyError("The App Store could not confirm this purchase yet.", 503);
    }
    const data = (await response.json().catch(() => null)) as {
      signedTransactionInfo?: string;
    } | null;
    const info = data?.signedTransactionInfo
      ? jwsPayload<AppleTransaction>(data.signedTransactionInfo)
      : null;
    if (info) return info;
  }
  return null;
}

async function verifyApple(
  env: Env,
  game: string,
  productId: string,
  transactionId: string,
): Promise<VerifiedPurchase> {
  if (!appleConfigured(env)) {
    throw new VerifyError("Gold purchases are not set up on the server yet.", 503);
  }
  const transaction = await appleTransaction(env, game, transactionId);
  if (!transaction?.transactionId) {
    throw new VerifyError("The App Store did not recognize this purchase.");
  }
  if (transaction.bundleId !== APPLE_BUNDLES[game] || transaction.productId !== productId) {
    throw new VerifyError("This receipt is for a different product.");
  }
  if (transaction.revocationDate) {
    throw new VerifyError("This purchase was refunded.");
  }
  return {
    purchaseKey: transaction.transactionId,
    paymentRef: transaction.originalTransactionId || null,
    test: transaction.environment === "Sandbox",
  };
}

// ---------------------------------------------------------------------------
// Google — Play Developer API
// ---------------------------------------------------------------------------

export function googleConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_PLAY_SERVICE_ACCOUNT);
}

let googleTokenCache: { token: string; expiresAt: number } | null = null;

async function googleAccessToken(env: Env): Promise<string> {
  if (googleTokenCache && googleTokenCache.expiresAt > Date.now() + 60_000) {
    return googleTokenCache.token;
  }
  let account: { client_email?: string; private_key?: string };
  try {
    account = JSON.parse(env.GOOGLE_PLAY_SERVICE_ACCOUNT || "{}");
  } catch {
    throw new VerifyError("Gold purchases are not set up on the server yet.", 503);
  }
  if (!account.client_email || !account.private_key) {
    throw new VerifyError("Gold purchases are not set up on the server yet.", 503);
  }
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(account.private_key) as BufferSource,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const iat = Math.floor(Date.now() / 1000);
  const assertion = await signJwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp: iat + 3600,
    },
    key,
    { name: "RSASSA-PKCS1-v1_5" },
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent(
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    )}&assertion=${encodeURIComponent(assertion)}`,
  });
  const data = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
  } | null;
  if (!response.ok || !data?.access_token) {
    throw new VerifyError("Google Play could not confirm this purchase yet.", 503);
  }
  googleTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return data.access_token;
}

type GoogleProductPurchase = {
  purchaseState?: number;
  orderId?: string;
  purchaseType?: number;
};

async function verifyGoogle(
  env: Env,
  game: string,
  productId: string,
  purchaseToken: string,
): Promise<VerifiedPurchase> {
  if (!googleConfigured(env)) {
    throw new VerifyError("Gold purchases are not set up on the server yet.", 503);
  }
  const packageName = GOOGLE_PACKAGES[game];
  const token = await googleAccessToken(env);
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}` +
      `/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (response.status === 400 || response.status === 404 || response.status === 410) {
    throw new VerifyError("Google Play did not recognize this purchase.");
  }
  if (!response.ok) {
    throw new VerifyError("Google Play could not confirm this purchase yet.", 503);
  }
  const purchase = (await response.json().catch(() => null)) as GoogleProductPurchase | null;
  if (!purchase || purchase.purchaseState !== 0) {
    throw new VerifyError("This purchase is not complete.");
  }
  return {
    purchaseKey: purchase.orderId || purchaseToken,
    paymentRef: purchaseToken,
    test: purchase.purchaseType === 0,
  };
}

/**
 * Confirms a store purchase with Apple or Google. On iOS [purchaseId] is the
 * transaction id; on Android [verificationData] is the purchase token.
 */
export async function verifyStorePurchase(
  env: Env,
  input: {
    platform: string;
    game: string;
    productId: string;
    purchaseId: string;
    verificationData: string;
  },
): Promise<VerifiedPurchase> {
  if (input.platform === "apple") {
    return verifyApple(env, input.game, input.productId, input.purchaseId);
  }
  if (input.platform === "google") {
    return verifyGoogle(env, input.game, input.productId, input.verificationData);
  }
  throw new VerifyError("Unknown store.");
}
