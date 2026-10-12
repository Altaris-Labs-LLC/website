export interface Env {
  ASCENT_DB: D1Database;
  AUTH_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  ASCENT_BACKUPS?: R2Bucket;
  ASCENT_FILES?: R2Bucket;
  /** Resend API key for transactional mail (feedback alerts, etc.). */
  RESEND_API_KEY?: string;
  /** Stripe secret key. Card and PayPal checkout never touches card numbers. */
  STRIPE_SECRET_KEY?: string;
  /** Publishable key for Stripe.js on the subscription page. */
  STRIPE_PUBLISHABLE_KEY?: string;
  /** Stripe webhook signing secret for /api/subscription/webhook. */
  STRIPE_WEBHOOK_SECRET?: string;
  /** App Store Server API key (In-App Purchase key) for Gold receipts. */
  APPLE_IAP_KEY_ID?: string;
  APPLE_IAP_ISSUER_ID?: string;
  /** Contents of the AuthKey_XXXX.p8 file. */
  APPLE_IAP_PRIVATE_KEY?: string;
  /** Sign in with Apple key. Team ID is the 10-character Apple Developer team. */
  APPLE_TEAM_ID?: string;
  APPLE_SIGNIN_KEY_ID?: string;
  APPLE_SIGNIN_PRIVATE_KEY?: string;
  /** Google Play service-account JSON for Gold receipts. */
  GOOGLE_PLAY_SERVICE_ACCOUNT?: string;
  /** Shared token in the Play real-time developer notification push URL. */
  GOOGLE_RTDN_TOKEN?: string;
}

export type AuthPlan = "none" | "monthly" | "yearly" | "lifetime";

export type AuthSubscription = {
  plan: AuthPlan;
  expiresAt: string | null;
  source: string | null;
  isPremium: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  anonymous?: boolean;
  avatarUrl: string | null;
  createdAt: string;
  subscription: AuthSubscription;
  adsFreeUntil: string | null;
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string | null;
  display_name: string;
  google_sub: string | null;
  apple_sub: string | null;
  avatar_url: string | null;
  created_at: string;
  last_seen_at: string;
  premium_plan?: string | null;
  premium_expires_at?: string | null;
  premium_source?: string | null;
  ads_free_until?: string | null;
};

const COMPLIMENTARY_LIFETIME_EMAILS = new Set([
  "brentunderwood@altarislabs.dev",
  "brentwoodunderwood@gmail.com",
  "play_review_premium@altarislabs.dev",
]);

export const USER_COLUMNS =
  "id, email, password_hash, display_name, google_sub, apple_sub, avatar_url, created_at, last_seen_at, premium_plan, premium_expires_at, premium_source, ads_free_until";

export const USER_COLUMNS_U =
  "u.id, u.email, u.password_hash, u.display_name, u.google_sub, u.apple_sub, u.avatar_url, u.created_at, u.last_seen_at, u.premium_plan, u.premium_expires_at, u.premium_source, u.ads_free_until";

const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000;
const COOKIE_NAME = "ascent_session";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_ORIGINS = new Set([
  "https://altarislabs.dev",
  "https://www.altarislabs.dev",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://altarislabs.dev";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Part-Sha256",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    Vary: "Origin",
  };
}

export function json(
  request: Request,
  body: unknown,
  status = 200,
  extraHeaders?: HeadersInit,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(request),
      ...extraHeaders,
    },
  });
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value) && value.length <= 254;
}

export function isValidPassword(value: string): boolean {
  return value.length >= 8 && value.length <= 128;
}

export function isValidDisplayName(value: string): boolean {
  const name = value.trim();
  return name.length >= 1 && name.length <= 80;
}

const ANONYMOUS_EMAIL = /^anon\.(\d+)@users\.ascent\.invalid$/i;

export function isAnonymousUser(user: { email: string }): boolean {
  return ANONYMOUS_EMAIL.test(user.email);
}

export function anonymousEmail(n: number): string {
  return `anon.${n}@users.ascent.invalid`;
}

export function anonymousDisplayName(n: number): string {
  return `Anonymous_${n}`;
}

