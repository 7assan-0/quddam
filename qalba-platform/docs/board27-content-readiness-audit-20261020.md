# Board27 — independent-content readiness audit (20 October 2026)

**Verdict: CONTENT_NO_GO / DRAFT**. This report deliberately does NOT certify facts, answers or calibrated tiers on the strength of CI. It concerns the 16 staged 96-row packs (1,536 draft Q/A) and spot checks against the existing 576 baseline questions; it does NOT claim all 2,112 items have been independently read or fact checked. Five visual-category packs still require 480 authored/rights-cleared questions or assets.

## What was measured

- Structure: the 16 staged packs each contained 32 items per tier (200 / 400 / 600) = 1,536 questions.
- Normalized **identical question** detection: zero exact normalized duplicate prompts within those 1,536 at the audited snapshot, but this is NOT a semantic nonduplication certificate and does not certify baseline 576.
- Repeated ANSWERS do occur (legitimately sometimes): movies (director credits), cars (manufacturers), places (countries/cities), Arabic (grammar symbols), riddles (numbers). An identical answer to *different questions* is not automatically a duplicate, but repetition of question mechanics can weaken category variety.
- Neither fact links in the CSV nor passing Vitest/lint/build/PG17 constitutes independent line-by-line human fact review. Tier labels are author hypotheses; no blind player difficulty pilot or alternate-answer signoff has occurred.
- All draft review records must remain PENDING / NOT_RUN until genuinely adjudicated by a reviewer.

## Proven correction log (source + corresponding review CSV updated)

| ID | Problem in old draft | Correction/grounds | Remaining status |
|---|---|---|---|
| culture-400-001 | Asked generically for the year Arabic coffee entered UNESCO; could be 2015 original or 2024 extended inscription | Revised question explicitly asks 2024 Jordan extension and explains the 2015 original. UNESCO decision: https://ich.unesco.org/en/Decisions/19.COM/7.b.55 and original https://ich.unesco.org/en/Decisions/10.COM/10.b.32 | Still needs independent approval and player-grade pilot |
| animals-600-003 | Asked for a kind of SKELETON but supplied a TAXONOMIC answer | Revised to ask for arthropod group, answer كلابيات القرون. https://www.fisheries.noaa.gov/feature-story/horseshoe-crabs-managing-resource-birds-bait-and-blood ; https://ocean.si.edu/ocean-life/invertebrates/creature-feature-amazing-horseshoe-crab | Pending |
| animals-600-008 | Called the animal's expelled internal organs a liquid | Revised to ask what some sea cucumbers expel to distract predators; answer بعض أعضائه الداخلية. https://ocean.si.edu/ocean-life/invertebrates/sea-stars-urchins-and-relatives | Pending |
| animals-600-012 | Repeated 'tusk' as its own dental origin instead of answering the anatomical question | Revised to upper LEFT CANINE in the male narwhal. https://www.si.edu/stories/understanding-narwhals-smile ; https://www.fisheries.noaa.gov/species/narwhal | Pending |
| geography-400-009/010/013/015 | Four near-duplicate geographical facts were restatements of Places candidate questions | Replaced with Etna, Sunda Strait, Alaska highest summit, and Atlas mountains; source and 96-row Geography ledger synchronized, source anchors in corresponding CSV | Pending independent fact/grade review |

Guard tests prevent accidentally reverting these known corrections and the 672-row knowledge ledger remains synchronized with the authored sources. Do not mark the whole bank approved on this basis.

## Further review queue — not yet fact-approved and NOT fixed by exact string matching

| Priority | Question ID(s) | Finding | Editorial action required |
|---|---|---|---|
| FIXED IN DRAFT | geography-400-009 / places-200-017 | Previously both asked for Mount Fuji's country | Geography item replaced with Sicily's Etna; source and Geography CSV synchronized; still pending independent item approval |
| FIXED IN DRAFT | geography-400-010 / places-400-011 | Previously both asked Atacama's country | Geography item replaced with Sunda Strait between Java and Sumatra; pending independent item approval |
| FIXED IN DRAFT | geography-400-013 / places-400-007 | Previously both asked Kilimanjaro's country | Geography item replaced with the US state of North America's highest mountain (Alaska); pending independent item approval |
| FIXED IN DRAFT | geography-400-015 / places-200-004 | Previously both asked Machu Picchu's country | Geography item replaced with Atlas mountains across Morocco, Algeria, Tunisia; pending independent item approval |
| P1 | movie/cars/series/game packs | Film400 repeats directors, Car400 repeats manufacturers; TV600 and Games600 are dominated by year-of-first-release recall. The exact Qs differ, but the mechanics are repetitive | Curate varied subtypes, not only distinct strings |
| P1 | riddles-400-013 / riddles-400-015 | Two geometric-progression next-number tasks with the same doubling rule; medium tier also has many adjacent "next number" mechanics | Replace or diversify then pilot |
| P1 | movies-600-001 | Naming Snow White and the Seven Dwarfs from 1937 and "princess/seven dwarfs" is likely too easy for 600 | Blind pilot / move or replace preserving 32-per-tier |
| P1 | culture-600-002 / culture-600-003 | Distinguishing tangible from intangible heritage may be introductory despite a 600 tier label | Blind pilot / regrade or replace |
| P1 | sports-400-002 | A one-point basketball free throw is common basic knowledge despite 400 tier | Blind pilot / move or replace |
| P1 | animals-600-002 | The prompt contains 'تكيف' and its answer 'التكيف التطوري', possibly circular and arguably interpretable as natural selection | Specialist rewrite/reject before play, with new source and ledger sync |
| P1 | all packs | Alternative Arabic spellings, foreign names, transliteration, exact numeric formatting and context-varying facts remain unapproved | Independent APPROVE/REVISE/REJECT for every item |
| P1 | all 200/400/600 labels | No blind pilot of human players / time-to-solve | Empirically calibrate difficulty, preserve 32 items/level only after editorial reallocation |
| P1 | visual five | Logos, picture rebus, flags, proverbs, maps are not authored into approved 96-item category banks | Create original/licensed imagery, prove one intended answer, rights check, RTL arrangement, visual QA |

**Editorial principle:** do not mark an item approved merely because a domain URL was included. Verify an exact record, the specific claim and validity date. A repeated answer can be acceptable; a semantically repeated underlying question within selectable categories is undesirable. Source-only changes are non-playable and must not be merged/deployed before a release gate and explicit owner approval.

## Acceptance sequence

1. Four identified Geography/Places semantic overlaps have been replaced in the DRAFT and synchronized to the Geography CSV; continue identifying/rectifying remaining P1 overlaps and any wrong/ambiguous pairs, with source-code-to-CSV synchronization.
2. Independently read **all 2,112 authored** rows (including seeded baseline 576, which is also not yet human approved), inspect answer variants against item-specific primary sources, mark every row with documented evidence + reviewer/date.
3. Run blind in-person or controlled-play pilot covering all 27 available category candidates as they are authored; measure solve rate and time-to-solve per candidate grade and use actual results to adjust the 200/400/600 assignment.
4. Only after authoring and source/license-reviewing the missing 480 visual items, achieve 27×96=2,592 **individually approved** items; check 36-cell gameplay (6 categories × 6), empty synthetic PG17, permissions and UI/RTL/mobile/accessibility plus full security gates before proposing activation.

No global Category seed modifications, PR merges, Vercel deployment, production DB writes, payments or player-data actions were authorized or performed during this audit.
