# Quddam — قالوا الناس / Survey Show: 91-round editorial audit
Date: 2026-10-16
Audit base: PR #11 SHA `1fc48efadddac15ab67cddb96bf6cad85bf8db51`
Status: **REVIEW ONLY / NO-GO**. This is an editorial inventory and remediation specification, not approval to import, merge, publish, change the production database, staging, or billing.

## Scope and independently inspected material
- Original `prisma/survey-questions.ts`: **65 authored rounds**, 13 categories × 5; 6 answers each = 390 answers. The initial source provides just **2 aliases** (on the mobile-phone answer).
- Staged `content-review/2026-10-15/Survey_26_Remediated.csv`: **26 additional rounds**, 13 categories × 2; 6 answers each = 156 answers, **26 explicitly recorded aliases**. The CSV remains review-only and is not imported from `prisma/seed.ts`.
- Combined *potential* pool: 91 rounds, 546 answer slots, 28 recorded aliases, **not an approved/runtime 91-round bank**.
- Original authored point totals: **22 × 93**, **22 × 99**, **21 × 105**. Supplemental rounds: **26 × 100**. Original formula: `[29,23,17,11,8,5][position] + i%3` on all six answers. This is an editorial balancing difference, not a proven calculation failure. Do not call these amounts measured survey percentages.
- No exact duplicate round wording after the application's Arabic normalization across these 91. No exact duplicate primary/alias within a staged six-answer round. These tests alone do **not** establish semantic uniqueness or fair spoken judging.
- All 65 source rows are seeded `EASY`; staged CSV has no difficulty field/import mapping. Difficulty balance must be decided and playtested rather than inferred.
- In `survey-display.tsx`, `survey-host.tsx`, `survey-setup.tsx`, the player-facing disclaimer that weights are edited game content, not real poll results, **is present**. Preserve it. The host's text matcher is exact *after limited Arabic normalization*, followed by **manual host judgment**; never imply fuzzy automatic recognition or that all dialects are accepted.
- Five rounds per game and history-aware selection exist in `survey-battle/service.ts`. A static reading does not replace runtime or human repeat-exposure testing.

## P0: question-answer validity and overlap before adding new volume

| Source item(s) | Observed editorial issue | Required action before approval |
|---|---|---|
| `survey-supplement-daily-02` | Asks for a **reason** to double-check the door, but several answers are nouns/objects (القفل، الإنارة، الفرن، المكيف), while نسيت غرضًا is not necessarily checking the door. | Rewrite prompt to “شيء ترجع تتأكد منه قبل ما تبتعد عن البيت؟”; replace or adapt off-scope answers, and check six distinct categories. |
| `survey-supplement-food-02` vs `survey-seed-20` | “شيء تتأكد منه قبل تحضير كيكة؟” repeats recipe pre-checks (ingredients, bake time, heat, pan) already covered by “شيء تفحصه عند تجربة وصفة لأول مرة؟”. | Replace the supplement with a genuinely different food situation, retain stable supplement ID as a review candidate and reconsider answers/points. |
| `survey-supplement-travel-01` vs `survey-seed-21` | Long-journey bag/purchase prompts share several answers (book, headphones, water/snack, charger). The train vs airport setting differs, so this is **possible thematic repetition**, not an automatically proved duplicate. | Compare actual player task/answer overlap, preferably replace with a distinct airport scenario rather than another packing-items question. |
| `survey-supplement-light-02` vs `survey-seed-61` | Both test searching for a common item that is already near/on the player: “وهو قدامك” vs “وهو في جيبك”; overlapping answer set. | Replace with a different light/social situation rather than keeping a near-repeat. |
| `survey-supplement-cars-01` | Asks what to check **in car tyres**, but “الاحتياطي” is a separate tyre; “الغطاء” is vague. “سلامة السطح” overlaps the specific “وجود مسمار”. | Rewrite six independently judgeable tyre properties (e.g., pressure, tread depth, visible cracks, bulges, puncture, manufacture/age) with natural phrasing and reviewed point order. |
| `survey-supplement-tech-01` | “تعليق”, “بطء”, and “تطبيق لا يستجيب” can lead to disputable overlapping judgments. | Define separate answers or combine overlapping concepts; host rubric must say when a spoken guess counts and which slot wins. |
| `survey-supplement-family-01` | “ألعاب” and “مسابقة” are not fully independent; a contest can be a game. | Distinguish activity types with a per-round host rubric, or replace one category. |
| `survey-supplement-travel-02` | “سهولة القيام”, “مساحة حركة”, “الوصول لدورة المياه” are related reasons, potentially leading to multiple slots for one utterance. | Disambiguate each answer and adjudication; consider replacing a nested reason. |
| `survey-supplement-games-02` vs `survey-seed-36`, `survey-seed-44` | Team/time/rules preparations resemble existing before-game coordination prompts. | Semantic/playtest check; prefer a different game-show moment or revise if players repeat the same guesses. |

Other staged prompts requiring clear wording/slot judgment: `survey-supplement-saudi-02` (“أنواع تمر” vague vs “تمور” alias), `survey-supplement-work-01` (“الترحيب” is an action vs requested thing you **say**; acceptable only with clear host examples), `survey-supplement-light-01` (sudden momentary outage vs actions that require a longer outage). The remaining staged rows are **not signed off**, merely not individually flagged by this preliminary textual pass.

