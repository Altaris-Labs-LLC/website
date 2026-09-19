import { site } from "@/lib/site";

export type AscentSupportApp = {
  /** URL slug under /ascentgames/support/[slug] */
  slug: string;
  productName: string;
  /** One-line blurb for the directory. */
  summary: string;
  /** Shown on the per-app support page. */
  helpTopics: string[];
  /** App Store / Play Console support URL should point at this page. */
  storeReady: boolean;
};

/**
 * Product support catalog. Add a row when a new Ascent title ships —
 * the directory and static routes pick it up automatically.
 */
export const ascentSupportApps: AscentSupportApp[] = [
  {
    slug: "chess",
    productName: "Chess Ascent",
    summary:
      "Openings, midgame training, endgames, analysis, and account help for Chess Ascent.",
    helpTopics: [
      "Signing in and Google account issues",
      "Subscriptions, Premium, and restore purchases",
      "Cloud backup and restoring progress",
      "Training modes, puzzles, and repertoires",
      "Bugs, crashes, and feature ideas",
    ],
    storeReady: true,
  },
  {
    slug: "checkers",
    productName: "Checkers Ascent",
    summary:
      "Training tools, analysis, Premium, and account help for Checkers Ascent.",
    helpTopics: [
      "Signing in and Google account issues",
      "Subscriptions, Premium, and restore purchases",
      "Cloud backup and restoring progress",
      "Training modes, puzzles, and repertoires",
      "Bugs, crashes, and feature ideas",
    ],
    storeReady: true,
  },
];

export function getAscentSupportApp(
  slug: string,
): AscentSupportApp | undefined {
  return ascentSupportApps.find((app) => app.slug === slug);
}

export function ascentSupportPath(slug: string): string {
  return `/ascentgames/support/${slug}`;
}

export function ascentSupportEmail(): string {
  return "feedback@altarislabs.dev";
}

export function altarisSupportEmail(): string {
  return site.email;
}
