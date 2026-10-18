/**
 * Owner-requested Board-only catalog proposal, NOT the shared global Category seed.
 *
 * FIVE requested removals: anime, jobs, objects, images, travel.
 * FIVE requested additions contained an already-existing "riddles" category.
 * Therefore: 27 - 5 + 4 UNIQUE additions = 26 distinct categories; the 27th
 * needs an explicit owner choice. Do not invent or double-list one.
 *
 * This module is intentionally NOT imported by runtime or Prisma seed and does
 * not change identifiers or category ownership for other games.
 */
import { boardCatalog } from "./quality-gate";

export const retiredFromBoard = ["anime", "jobs", "objects", "images", "travel"] as const;

export const ownerRequestedAdditions = [
  ["guess-picture", "خمن الصورة"],
  ["country-flags", "أعلام دول"],
  ["proverbs", "أمثال"],
  ["maps", "خرائط"],
] as const;

export const ownerAlreadyExistingAddition = "riddles" as const; // ألغاز، kept exactly once

const removed = new Set<string>(retiredFromBoard);
export const ownerBoardCatalogProposal = [
  ...boardCatalog.filter(([slug]) => !removed.has(slug)),
  ...ownerRequestedAdditions,
] as const;

export const unresolvedCategorySlots = 27 - ownerBoardCatalogProposal.length;

/**
 * Content brief for "خمن الصورة": an original visual rebus, NOT identify-the-
 * object. Multiple pictures (including 2, 3, 4 or more when legible) may combine
 * with letters, words and symbols into ONE reviewed word, name or expression.
 * Difficulty is empirically calibrated, not inferred from element count.
 * All proposed image assets need documented rights or original authorship.
 */
export const guessPictureEditorialContract = {
  formats: ["image", "letter", "short-word", "symbol"] as const,
  minimumPictures: 1,
  allowsThreePictures: true,
  allowsFourPictures: true,
  allowsMorePicturesWhenLegible: true,
  requiresOneIntendedReviewedSolution: true,
  requiresOriginalOrLicensedArt: true,
  requiresHumanReadabilityAndAmbiguityReview: true,
  difficultyByElementCount: false,
} as const;