## P0: fair spoken answer acceptance
- Each of the 546 slots must have a non-overlapping canonical concept; an alias must mean precisely that concept, not a broader neighboring answer.
- Review local Saudi speech and singular/plural or common wording where safe, e.g., ماء/موية; شاحن/شاحن جوال only where the target concept fits. Do not bulk-insert aliases without checking cross-slot collisions after Arabic normalization.
- Record for each question: likely guesses, acceptable variants, misleading close guesses, which slot receives an ambiguous guess, and the host decision in plain Arabic.
- The host may manually choose a slot independent of typed exact match. Test this path; static alias counts cannot establish end-user fairness.
- Preserve stable IDs and keep originals/CSV candidates separate until approved import mapping and isolated double seed.

## P1: score balancing, suitability and repeat play
- Decide and document whether every six-answer authored round targets **100 total game points**. Either harmonize *all* accepted rounds via reviewed values or explicitly justify nonuniform totals; don't change historical scores silently.
- Six descending points are currently structurally accepted. Rank and point-value ordering require actual player tests, not subjective assertions of what “most people” answered.
- Keep the on-screen curated/not-real-poll notice in host, display and setup; avoid statistical wording (“% of respondents”, “survey of 100”, etc.).
- Add six answer/alias acceptance tests for each accepted round plus answer/point ordering, duplicate concepts, five-round setup, repeat play, host manual correct/wrong decisions, steal, score multiplication and exposed/hidden-answer states.
- Cross-game topical sameness against Board/Lightning/Letter/other formats needs judgment, not a naive literal-equality ban: this game asks open-ended guesses, while those games ask factual questions.

## Review-only staged-row ledger
All rows currently `REVIEW_REQUIRED` (no human gameplay approval). “Text pass” denotes a preliminary read, **not approval**.

| Staged item ID | Editorial next step |
|---|---|
| survey-supplement-daily-01 | Text pass; test office item guesses and colloquial variants |
| survey-supplement-daily-02 | **REWRITE** reason/object prompt mismatch |
| survey-supplement-saudi-01 | Text pass; verify six practical summer-desert items |
| survey-supplement-saudi-02 | Clarify generic dates response/aliases |
| survey-supplement-family-01 | **REVIEW** games/contest overlap |
| survey-supplement-family-02 | Text pass; test spoken variants |
| survey-supplement-food-01 | Text pass; clarify seasoning vs flavor variants |
| survey-supplement-food-02 | **REPLACE** near-repeat of seed-20 |
| survey-supplement-travel-01 | **REVIEW/REPLACE** near-repeat of seed-21 |
| survey-supplement-travel-02 | **REVIEW** overlapping aisle-seat reasons |
| survey-supplement-school-01 | Text pass; replace unclear “جهاز” if ambiguous in play |
| survey-supplement-school-02 | Text pass; test study-tool variants |
| survey-supplement-tech-01 | **REVIEW** overlapping restart reasons |
| survey-supplement-tech-02 | Text pass; examine sound/quality wording |
| survey-supplement-games-01 | Text pass; test distinct reactions |
| survey-supplement-games-02 | **REVIEW** thematic overlap with seed-36/44 |
| survey-supplement-sport-01 | Text pass; test singular/plural swim accessories |
| survey-supplement-sport-02 | Text pass; test rest/stretch synonyms without cross-slot collision |
| survey-supplement-cars-01 | **REWRITE** wrong-domain/vague/overlapping answers |
| survey-supplement-cars-02 | Text pass; distinguish emergency kit from everyday carry |
| survey-supplement-work-01 | Clarify the “what you say” framing |
| survey-supplement-work-02 | Text pass; test leave/handover wording |
| survey-supplement-occasions-01 | Text pass; test ceremony-related guessing |
| survey-supplement-occasions-02 | Text pass; differentiate location-link vs written directions |
| survey-supplement-light-01 | Clarify duration/setting of the outage |
| survey-supplement-light-02 | **REPLACE** seed-61 near-repeat |

## Next scoped implementation gate — Codex, without publication
1. On a new branch based on this audit and the latest PR #11 content head, prepare revised **review-only** Survey 26 CSV (do not silently change any original IDs or seed/database).
2. Add an explicit editorial row ledger for *all 91* with question, six primary answers, aliases, score, cross-round semantic observations, issue status, reviewer/date, replacement rationale, and playtest status. Separate automated structure from human approval.
3. Unit-test 91 combined candidate structures, exact within-row alias collisions, score policy, and regression cases for the flagged rows. Do not represent a semantic heuristic as definitive adjudication.
4. Preserve the curated-content disclaimer. Verify one real isolated five-round browser flow, spoken variant/human host confirmation path, score/steal/rematch; record exact SHA and skipped/flaky results.
5. Return specific before/after examples and a `PASS/NO-GO` with open editorial issues. **Do not import CSVs, alter production/main, deploy, charge, or merge.** The owner will review this game's bank before proceeding to the next of the seven.
