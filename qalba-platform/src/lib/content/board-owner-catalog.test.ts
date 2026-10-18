import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boardCatalog } from "../../../prisma/board-expansion/quality-gate";
import {
  retiredFromBoard, ownerRequestedAdditions, ownerAlreadyExistingAddition,
  ownerBoardCatalogProposal, unresolvedCategorySlots, guessPictureEditorialContract,
} from "../../../prisma/board-expansion/owner-catalog-proposal";

describe("Board27 owner choices are honest, unique, and isolated", () => {
  it("records exactly five removals and four actually new category slugs", () => {
    expect(retiredFromBoard).toEqual(["anime", "jobs", "objects", "images", "travel"]);
    expect(ownerRequestedAdditions).toEqual([
      ["guess-picture", "خمن الصورة"], ["country-flags", "أعلام دول"],
      ["proverbs", "أمثال"], ["maps", "خرائط"],
    ]);
    expect(boardCatalog.filter(([slug]) => slug === "riddles")).toHaveLength(1);
    expect(ownerAlreadyExistingAddition).toBe("riddles");
  });
  it("never silently claims that 26 unique requests amount to 27", () => {
    expect(ownerBoardCatalogProposal).toHaveLength(26);
    expect(unresolvedCategorySlots).toBe(1);
    const slugs = ownerBoardCatalogProposal.map(([slug]) => slug);
    const names = ownerBoardCatalogProposal.map(([, title]) => title);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(names).size).toBe(names.length);
    for (const slug of retiredFromBoard) expect(slugs).not.toContain(slug);
    expect(slugs.filter(slug => slug === "riddles")).toHaveLength(1);
    expect(names.filter(name => name === "ألغاز")).toHaveLength(1);
    expect(slugs.filter(slug => slug === "guess-picture")).toHaveLength(1);
  });
  it("does not alter global seed category names or game-specific legacy slugs", () => {
    const source = readFileSync(new URL("../../../prisma/seed.ts", import.meta.url), "utf8");
    const all = source.match(/const slugs = \[([\s\S]*?)\];/);
    expect(all).not.toBeNull();
    const seedSlugs = [...all![1].matchAll(/"([^"]+)"/g)].map(match => match[1]);
    expect(seedSlugs).toHaveLength(27);
    expect(new Set(seedSlugs).size).toBe(27);
    for (const slug of retiredFromBoard) expect(seedSlugs).toContain(slug);
    for (const [slug] of ownerRequestedAdditions) expect(seedSlugs).not.toContain(slug);
  });
  it("supports flexible visual rebus layout and does not mistake element count for difficulty", () => {
    const c = guessPictureEditorialContract;
    expect(c.allowsThreePictures && c.allowsFourPictures && c.allowsMorePicturesWhenLegible).toBe(true);
    expect(c.formats).toEqual(["image", "letter", "short-word", "symbol"]);
    expect(c.requiresOneIntendedReviewedSolution).toBe(true);
    expect(c.requiresOriginalOrLicensedArt).toBe(true);
    expect(c.requiresHumanReadabilityAndAmbiguityReview).toBe(true);
    expect(c.difficultyByElementCount).toBe(false);
  });
});