/** Next id for Anonymous_[id]. The table is created on first use. */
export async function nextAnonymousNumber(db: D1Database): Promise<number> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS anon_ids (
         n INTEGER PRIMARY KEY AUTOINCREMENT,
         created_at TEXT NOT NULL
       )`,
    )
    .run();
  const inserted = await db
    .prepare(`INSERT INTO anon_ids (created_at) VALUES (?)`)
    .bind(new Date().toISOString())
    .run();
  let n = Number(inserted.meta.last_row_id);
  if (!Number.isInteger(n) || n < 1) {
    const row = await db
      .prepare(`SELECT MAX(n) AS n FROM anon_ids`)
      .first<{ n: number | null }>();
    n = Number(row?.n);
  }
  if (!Number.isInteger(n) || n < 1) throw new Error("anonymous id");
  return n;
}

/** Replaces Anonymous_[id] with a real login on the same account. */
export async function claimAnonymousUser(
  db: D1Database,
  user: UserRow,
  input: {
    email: string;
    displayName: string;
    passwordHash?: string | null;
    googleSub?: string | null;
    appleSub?: string | null;
    avatarUrl?: string | null;
  },
): Promise<UserRow> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE users
       SET email = ?, display_name = ?,
           password_hash = COALESCE(?, password_hash),
           google_sub = COALESCE(?, google_sub),
           apple_sub = COALESCE(?, apple_sub),
           avatar_url = COALESCE(?, avatar_url),
           last_seen_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.email,
      input.displayName,
      input.passwordHash ?? null,
      input.googleSub ?? null,
      input.appleSub ?? null,
      input.avatarUrl ?? null,
      now,
      user.id,
    )
    .run();
  return ensureComplimentary(db, {
    ...user,
    email: input.email,
    display_name: input.displayName,
    password_hash: input.passwordHash ?? user.password_hash,
    google_sub: input.googleSub ?? user.google_sub,
    apple_sub: input.appleSub ?? user.apple_sub,
    avatar_url: input.avatarUrl ?? user.avatar_url,
    last_seen_at: now,
  });
}

export function resolveSubscription(row: UserRow): AuthSubscription {
  const source = row.premium_source || null;
  const plan = (row.premium_plan || "none") as AuthPlan;
  if (plan === "lifetime") {
    return { plan: "lifetime", expiresAt: null, source, isPremium: true };
  }
  if ((plan === "monthly" || plan === "yearly") && row.premium_expires_at) {
    if (new Date(row.premium_expires_at).getTime() > Date.now()) {
      return {
        plan,
        expiresAt: row.premium_expires_at,
        source,
        isPremium: true,
      };
    }
  }
  return { plan: "none", expiresAt: null, source: null, isPremium: false };
}

export function publicUser(row: UserRow): AuthUser {
  const adsUntil = row.ads_free_until || null;
  const adsFreeUntil =
    adsUntil && new Date(adsUntil).getTime() > Date.now() ? adsUntil : null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    anonymous: isAnonymousUser(row),
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    subscription: resolveSubscription(row),
    adsFreeUntil,
  };
}

export async function ensureComplimentary(
  db: D1Database,
  user: UserRow,
): Promise<UserRow> {
  if (!COMPLIMENTARY_LIFETIME_EMAILS.has(user.email.toLowerCase())) {
    return user;
  }
  if (user.premium_plan === "lifetime") return user;
  await db
    .prepare(
      `UPDATE users
       SET premium_plan = 'lifetime',
           premium_expires_at = NULL,
           premium_source = 'complimentary'
       WHERE id = ?`,
    )
    .bind(user.id)
    .run();
  return {
    ...user,
    premium_plan: "lifetime",
    premium_expires_at: null,
    premium_source: "complimentary",
  };
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(hash));
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, iterRaw, saltHex, hashHex] = stored.split("$");
  if (scheme !== "pbkdf2-sha256" || !iterRaw || !saltHex || !hashHex) {
    return false;
  }
  const iterations = Number(iterRaw);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  const actual = await pbkdf2(password, fromHex(saltHex), iterations);
  return timingSafeEqual(toHex(actual), hashHex);
}

async function tokenHash(secret: string, token: string) {
  return sha256Hex(`${secret}:${token}`);
}

function sessionCookie(token: string, request: Request, maxAgeSeconds: number) {
  const secure = new URL(request.url).protocol === "https:";
  const parts = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(request: Request) {
  return sessionCookie("", request, 0);
}

export async function createSession(
  env: Env,
  request: Request,
  userId: string,
) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = toHex(tokenBytes);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await env.ASCENT_DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      userId,
      await tokenHash(env.AUTH_SECRET, token),
      expires.toISOString(),
      now.toISOString(),
    )
    .run();
  await env.ASCENT_DB.prepare(
    `UPDATE users SET last_seen_at = ? WHERE id = ?`,
  )
    .bind(now.toISOString(), userId)
    .run();
  return {
    token,
    cookie: sessionCookie(token, request, SESSION_DAYS * 24 * 60 * 60),
  };
}

export function sessionJson(
  request: Request,
  user: UserRow,
  session: { token: string; cookie: string },
  status = 200,
) {
  return json(
    request,
    { user: publicUser(user), sessionToken: session.token },
    status,
    { "Set-Cookie": session.cookie },
  );
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return rest.join("=") || null;
  }
  return null;
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function sessionCookieIfBearerDiffers(request: Request): string | null {
  const bearer = readBearerToken(request);
  if (!bearer) return null;
  if (readCookie(request, COOKIE_NAME) === bearer) return null;
  return sessionCookie(bearer, request, SESSION_DAYS * 24 * 60 * 60);
}

function readSessionToken(request: Request): string | null {
  return readBearerToken(request) || readCookie(request, COOKIE_NAME);
}

export async function userFromRequest(env: Env, request: Request) {
  const token = readSessionToken(request);
  if (!token || !env.AUTH_SECRET) return null;
  const hash = await tokenHash(env.AUTH_SECRET, token);
  const row = await env.ASCENT_DB.prepare(
    `SELECT ${USER_COLUMNS_U}, s.id AS session_id, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`,
  )
    .bind(hash)
    .first<UserRow & { session_id: string; expires_at: string }>();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await env.ASCENT_DB.prepare(`DELETE FROM sessions WHERE id = ?`)
      .bind(row.session_id)
      .run();
    return null;
  }
  return ensureComplimentary(env.ASCENT_DB, row);
}

export async function destroySession(env: Env, request: Request) {
  const token = readSessionToken(request);
  if (!token || !env.AUTH_SECRET) return;
  const hash = await tokenHash(env.AUTH_SECRET, token);
  await env.ASCENT_DB.prepare(`DELETE FROM sessions WHERE token_hash = ?`)
    .bind(hash)
    .run();
}

export async function deleteAccountForUser(
  db: D1Database,
  userId: string,
  backups?: R2Bucket,
) {
  await db.batch([
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId),
    db.prepare(`DELETE FROM laurel_events WHERE user_id = ?`).bind(userId),
    db.prepare(`DELETE FROM subscription_purchases WHERE user_id = ?`).bind(userId),
    db.prepare(`DELETE FROM cloud_backup_manifests WHERE user_id = ?`).bind(userId),
    db.prepare(`DELETE FROM users WHERE id = ?`).bind(userId),
  ]);
  try {
    // Buyers keep access to past purchases; the ledger is kept for accounting.
    await db.batch([
      db
        .prepare(
          `UPDATE market_listings SET status = 'removed'
           WHERE seller_id = ? AND status IN ('pending_review', 'live')`,
        )
        .bind(userId),
      db
        .prepare(`DELETE FROM market_blocks WHERE user_id = ? OR blocked_user_id = ?`)
        .bind(userId, userId),
      db.prepare(`DELETE FROM gold_laurel_grants WHERE user_id = ?`).bind(userId),
    ]);
  } catch {
    // Marketplace tables may not exist yet.
  }
  if (backups) {
    let cursor: string | undefined;
    do {
      const listed = await backups.list({
        prefix: `u/${userId}/`,
        cursor,
      });
      if (listed.objects.length) {
        await Promise.all(listed.objects.map((object) => backups.delete(object.key)));
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  }
}

export async function findUserByEmail(db: D1Database, email: string) {
  const row = await db
    .prepare(
      `SELECT ${USER_COLUMNS}
       FROM users WHERE email = ?`,
    )
    .bind(email)
    .first<UserRow>();
  if (!row) return null;
  return ensureComplimentary(db, row);
}

export async function findUserByAppleSub(db: D1Database, sub: string) {
  const row = await db
    .prepare(
      `SELECT ${USER_COLUMNS}
       FROM users WHERE apple_sub = ?`,
    )
    .bind(sub)
    .first<UserRow>();
  if (!row) return null;
  return ensureComplimentary(db, row);
}

export async function findUserByGoogleSub(db: D1Database, sub: string) {
  const row = await db
    .prepare(
      `SELECT ${USER_COLUMNS}
       FROM users WHERE google_sub = ?`,
    )
    .bind(sub)
    .first<UserRow>();
  if (!row) return null;
  return ensureComplimentary(db, row);
}

export async function insertUser(
  db: D1Database,
  input: {
    email: string;
    displayName: string;
    passwordHash?: string | null;
    googleSub?: string | null;
    appleSub?: string | null;
    avatarUrl?: string | null;
  },
) {
  const now = new Date().toISOString();
  const user: UserRow = {
    id: crypto.randomUUID(),
    email: input.email,
    password_hash: input.passwordHash ?? null,
    display_name: input.displayName,
    google_sub: input.googleSub ?? null,
    apple_sub: input.appleSub ?? null,
    avatar_url: input.avatarUrl ?? null,
    created_at: now,
    last_seen_at: now,
    premium_plan: "none",
    premium_expires_at: null,
    premium_source: null,
    ads_free_until: null,
  };
  await db
    .prepare(
      `INSERT INTO users
        (id, email, password_hash, display_name, google_sub, apple_sub, avatar_url, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      user.id,
      user.email,
      user.password_hash,
      user.display_name,
      user.google_sub,
      user.apple_sub,
      user.avatar_url,
      user.created_at,
      user.last_seen_at,
    )
    .run();
  return ensureComplimentary(db, user);
}

type GoogleJwtPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  sub?: string;
};

type GoogleJwks = {
  keys: Array<JsonWebKey & { kid?: string }>;
};

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_AUDIENCES = new Set([
  "dev.altarislabs.ascentgames.chess",
  "dev.altarislabs.ascentgames.checkers",
]);

type AppleJwtPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  email?: string;
  sub?: string;
  nonce?: string;
};

export async function verifyAppleIdToken(token: string, rawNonce: string) {
  const parts = token.split(".");
  if (parts.length !== 3 || !rawNonce) throw new Error("invalid_token");
  const header = JSON.parse(
    new TextDecoder().decode(base64UrlToBytes(parts[0])),
  ) as { kid?: string; alg?: string };
  const payload = JSON.parse(
    new TextDecoder().decode(base64UrlToBytes(parts[1])),
  ) as AppleJwtPayload;
  if (header.alg !== "RS256" || !header.kid) throw new Error("invalid_token");

  const jwks = (await fetch("https://appleid.apple.com/auth/keys").then((res) => {
    if (!res.ok) throw new Error("certs_unavailable");
    return res.json();
  })) as GoogleJwks;
  const jwk = jwks.keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("unknown_key");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(parts[2]) as BufferSource,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw new Error("invalid_signature");

  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const audienceOk = audience.some((value) => value && APPLE_AUDIENCES.has(value));
  const expectedNonce = await sha256Hex(rawNonce);
  if (
    payload.iss !== APPLE_ISSUER ||
    !audienceOk ||
    !payload.exp ||
    payload.exp * 1000 <= Date.now() ||
    !payload.sub ||
    payload.nonce !== expectedNonce
  ) {
    throw new Error("invalid_claims");
  }

  const email = payload.email ? normalizeEmail(payload.email) : null;
  if (email && !isValidEmail(email)) throw new Error("invalid_claims");
  const clientId =
    audience.find((value) => value && APPLE_AUDIENCES.has(value)) || "";
  return { email, sub: payload.sub, clientId };
}

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function appleSignInClientSecret(env: Env, clientId: string): Promise<string | null> {
  if (!env.APPLE_TEAM_ID || !env.APPLE_SIGNIN_KEY_ID || !env.APPLE_SIGNIN_PRIVATE_KEY) {
    return null;
  }
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(env.APPLE_SIGNIN_PRIVATE_KEY) as BufferSource,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const iat = Math.floor(Date.now() / 1000);
  const header = base64UrlBytes(
    new TextEncoder().encode(
      JSON.stringify({ alg: "ES256", kid: env.APPLE_SIGNIN_KEY_ID, typ: "JWT" }),
    ),
  );
  const payload = base64UrlBytes(
    new TextEncoder().encode(
      JSON.stringify({
        iss: env.APPLE_TEAM_ID,
        iat,
        exp: iat + 15 * 60,
        aud: "https://appleid.apple.com",
        sub: clientId,
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlBytes(new Uint8Array(signature))}`;
}

async function ensureAppleTokenTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS apple_sign_in_tokens (
         user_id TEXT PRIMARY KEY,
         client_id TEXT NOT NULL,
         refresh_token TEXT NOT NULL,
         updated_at TEXT NOT NULL
       )`,
    )
    .run();
}

/** Exchanges the one-time Apple code so account deletion can revoke it. */
export async function rememberAppleAuthorizationCode(
  env: Env,
  userId: string,
  clientId: string,
  authorizationCode: string,
) {
  const secret = await appleSignInClientSecret(env, clientId);
  if (!secret || !authorizationCode) return;
  const response = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      code: authorizationCode,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) return;
  const data = (await response.json()) as { refresh_token?: string };
  if (!data.refresh_token) return;
  await ensureAppleTokenTable(env.ASCENT_DB);
  await env.ASCENT_DB.prepare(
    `INSERT INTO apple_sign_in_tokens (user_id, client_id, refresh_token, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       client_id = excluded.client_id,
       refresh_token = excluded.refresh_token,
       updated_at = excluded.updated_at`,
  )
    .bind(userId, clientId, data.refresh_token, new Date().toISOString())
    .run();
}

/** Revokes a stored Sign in with Apple refresh token, if this account has one. */
export async function revokeStoredAppleSignIn(env: Env, userId: string) {
  try {
    await ensureAppleTokenTable(env.ASCENT_DB);
    const row = await env.ASCENT_DB.prepare(
      `SELECT client_id, refresh_token FROM apple_sign_in_tokens WHERE user_id = ?`,
    )
      .bind(userId)
      .first<{ client_id: string; refresh_token: string }>();
    if (!row) return;
    const secret = await appleSignInClientSecret(env, row.client_id);
    if (secret) {
      await fetch("https://appleid.apple.com/auth/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: row.client_id,
          client_secret: secret,
          token: row.refresh_token,
          token_type_hint: "refresh_token",
        }),
      });
    }
    await env.ASCENT_DB.prepare(`DELETE FROM apple_sign_in_tokens WHERE user_id = ?`)
      .bind(userId)
      .run();
  } catch {
    // Account deletion still proceeds.
  }
}

