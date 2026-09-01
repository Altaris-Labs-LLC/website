export const ascentArt = {
  mark: "/brand/ascent/mark.png",
  hero: "/brand/ascent/hero.jpg",
  texture: "/brand/ascent/texture.jpg",
  chess: "/brand/ascent/games/chess.jpg",
  checkers: "/brand/ascent/games/checkers.jpg",
} as const;

export function isAscentPath(pathname: string) {
  return (
    pathname === "/ascentgames" ||
    pathname.startsWith("/ascentgames/") ||
    pathname.startsWith("/ascent_games") ||
    pathname === "/games" ||
    pathname.startsWith("/games/") ||
    pathname === "/account" ||
    pathname === "/leaderboards"
  );
}
