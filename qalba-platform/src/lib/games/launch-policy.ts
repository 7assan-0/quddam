/** Launch eligibility is independent of mutable GameType.enabled and legacy registries. */
export const LAUNCH_GAMES = [
  { slug: "category-board", newHref: "/games/category-board/new", creationApi: "/api/games/category-board" },
  { slug: "out-of-the-loop", newHref: "/games/out-of-the-loop/new", creationApi: "/api/social" },
  { slug: "letter-network", newHref: "/games/letter-network/new", creationApi: "/api/letter-network" },
  { slug: "survey-show", newHref: "/games/survey-show/new", creationApi: "/api/survey-show" },
  { slug: "secret-word", newHref: "/games/secret-word/new", creationApi: "/api/secret-word" },
  { slug: "bluff", newHref: "/bluff/new", creationApi: "/api/bluff" },
  { slug: "top-list", newHref: "/ranked/new", creationApi: "/api/ranked" },
  { slug: "lightning-quiz", newHref: "/lightning/new", creationApi: "/api/lightning" },
  { slug: "ordering-challenge", newHref: "/ordering/new", creationApi: "/api/ordering" },
  { slug: "the-court", newHref: "/court/new", creationApi: "/api/court" },
] as const;

export const LAUNCH_GAME_SLUGS = LAUNCH_GAMES.map(game => game.slug);
export type LaunchGameSlug = typeof LAUNCH_GAMES[number]["slug"];
export function launchGame(slug: string) { return LAUNCH_GAMES.find(game => game.slug === slug); }
export function isLaunchGameSlug(slug: string): slug is LaunchGameSlug { return Boolean(launchGame(slug)); }

/** A shared slug does not authorize creation through the older generic party API. */
export function isLaunchCreationAllowed(slug: string, creationApi: string): boolean {
  return launchGame(slug)?.creationApi === creationApi;
}