export async function verifyGoogleIdToken(token: string, clientId: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid_token");
  const header = JSON.parse(
    new TextDecoder().decode(base64UrlToBytes(parts[0])),
  ) as { kid?: string; alg?: string };
  const payload = JSON.parse(
    new TextDecoder().decode(base64UrlToBytes(parts[1])),
  ) as GoogleJwtPayload;
  if (header.alg !== "RS256" || !header.kid) throw new Error("invalid_token");

  const jwks = (await fetch("https://www.googleapis.com/oauth2/v3/certs").then(
    (res) => {
      if (!res.ok) throw new Error("certs_unavailable");
      return res.json();
    },
  )) as GoogleJwks;
  const jwk = jwks.keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("unknown_key");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(parts[2]) as BufferSource,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw new Error("invalid_signature");

  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const issuerOk =
    payload.iss === "accounts.google.com" ||
    payload.iss === "https://accounts.google.com";
  const emailVerified =
    payload.email_verified === true || payload.email_verified === "true";
  if (
    !issuerOk ||
    !audience.includes(clientId) ||
    !payload.exp ||
    payload.exp * 1000 <= Date.now() ||
    !payload.email ||
    !emailVerified ||
    !payload.sub
  ) {
    throw new Error("invalid_claims");
  }

  return {
    email: normalizeEmail(payload.email),
    displayName: (payload.name || payload.email.split("@")[0]).slice(0, 80),
    avatarUrl: payload.picture || null,
    sub: payload.sub,
  };
}

export function requireSecret(env: Env) {
  return Boolean(env.AUTH_SECRET && env.ASCENT_DB);
}
