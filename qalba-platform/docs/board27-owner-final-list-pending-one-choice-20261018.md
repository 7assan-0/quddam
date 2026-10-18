# Proposed Board36 categories — owner request, 18 October 2026

**Review-only / no activation / no production migration.** The owner asked to remove five categories and add: خمن الصورة، أعلام دول، أمثال، ألغاز، خرائط. The legacy 27 already includes ألغاز (`riddles`). That is **four** distinct *new* categories, so the requested resulting list has **26 unique categories**, NOT 27. The last slot is explicitly **AWAITING OWNER CHOICE**; no invented 27th category or duplicate “ألغاز”. See `prisma/board-expansion/owner-catalog-proposal.ts` and unit tests.

## Proposed 26 distinct choices (22 retained + 4 distinct additions)

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
| 27 | **UNRESOLVED** | **بانتظار تحديد فئة خامسة مختلفة من المالك** | intentionally not seeded or faked |

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

## 96-item bank and release constraints

Each category must have **96 approved items, 32 for each 200/400/600 level**, in an auditable review ledger (fact checks, valid alternatives, reviewer, date, copyright/provenance, difficulty pilot). Six categories chosen per match and 36 cells remain unchanged. **The source's prior six × 96 and draft Geography96 are NOT independent human-approved**. Neither this proposal nor candidate Geography is imported into the live selector, Prisma seed, payment, sessions or site. After the owner chooses the 27th category: define its unique slug, update Board-only registry and tests, author approved content for all new packs, run PG17 + Chrome and independent editorial/security gates, then request explicit merge/deployment approval. No automatic “zero mistakes” claim.
