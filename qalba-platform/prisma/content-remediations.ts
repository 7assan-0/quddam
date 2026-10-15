/** Stable IDs remain intact for historical references. No array reordering. */
export const duplicateOrderingIds = new Set(['ordering-seed-054','ordering-seed-062','ordering-seed-070','ordering-seed-078','ordering-seed-086','ordering-seed-094','ordering-seed-102','ordering-seed-110','ordering-seed-118','ordering-seed-120']);

/** Editorial holds after independent cross-bank fact comparison in Bluff_34_Semantic_Comparison_Triage.csv.
 * Preserve stable IDs and historical round snapshots. Only these 33 are deliberately ARCHIVED;
 * a matching answer alone is not a hold (e.g. the distinct Red Sea geographic relation).
 * No production mutation occurs from this source change alone. */
export const bluffSemanticHoldIds = new Set([
  "bluff-seed-general-2",
  "bluff-seed-saudi-1",
  "bluff-seed-saudi-11",
  "bluff-seed-history-2",
  "bluff-seed-history-3",
  "bluff-seed-history-7",
  "bluff-seed-geography-2",
  "bluff-seed-geography-5",
  "bluff-seed-geography-7",
  "bluff-seed-science-4",
  "bluff-seed-science-5",
  "bluff-seed-science-7",
  "bluff-seed-science-9",
  "bluff-seed-science-11",
  "bluff-seed-science-12",
  "bluff-seed-technology-2",
  "bluff-seed-technology-3",
  "bluff-seed-technology-8",
  "bluff-seed-sports-11",
  "bluff-seed-food-4",
  "bluff-seed-travel-1",
  "bluff-seed-travel-4",
  "bluff-seed-travel-10",
  "bluff-seed-cinema-4",
  "bluff-seed-cinema-5",
  "bluff-seed-cinema-7",
  "bluff-seed-cinema-10",
  "bluff-seed-oddities-5",
  "bluff-seed-oddities-8",
  "bluff-seed-oddities-11",
  "bluff-seed-language-5",
  "bluff-seed-language-7",
  "bluff-seed-language-12",
]);
