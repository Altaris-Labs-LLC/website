import { site } from "@/lib/site";

export type AscentPrivacyGame = {
  slug: string;
  productName: string;
  summary: string;
};

export const ascentPrivacyGames: AscentPrivacyGame[] = [
  {
    slug: "chess",
    productName: "Chess Ascent",
    summary:
      "Chess Ascent is a chess training app for repertoires, analysis, practice, and progress tracking.",
  },
  {
    slug: "checkers",
    productName: "Checkers Ascent",
    summary:
      "Checkers Ascent is a checkers training app for repertoires, analysis, practice, and progress tracking.",
  },
  {
    slug: "genesis_idle",
    productName: "Genesis Idle",
    summary:
      "Genesis Idle is an idle game with local progression and save data.",
  },
];

export function getAscentPrivacyGame(slug: string): AscentPrivacyGame | undefined {
  return ascentPrivacyGames.find((game) => game.slug === slug);
}

export function privacyContactLine(): string {
  return `Questions: ${site.email}`;
}

export function privacyLegalEntity(): string {
  return site.legalName;
}
