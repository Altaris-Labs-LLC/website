# Stripe integration — remaining setup

Embedded Checkout Form is wired for Ascent Premium. This file is the single source of truth for what is already set and what you still have to do before a real charge can succeed.

No Stripe server SDK is installed. Checkout Sessions are created with `fetch` against the Stripe API. Because there is no `stripe` npm package to version-check, `ui_mode` is `form` (the value for Stripe.js / server SDK 21.0.0 and above). If you later install a Stripe server SDK older than 21.0.0, change `ui_mode` to `custom`.

## Values to Replace

`mode` and `line_items` are not placeholders. Checkout is a recurring subscription, and each session builds the price inline:

| Plan | Amount | Interval |
|------|--------|----------|
| Monthly | $5.99 (`unit_amount` 599) | month |
| Yearly | $49.99 (`unit_amount` 4999) | year |

There is no `price_...` id to swap in. Change those amounts in [functions/api/subscription/_stripe.ts](functions/api/subscription/_stripe.ts) only if the prices themselves change.

## Configured Parameters

These parameters were configured in Checkout Studio and are already set.

**Files containing these parameters:**

- [functions/api/subscription/_stripe.ts](functions/api/subscription/_stripe.ts)

| Parameter | Value |
|-----------|-------|
| ui_mode | form |
| billing_address_collection | auto |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| payment_method_collection | always (included because mode is subscription) |
| submit_type | auto |
| integration_identifier | custom_embedded_web_0001 |
| mode | subscription |
| line_items | inline `price_data`: $5.99 / month or $49.99 / year |

The Stripe API version sent on every server request is `2026-03-25.dahlia; custom_checkout_payment_form_preview=v1`.

The browser loads Stripe.js from `https://js.stripe.com/dahlia/stripe.js` and initializes it with `betas: ['custom_checkout_payment_form_1']`. The form mounts in `#checkout-form` on the subscription page.

## Setup and next steps

### Environment variables

This site is Next.js on Cloudflare Pages, not Vite. Do not prefix these with `VITE_`. Names must match the code in [functions/api/auth/_lib.ts](functions/api/auth/_lib.ts):

| Variable | Where it is used | What to set |
|----------|------------------|-------------|
| `STRIPE_SECRET_KEY` | Server only. Creates Checkout Sessions, confirms them, and verifies webhooks. | Secret key from [Stripe API keys](https://dashboard.stripe.com/test/apikeys). Start with `sk_test_...`. |
| `STRIPE_PUBLISHABLE_KEY` | Returned to the browser so Stripe.js can open the form. | Publishable key, `pk_test_...`, from the same page. |
| `STRIPE_WEBHOOK_SECRET` | Verifies `Stripe-Signature` on `/api/subscription/webhook`. | Signing secret from the webhook endpoint, `whsec_...`. |

Set them on the Pages project (do not commit them):

```text
npx wrangler pages secret put STRIPE_SECRET_KEY --project-name altaris-labs
npx wrangler pages secret put STRIPE_PUBLISHABLE_KEY --project-name altaris-labs
npx wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name altaris-labs
```

Production currently has `AUTH_SECRET` and `RESEND_API_KEY` only. Checkout returns “not configured” until the three Stripe secrets exist.

### Project structure

No new routes were added. The existing checkout call was updated.

| File | Role |
|------|------|
| [functions/api/subscription/_stripe.ts](functions/api/subscription/_stripe.ts) | Creates the Checkout Session and grants Premium. |
| [functions/api/subscription/checkout.ts](functions/api/subscription/checkout.ts) | `POST /api/subscription/checkout` returns `{ client_secret, session_id, publishableKey }`. |
| [functions/api/subscription/confirm.ts](functions/api/subscription/confirm.ts) | Verifies the completed session and writes Premium on the account. |
| [functions/api/subscription/webhook.ts](functions/api/subscription/webhook.ts) | Renewals, updates, and cancellations. |
| [functions/api/subscription/portal.ts](functions/api/subscription/portal.ts) | Stripe Customer Portal for an existing subscriber. |
| [components/AscentSubscription.tsx](components/AscentSubscription.tsx) | Subscribe button, embedded form, confirm handler. |
| [app/layout.tsx](app/layout.tsx) | Loads `https://js.stripe.com/dahlia/stripe.js`. |

### How it works

1. A signed-in user on `/ascentgames/subscription` chooses Monthly or Yearly and presses Subscribe.
2. The page `POST`s `{ plan }` to `/api/subscription/checkout`.
3. The server creates a Checkout Session (`mode=subscription`, `ui_mode=form`) and returns the client secret.
4. Stripe.js mounts the embedded form in `#checkout-form`. Card and PayPal appear there once those methods are enabled in Stripe.
5. On confirm, the form calls `actions.confirm`, then the page `POST`s the session id to `/api/subscription/confirm`, which grants Premium.
6. Later invoices and cancellations arrive at `POST /api/subscription/webhook`.

### Stripe Dashboard (test mode first)

1. Turn on [test mode](https://dashboard.stripe.com/test/dashboard).
2. Enable card payments. For PayPal on a subscription, enable PayPal for recurring payments under payment methods. PayPal is collected inside this form; there is no separate PayPal button.
3. Add a webhook endpoint: `https://altarislabs.dev/api/subscription/webhook`.
   Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`.
4. Activate the [Customer Portal](https://dashboard.stripe.com/test/settings/billing/portal) so Manage billing works. Allow customers to cancel.
5. Deploy this website. The live site does not have this form until it is published, and it cannot charge until the secrets above are set.

### Test cards

Use [Stripe test cards](https://docs.stripe.com/testing) while the keys are `sk_test_` / `pk_test_`:

| Number | Result |
|--------|--------|
| `4242 4242 4242 4242` | Payment succeeds |
| `4000 0025 0000 3155` | Requires authentication |
| `4000 0000 0000 9995` | Card declined |

Any future expiry, any CVC, any postal code. A successful test payment should show Premium on the subscription page and in the apps for that account.

When test checkout, the webhook, and a renewal or cancel all behave, create a live webhook, swap in `sk_live_` / `pk_live_` and the live webhook secret, and deploy again.

### Gold and Marketplace payouts

- Gold packs use Stripe-hosted Checkout (`mode=payment`) from `POST /api/gold/checkout`; the return page `/ascentgames/gold` confirms the session and the webhook is the backup.
- Add these events to the existing webhook endpoint: `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created` (plus the subscription events above).
- Seller payouts use Stripe Connect Express accounts (`POST /api/gold/payout-onboarding`) and transfers approved on `/ascentgames/admin/marketplace`. Enable Connect in the Dashboard and keep enough available balance in Stripe to fund transfers.

### After the first real payment

- Fulfillment is already the Premium grant (`users.premium_plan`, `premium_expires_at`, `premium_source=stripe`, plus a `subscription_purchases` row). Confirm covers the first payment; the webhook covers renewals and cancellation.
- Do not store card numbers. Stripe hosts the form.
- Update the monthly or yearly amount in `_stripe.ts` if the price changes, then deploy.
- Support: https://support.stripe.com and https://docs.stripe.com/mcp
