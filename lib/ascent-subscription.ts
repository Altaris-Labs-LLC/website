export const ASCENT_PLANS = [
  {
    id: "monthly",
    productId: "ascent_premium_monthly",
    title: "Monthly",
    price: "$5.99",
    cadence: "Billed every month",
  },
  {
    id: "yearly",
    productId: "ascent_premium_yearly",
    title: "Yearly",
    price: "$49.99",
    cadence: "Billed once a year",
  },
] as const;

export const APPLE_MANAGE_URL = "https://apps.apple.com/account/subscriptions";
export const GOOGLE_MANAGE_URL =
  "https://play.google.com/store/account/subscriptions";
export const APPLE_EULA_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
export const PRIVACY_URL = "/privacy";
export const TERMS_URL = "/terms";
