# Owner-approved Board36 category names — 18 October 2026

**Category names approved; implementation remains review-only / no activation / no production migration.** Owner requested five removals, requested خمن الصورة، أعلام دول، أمثال، ألغاز، خرائط, and explicitly chose **عملات** for the remaining slot after discovering ألغاز (`riddles`) was already present. Exactly 22 retained + 5 unique new choices = **27**. ألغاز appears only once. See `prisma/board-expansion/owner-catalog-proposal.ts` and dedicated unit tests.

## Approved proposed list: 27 distinct choices (22 retained + 5 new)

| No. | Slug for Board-only proposal | Arabic display name | Source |
|---:|---|---|---|
| 1 | general | معلومات عامة | retained |
| 2 | saudi | السعودية | retained |
| 3 | football | كرة القدم | retained |
| 4 | sports | رياضة | retained |
| 5 | history | تاريخ | retained |
| 6 | geography | جغرافيا | retained, separate pending Geography96 |
| 7 | science | علوم | retained |
| 8 | technology | تقنية | retained |
| 9 | cybersecurity | أمن سيبراني | retained |
| 10 | movies | أفلام | retained |
| 11 | series | مسلسلات | retained |
| 12 | games | ألعاب | retained |
| 13 | cars | سيارات | retained |
| 14 | logos | شعارات | retained, planned Saudi and global mix |
| 15 | people | مشاهير | retained, direct factual questions |
| 16 | arabic | لغة عربية | retained |
| 17 | riddles | ألغاز | retained **ONCE**, not a new slot; textual/logical puzzles |
| 18 | who-am-i | من أنا؟ | retained, identity deduced from clues |
| 19 | culture | ثقافة | retained |
| 20 | food | طعام | retained |
| 21 | places | أماكن | retained |
| 22 | animals | حيوانات | retained |
| 23 | guess-picture | خمن الصورة | proposed new, visual *rebus* |
| 24 | country-flags | أعلام دول | proposed new, visual identification |
| 25 | proverbs | أمثال | proposed new, complete/interpret/apply well-known proverb |
| 26 | maps | خرائط | proposed new, geographical visual recognition |
| 27 | currencies | عملات | explicitly selected by owner; draft-only pending 96 curated questions |

## Retired FROM BOARD36 only (five)

`anime` الأنمي; `jobs` الوظائف; `objects` الأشياء; `images` الصور; `travel` السفر. They must not be globally renamed/deleted without independently checking references from **other game types and existing persisted Category IDs**. Existing production/global seed and Board576 source have NOT been modified by this specification. Use a scoped eligibility/configuration migration only after review.

## “خمن الصورة” contract — use the uploaded examples for game mechanics, not as redistributed assets

Original visual rebus composed of **two, three, four, or more legible pictures**, optionally mixed with a **letter, symbol, or short word**. Solve a single word/name/expression from sound and meaning, for example the owner's **صوم + مال = صومال**. Do not misconstrue this as “name the depicted object.” For 200/400/600 difficulty, calibrate through tested solution ambiguity and players' real performance, **not an arbitrary fixed number of pictures**. Art must be original or appropriately licensed; do not copy frames/assets from a creator's videos.

## Other new-category boundaries

- أعلام دول: approved, correctly labelled country flags; beware lookalike flags and historical/version changes
- أمثال: documented Arabic and Gulf proverb wording, accepted colloquial variants, no ambiguity in missing phrase
- ألغاز: pre-existing text/logic riddles, separate from visual rebus; one intended tested solution
- خرائط: geographically accurate licensed/original maps, clear borders, appropriately dated data; distinct from free-form geography trivia
- شعارات: maintain a reviewed mix of Saudi and international marks, correct brand identity and media rights

## Currency category scope

The new **عملات** category should cover original or licensed images of banknotes/coins (with proper legal and provenance checks), country-to-currency and currency-to-country, currency names and symbols with unambiguous country context, and a Saudi-riyal component. Avoid inherently unstable **live FX rates**; verify that each issuer/currency is current for the question's stated historical date. Include accepted Arabic and international names as alternatives where needed. A **96-question Currencies DRAFT** has now been authored (32 per 200/400/600) and logged for item-by-item review at `prisma/board-expansion/currencies-candidate.ts` and `content-review/2026-10-18/Board_Currencies_96_Review.csv`. It has **not** been independently fact-reviewed, calibrated, seeded, or published; image-backed items and art rights have **not** been completed. The next seven category drafts add 672 text Q/A candidates; see docs/board-knowledge-7x96-quality-gate-20261018.md and content-review/2026-10-18/Board_Knowledge_7x96_Review.csv. Across the branches the authored candidate pool is now 1,440 (576 baseline + 96 Geography + 96 Currencies + 672 across seven new packs); all added packs remain isolated and pending independent review.

## 96-item bank and release constraints

Each category must have **96 approved items, 32 for each 200/400/600 level**, in an auditable review ledger (fact checks, valid alternatives, reviewer, date, copyright/provenance, difficulty pilot). Six categories chosen per match and 36 cells remain unchanged. **The source's prior six × 96 and draft Geography96 are NOT independent human-approved**. Neither this proposal nor candidate Geography is imported into the live selector, Prisma seed, payment, sessions or site. The owner-selected 27th slug is `currencies`; author approved content for all new packs, run PG17 + Chrome and independent editorial/security gates, then request explicit merge/deployment approval. No automatic “zero mistakes” claim.
