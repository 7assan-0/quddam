import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boardCatalog } from "../../../prisma/board-expansion/quality-gate";
import {
  retiredFromBoard, ownerRequestedAdditions, ownerAlreadyExistingAddition,
  ownerBoardCatalogProposal, unresolvedCategorySlots, guessPictureEditorialContract, currenciesEditorialContract,
} from "../../../prisma/board-expansion/owner-catalog-proposal";

describe("Board27 owner choices are honest, unique, and isolated", () => {
  it("records exactly five removals and five distinct new category slugs", () => {
    expect(retiredFromBoard).toEqual(["anime", "jobs", "objects", "images", "travel"]);
    expect(ownerRequestedAdditions).toEqual([
      ["guess-picture", "خمن الصورة"], ["country-flags", "أعلام دول"],
      ["proverbs", "أمثال"], ["maps", "خرائط"], ["currencies", "عملات"],
    ]);
    expect(boardCatalog.filter(([slug]) => slug === "riddles")).toHaveLength(1);
    expect(ownerAlreadyExistingAddition).toBe("riddles");
  });
  it("keeps exactly 27 unique approved choices and no outstanding slot", () => {
    expect(ownerBoardCatalogProposal).toHaveLength(27);
    expect(unresolvedCategorySlots).toBe(0);
    const slugs = ownerBoardCatalogProposal.map(([slug]) => slug);
    const names = ownerBoardCatalogProposal.map(([, title]) => title);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(names).size).toBe(names.length);
    for (const slug of retiredFromBoard) expect(slugs).not.toContain(slug);
    expect(slugs.filter(slug => slug === "riddles")).toHaveLength(1);
    expect(names.filter(name => name === "ألغاز")).toHaveLength(1);
    expect(slugs.filter(slug => slug === "guess-picture")).toHaveLength(1);
    expect(slugs.filter(slug => slug === "currencies")).toHaveLength(1);
    expect(names.filter(name => name === "عملات")).toHaveLength(1);
  });
  it("keeps the new currencies category non-dynamic and subject to item review", () => {
    const c = currenciesEditorialContract;
    expect(c.slug).toBe("currencies");
    expect(c.title).toBe("عملات");
    expect(c.questionTypes).toContain("saudi-currency");
    expect(c.questionTypes).toContain("original-or-licensed-note-image");
    expect(c.avoidLiveExchangeRates).toBe(true);
    expect(c.verifyCurrencyValidityAtQuestionDate).toBe(true);
    expect(c.requireClearCountryContextForSharedCurrencyNamesOrSymbols).toBe(true);
    expect(c.requireOriginalOrLicensedAssets).toBe(true);
    expect(c.questionsPerCategory).toBe(96);
    expect(c.questionsPerGrade).toBe(32);
    expect(c.publicationRequiresIndependentReview).toBe(true);
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
