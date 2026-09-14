import {
  json,
  readJson,
  requireSecret,
  userFromRequest,
  type Env,
} from "../auth/_lib";
import {
  asText,
  feedbackUserBlock,
  newId,
  sendFeedbackEmail,
} from "./_lib";

type BugBody = {
  gameId?: unknown;
  appArea?: unknown;
  expectedBehavior?: unknown;
  actualBehavior?: unknown;
  steps?: unknown;
  appVersion?: unknown;
  platform?: unknown;
};

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Feedback is unavailable." }, 503);
  }
  const user = await userFromRequest(context.env, context.request);
  if (!user) {
    return json(
      context.request,
      { error: "You must be logged in to submit a bug report." },
      401,
    );
  }

  const body = await readJson<BugBody>(context.request);
  const appArea = asText(body?.appArea, 120);
  const expectedBehavior = asText(body?.expectedBehavior, 4000);
  const actualBehavior = asText(body?.actualBehavior, 4000);
  const steps = asText(body?.steps, 4000);
  const gameId = asText(body?.gameId, 40).toLowerCase();
  const appVersion = asText(body?.appVersion, 40);
  const platform = asText(body?.platform, 40);

  if (!appArea) {
    return json(context.request, { error: "Choose which section of the app." }, 400);
  }
  if (expectedBehavior.length < 10) {
    return json(
      context.request,
      { error: "Describe the expected behavior (at least a short sentence)." },
      400,
    );
  }
  if (actualBehavior.length < 10) {
    return json(
      context.request,
      { error: "Describe what actually happened (at least a short sentence)." },
      400,
    );
  }
  if (steps.length < 10) {
    return json(
      context.request,
      { error: "Describe the steps that led to the bug." },
      400,
    );
  }

  const id = newId("bug");
  const createdAt = new Date().toISOString();
  await context.env.ASCENT_DB.prepare(
    `INSERT INTO feedback_bug_reports
      (id, user_id, game_id, app_area, expected_behavior, actual_behavior, steps,
       app_version, platform, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.id,
      gameId || null,
      appArea,
      expectedBehavior,
      actualBehavior,
      steps,
      appVersion || null,
      platform || null,
      createdAt,
    )
    .run();

  const emailSent = await sendFeedbackEmail(context.env, {
    subject: `[Ascent bug] ${appArea}`,
    replyTo: user.email,
    text: [
      "New Ascent Games bug report",
      "",
      feedbackUserBlock(user),
      `Report id: ${id}`,
      `Submitted at: ${createdAt}`,
      `Game: ${gameId || "(not specified)"}`,
      `App section: ${appArea}`,
      `Platform: ${platform || "(not specified)"}`,
      `App version: ${appVersion || "(not specified)"}`,
      "",
      "Expected behavior:",
      expectedBehavior,
      "",
      "What actually happened:",
      actualBehavior,
      "",
      "Steps to reproduce:",
      steps,
    ].join("\n"),
  });

  return json(context.request, { ok: true, id, emailSent });
}
