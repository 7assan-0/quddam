import { expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { historyHref } from "./history-policy";
import { LAUNCH_GAME_SLUGS } from "./launch-policy";

const official = [
  ["category-board", "/play", undefined], ["out-of-the-loop", "/social/host", undefined],
  ["letter-network", "/letter-network/host", undefined], ["survey-show", "/survey-show/host", "SURVEY_BATTLE"],
  ["secret-word", "/secret-word/host", "FORBIDDEN_WORD"], ["bluff", "/bluff/host", "BLUFF_GAME"],
  ["top-list", "/ranked/host", "RANKED_LIST"], ["lightning-quiz", "/lightning/host", "LIGHTNING_QUIZ"],
  ["ordering-challenge", "/ordering/host", "ORDERING_CHALLENGE"], ["the-court", "/court/host", "THE_COURT"],
] as const;
it("history policy covers exactly the existing ten launch slugs", () => { expect(official.map(([slug]) => slug)).toEqual(LAUNCH_GAME_SLUGS); });
it.each(official)("%s lobby, active, paused, result, completed and abandoned history use its actual route", (slug, prefix, module) => {
  for (const phase of ["LOBBY", "IN_PROGRESS", "PAUSED", "RESULTS", "COMPLETED", "ABANDONED"]) {
    expect(historyHref({ id: "saved-session", gameType: { slug }, state: { phase, module } })).toBe(`${prefix}/saved-session`);
  }
  expect(existsSync(`src/app${prefix}/[id]/page.tsx`)).toBe(true);
});
it.each(["survey-show", "secret-word", "bluff", "top-list", "lightning-quiz"])("%s legacy state is never routed to the dedicated replacement", slug => {
  for (const state of [{ schemaVersion: 1, slug, cards: [] }, null, [], { module: "OTHER" }]) expect(historyHref({ id: "old", gameType: { slug }, state })).toBe("/play/old");
});
it.each(["letter-battle", "fastest-mind", "party-court", "unknown", "constructor", "toString"])("%s retains safe historical fallback", slug => {
  expect(historyHref({ id: "old", gameType: { slug }, state: { phase: "DONE" } })).toBe("/play/old");
});
it("an identifier remains one path segment", () => { expect(historyHref({ id: "bad/id?x=1", gameType: { slug: "out-of-the-loop" }, state: {} })).toBe("/social/host/bad%2Fid%3Fx%3D1"); });
it("profile delegates navigation while retaining its owner filter", () => {
  const source = readFileSync("src/app/profile/page.tsx", "utf8");
  expect(source).toContain("href={historyHref(game)}"); expect(source).toContain("where: { hostId: user.id }");
  for (const prefix of ["/social/host", "/letter-network/host"]) {
    const page = readFileSync(`src/app${prefix}/[id]/page.tsx`, "utf8");
    expect(page).toContain("requireUser()"); expect(page).toMatch(/id:\s*user\.id/); expect(page).toMatch(/\[403,\s*404\]/);
  }
});
