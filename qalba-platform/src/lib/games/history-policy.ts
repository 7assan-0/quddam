import type { LaunchGameSlug } from "./launch-policy";

const HOST_ROUTES: Record<LaunchGameSlug, { prefix: string; module?: string }> = {
  "category-board": { prefix: "/play" },
  "out-of-the-loop": { prefix: "/social/host" },
  "letter-network": { prefix: "/letter-network/host" },
  "survey-show": { prefix: "/survey-show/host", module: "SURVEY_BATTLE" },
  "secret-word": { prefix: "/secret-word/host", module: "FORBIDDEN_WORD" },
  bluff: { prefix: "/bluff/host", module: "BLUFF_GAME" },
  "top-list": { prefix: "/ranked/host", module: "RANKED_LIST" },
  "lightning-quiz": { prefix: "/lightning/host", module: "LIGHTNING_QUIZ" },
  "ordering-challenge": { prefix: "/ordering/host" },
  "the-court": { prefix: "/court/host" },
};

/** Navigation only: destination pages retain authentication and ownership checks.
 * Shared catalog slugs must not redirect historical generic party state. */
export function historyHref(game: { id: string; gameType: { slug: string }; state: unknown }) {
  const route = Object.hasOwn(HOST_ROUTES, game.gameType.slug) ? HOST_ROUTES[game.gameType.slug as LaunchGameSlug] : undefined;
  const state = game.state;
  const dedicated = route && (!route.module || (state !== null && typeof state === "object" && !Array.isArray(state)
    && "module" in state && state.module === route.module));
  return `${dedicated ? route.prefix : "/play"}/${encodeURIComponent(game.id)}`;
}
