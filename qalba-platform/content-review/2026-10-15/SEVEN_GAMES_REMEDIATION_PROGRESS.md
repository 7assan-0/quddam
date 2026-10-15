# Seven remaining games — remediation execution (2026-10-15)

**Review branch only / NO-GO:** `fix/content-remediation-63-20261015` in PR #11. Content changes here are not authorization to publish, merge, deploy or import staged CSVs. The source-code changes to original Court/Bluff/Social seed also remain unmerged. Exact latest CI SHA must be verified separately.

## Applied changes

1. **Bluff / صدّقني:** Original `bluff-seed-oddities-9` had the false accepted alternative `حريش البحر` for narwhal. Removed it and retained the distinct valid transliteration `ناروال`. The scoped `prisma/seed.ts` upsert now updates that one original row's alias field on an explicit content-only seed without forcing changes to status or other original questions. The staged Spyro prompt was clarified: Spyro is the playable protagonist, not a helper. **Not a full factual review of the 156+13 items.** Manual fact/source checking and actual session fake/vote edge cases remain blocked.
2. **Court / المحكمة:** Rewrote the context and ending of **all 180 original fictional scenarios** to remove the identical universal concluding question, using case titles and category-specific stakes and 12 decision lenses. Preserved the original scenarios' core actions, existing prosecution, defense, rebuttal, evidence facts, categories and status behavior. Added guard tests for unique case texts, no legacy ending, and case-title specificity. **These are programmatically assisted editorial drafts; all 180 require independent editorial/playtest approval.**
3. **Out-of-the-loop / خارج الجو:** Appended ten proposed words per existing category, expanding original seed inventory **55 → 165** (11 categories × 15). Preserved the first five category words and positional seed IDs; new 110 strings have no cross-category exact normalized collisions. The service already excludes 20 recent host rounds if there are eligible unseen words. An isolated double-seed CI check now requires 165 `social-seed-%` rows. Difficulty/guessability and semantic pair overlap still require playtesting. These additions are source changes only until seed approval.
4. **Survey / قالوا الناس:** Added one reviewed non-colliding phrasing alias per staged round (**26 additions to 26 candidate rounds**). All point weights remain **curated game-design scores**, not real poll results. No live changes or claim of respondent percentages.
5. **Ranked / توب 100:** Added one candidate accepted phrasing alias per staged list (**15 additions to 15 candidate lists**) with in-list normalized collision checks. Lists retain ten entries and authored ranks; the ranks are not factual popularity or market statistics. Challenge difficulty must be calibrated in live play, not arbitrarily raised.
6. **Forbidden / الكلمة الممنوعة:** Preserved staged 52 (26 EASY + 26 MEDIUM), and created a distinct `Forbidden_13_Hard_Candidates_Review_Pending.csv`, one candidate per category, four unique forbidden clues each. **HARD is provisional until actual clue-based team playtesting**; these 13 are not imported.
7. **Ordering / رتّبها:** Retained the earlier correction to staged geography #01: final item `بدء الرحلة` follows the instruction `ابدأ رحلتك`. Original code diversifies 48 templates and archives ten known duplicate IDs; full source/reference checks and semantic variation of all remaining content are pending.

## Evidence and tests

- `tests/content-remediation.test.ts`: original Court 180 count and scenario diversity, existing runtime validators; original Ordering guard.
- `tests/remaining-games-review-staged.test.ts`: supplemental CSV structural checks, actual Survey/Forbidden/Bluff/Ranked validators, staged 13 hard candidates, source-level Social 165, and a guard for the original bad Bluff alias.
- `.github/workflows/content-remediation.yml`: isolated PostgreSQL 17 double content seed, including **165 Social rows and corrected original Bluff alias**; unrelated manual status changes must not be reset.
- Existing `tests/content-review-cross-bank.test.ts`: normalized question guard on staged Board, Lightning, Letter V4, staged Bluff and original Bluff. **Semantic duplicates require separate editorial review, not just normalized text.**
- All earlier green CI runs refer to their corresponding old SHAs; newer changes need green CI on their latest head. No claims of real-browser multiplayer or production DB acceptance.

## Release blockers (all remain)

- Independent question-by-question references and answer/alias accuracy, including full original Bluff review and previously flagged 227 Board facts.
- Semantic duplication within/across all ten games (including structurally different formats).
- Case-by-case Court acceptance and real jury trials, player group playtests for social/forbidden, survey/ranked fairness.
- Explicit approved import/migration mapping for staged CSVs; isolated seed with safe status behavior; full build, tests, and real game-browser session evidence; separate owner approval to merge or deploy.

**Do not merge; do not deploy; do not import staged content; do not alter production, Staging, billing or `main` as a consequence of this review.**
