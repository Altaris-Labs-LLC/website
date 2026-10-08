import { json, readJson, requireSecret, userFromRequest, type Env } from "../auth/_lib";
import { creditPack, errorJson, notifyAdmin, packForProduct, walletJson } from "./_lib";
import { verifyStorePurchase, VerifyError } from "./_verify";

type Body = {
  platform?: unknown;
  productId?: unknown;
  purchaseId?: unknown;
  verificationData?: unknown;
};

/** Credits an App Store / Google Play Gold pack after verifying it with the store. */
export async function onRequestPost(context: EventContext<Env, string, unknown>) {
  const { request, env } = context;
  if (!requireSecret(env)) return errorJson(request, "Gold is unavailable.", 503);
  const user = await userFromRequest(env, request);
  if (!user) return errorJson(request, "Sign in to buy Gold.", 401);

  const body = await readJson<Body>(request);
  const platform = typeof body?.platform === "string" ? body.platform.trim() : "";
  const productId = typeof body?.productId === "string" ? body.productId.trim() : "";
  const purchaseId = typeof body?.purchaseId === "string" ? body.purchaseId.trim() : "";
  const verificationData =
    typeof body?.verificationData === "string" ? body.verificationData.trim() : "";
  const product = packForProduct(productId);
  if (!product || (platform !== "apple" && platform !== "google")) {
    return errorJson(request, "That purchase could not be read.");
  }
  if (!purchaseId && !verificationData) {
    return errorJson(request, "That purchase could not be read.");
  }

  let verified;
  try {
    verified = await verifyStorePurchase(env, {
      platform,
      game: product.game,
      productId,
      purchaseId,
      verificationData,
    });
  } catch (error) {
    if (error instanceof VerifyError) {
      return errorJson(request, error.message, error.status);
    }
    return errorJson(request, "The store could not confirm this purchase yet.", 503);
  }

  const result = await creditPack(env, {
    userId: user.id,
    platform,
    productId,
    pack: product.pack,
    purchaseKey: verified.purchaseKey,
    paymentRef: verified.paymentRef,
    test: verified.test,
  });
  if (!result.credited && result.ownerId !== user.id) {
    await notifyAdmin(
      env,
      "Gold receipt reuse",
      `User ${user.id} (${user.email}) submitted a ${platform} receipt already credited to ${result.ownerId}.`,
    );
    // 200 so the app finishes the store transaction instead of retrying forever.
    return json(request, {
      credited: false,
      otherAccount: true,
      wallet: await walletJson(env, user.id),
    });
  }
  return json(request, {
    credited: result.credited,
    otherAccount: false,
    gold: product.pack.gold,
    laurels: product.pack.laurels,
    wallet: await walletJson(env, user.id),
  });
}
