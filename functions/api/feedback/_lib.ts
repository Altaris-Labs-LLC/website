import type { AuthUser, Env } from "../auth/_lib";

export function asText(value: unknown, max = 4000): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function newId(prefix: string): string {
  const rand = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}_${rand}`;
}

export function utcDayPrefix(iso = new Date().toISOString()): string {
  return iso.slice(0, 10);
}

const FEEDBACK_INBOX = "brentunderwood@altarislabs.dev";
const FEEDBACK_FROM = "Ascent Games Feedback <feedback@altarislabs.dev>";

export type FeedbackEmailPayload = {
  subject: string;
  text: string;
  replyTo: string;
};

/** Sends a plain-text alert via Resend. Returns false if skipped/failed. */
export async function sendFeedbackEmail(
  env: Env,
  payload: FeedbackEmailPayload,
): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("RESEND_API_KEY is not configured; feedback email skipped.");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FEEDBACK_FROM,
        to: [FEEDBACK_INBOX],
        reply_to: payload.replyTo,
        subject: payload.subject,
        text: payload.text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`Resend failed (${res.status}): ${detail}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend request failed:", err);
    return false;
  }
}

export function feedbackUserBlock(user: AuthUser): string {
  return [
    `From user: ${user.displayName}`,
    `User email: ${user.email}`,
    `User id: ${user.id}`,
  ].join("\n");
}
