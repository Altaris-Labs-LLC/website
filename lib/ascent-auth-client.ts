export type AscentSubscription = {
  plan: "none" | "monthly" | "yearly" | "lifetime";
  expiresAt: string | null;
  source: string | null;
  isPremium: boolean;
};

export type AscentUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  subscription?: AscentSubscription;
};

type AuthResponse = {
  user?: AscentUser | null;
  error?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = (await response.json().catch(() => null)) as T & AuthResponse;
  if (!response.ok) {
    throw new Error(data?.error || "The request could not be completed.");
  }
  return data;
}

export async function fetchAuthConfig() {
  return request<{ googleClientId: string | null }>("/api/auth/config");
}

export async function fetchCurrentUser() {
  const data = await request<{ user: AscentUser | null }>("/api/auth/me");
  return data.user;
}

export async function signUp(input: {
  email: string;
  password: string;
  displayName: string;
}) {
  const data = await request<{ user: AscentUser }>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.user;
}

export async function logIn(input: { email: string; password: string }) {
  const data = await request<{ user: AscentUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.user;
}

export async function logInWithGoogle(credential: string) {
  const data = await request<{ user: AscentUser }>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
  return data.user;
}

export async function logOut() {
  await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

export async function deleteAccount(confirmation: string) {
  await request<{ ok: boolean }>("/api/auth/delete", {
    method: "POST",
    body: JSON.stringify({ confirmation }),
  });
}

export const ASCENT_AUTH_CHANGED = "ascent-auth-changed";

export function notifyAscentAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ASCENT_AUTH_CHANGED));
  }
}
