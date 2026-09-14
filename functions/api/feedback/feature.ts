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
  utcDayPrefix,
} from "./_lib";

const MIN_CHARS = 200;
const MAX_CHARS = 1000;
const LAURELS_PER_SUBMISSION = 500;

type FeatureBody = {
  description?: unknown;
};

export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  if (!requireSecret(context.env)) {
    return json(context.request, { error: "Feedback is unavailable." }, 503);
  }
  const user = await userFromRequest(context.env, context.request);
  if (!user) {
    return json(
      context.request,
      { error: "You must be logged in to submit a feature suggestion." },
      401,
    );
  }

  const body = await readJson<FeatureBody>(context.request);
  const description = asText(body?.description, MAX_CHARS);
  if (description.length < MIN_CHARS) {
    return json(
      context.request,
      {
        error: `Describe the feature in at least ${MIN_CHARS} characters (max ${MAX_CHARS}).`,
      },
      400,
    );
  }

  const day = utcDayPrefix();
  const prior = await context.env.ASCENT_DB.prepare(
    `SELECT id FROM feedback_feature_requests
     WHERE user_id = ? AND substr(created_at, 1, 10) = ?
     LIMIT 1`,
  )
    .bind(user.id, day)
    .first<{ id: string }>();
  if (prior) {
    return json(
      context.request,
      {
        error:
          "You can submit one feature suggestion per day. Try again tomorrow.",
        alreadySubmittedToday: true,
      },
      429,
    );
  }

  const id = newId("feat");
  const createdAt = new Date().toISOString();
  await context.env.ASCENT_DB.prepare(
    `INSERT INTO feedback_feature_requests
      (id, user_id, description, laurels_awarded, status, created_at)
     VALUES (?, ?, ?, ?, 'submitted', ?)`,
  )
    .bind(id, user.id, description, LAURELS_PER_SUBMISSION, createdAt)
    .run();

  const emailSent = await sendFeedbackEmail(context.env, {
    subject: "[Ascent feature] New suggestion",
    replyTo: user.email,
    text: [
      "New Ascent Games feature suggestion",
      "",
      feedbackUserBlock(user),
      `Suggestion id: ${id}`,
      `Submitted at: ${createdAt}`,
      `Laurels awarded: ${LAURELS_PER_SUBMISSION}`,
      "",
      "Suggestion:",
      description,
    ].join("\n"),
  });

  return json(context.request, {
    ok: true,
    id,
    laurelsAwarded: LAURELS_PER_SUBMISSION,
    emailSent,
  });
}
