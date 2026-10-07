import { describe, expect, it } from "vitest";
import { featuredGames } from "@/lib/brand/games";
import { partySlugs } from "./party/types";
import { isLaunchCreationAllowed, isLaunchGameSlug, LAUNCH_GAMES, LAUNCH_GAME_SLUGS, launchGame } from "./launch-policy";

describe("ten completed launch experiences", () => {
  it("has exactly the product-approved slugs and unique dedicated create paths", () => {
    expect(LAUNCH_GAME_SLUGS).toEqual(["category-board", "out-of-the-loop", "letter-network", "survey-show", "secret-word", "bluff", "top-list", "lightning-quiz", "ordering-challenge", "the-court"]);
    expect(new Set(LAUNCH_GAMES.map(game => game.newHref)).size).toBe(10);
    expect(new Set(LAUNCH_GAMES.map(game => game.creationApi)).size).toBe(10);
    for (const game of LAUNCH_GAMES) expect(isLaunchCreationAllowed(game.slug, game.creationApi)).toBe(true);
  });
  it("never grants generic-party creation from a shared or non-launch slug", () => {
    for (const slug of partySlugs) expect(isLaunchCreationAllowed(slug, `/api/games/party/${slug}`)).toBe(false);
    for (const slug of ["letter-battle", "fastest-mind", "party-court", "unknown-game", "__proto__"]) {
      expect(isLaunchGameSlug(slug)).toBe(false); expect(launchGame(slug)).toBeUndefined();
    }
    expect(isLaunchCreationAllowed("bluff", "/api/ranked")).toBe(false);
  });
  it("keeps the unchanged public Quddam showcase aligned with launch eligibility", () => {
    expect(featuredGames.map(game => game.slug)).toEqual(LAUNCH_GAME_SLUGS);
  });
});
