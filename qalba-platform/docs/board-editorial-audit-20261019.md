# Board36 editorial quality audit — 19 October 2026

**Verdict: NOT APPROVED / DO NOT PUBLISH.** This is an audit of the currently authored candidate pool, not a claim of complete independent factual review. At review time the pool is 576 baseline source questions + 16 isolated draft packs × 96 = **2,112 authored items**, with another **480 not authored** across five visual category packs. All candidate packs remain excluded from live `sourceBanks`/Prisma seed; the 576 baseline items also retain pending independent factual sign-off.

## Structural observations (automated, not real-world content approval)

- Sixteen newly authored draft packs each contain exactly 32 items at 200/400/600 = 1,536 items. Their **question prompts are distinct after NFKC/Arabic normalization**, and recent baseline/new-pool cross-bank duplicate-prompt gates were added, but normalized string distinctness is **not** semantic novelty.
- All seven knowledge and seven entertainment ledger records match their candidate sources at last synchronized file updates; human `PENDING_INDEPENDENT_FACTCHECK` / `PENDING_INDEPENDENT_ITEM_REVIEW`, blank reviewer/date, and `NOT_RUN` difficulty and spoken pilots must be preserved.
- This does **not** mean correct answers, approved alternate answers, genuine difficulty, source-by-source checking, or clean gameplay variety.

## Confirmed factual ambiguity corrected (first primary-source spot check)

- `culture-400-001`: previous wording asked **“في أي سنة أدرجت اليونسكو القهوة العربية ضمن التراث الثقافي غير المادي؟”** and expected **2024**, but UNESCO confirms original inscription in **2015**, whereas **2024** was an **extension to Jordan**. Changed prompt to explicitly ask for the Jordan extension in 2024. Primary evidence: https://ich.unesco.org/en/Decisions/19.COM/7.b.55 ; 2015 original at https://ich.unesco.org/en/10b-representative-list-00779?select_country=00180. Its CSV entry is still **PENDING** independent review. Added a dedicated guard in `board-knowledge-7x96.test.ts`.

## Confirmed answer/topic reuse: not exact duplicates, but below release-quality variety

- `movies-400`: **32** director questions, **18 distinct answers**. Spielberg and Nolan each occur three times. These are different correct factual questions, but repeated formats and answers can make a group match predictable.
- `cars-400`: **32** car-brand questions, only **16 distinct answers**. Toyota occurs three times and many brands twice. Needs replacement with more diverse automotive knowledge and evidence-backed difficulty, not necessarily banning any repeated answer globally.
- `riddles-400`: **10 of 32** questions use the same “ما العدد التالي في المتتالية…” template. Needs a broader mix of text/logic/lateral riddles, not merely numbers.
- `games-600`: **all 32** questions ask for a year of release. That tests date memorization rather than a uniformly harder and more entertaining game knowledge level.
- Years/date questions in `series-600` are also overrepresented and require variation.
- Same numeric answer in unrelated mathematics questions alone is **not** duplicate content; false positives should not be mechanically deleted.

## Difficulty concerns (must be empirically tested)

- `who-am-i-600-032` gives “مادة وراثية” and “بنية حلزون مزدوج” as clues; **DNA** could be easier than `who-am-i-200-008` asking players to identify **Charles Babbage**. Numeric difficulty labels have **not** been validated through blind player testing.
- `movies-600-001` asks about Disney's 1937 “princess and seven dwarfs” movie (**Snow White**), whereas `movies-200-015` asks about the visual-memory film **Memento**. Likely challenge-level mismatch depending on audience. Mark for blind comparison, not an unsupported automatic regrade.
- Current sports, Arabic grammar, history, culture and currency hard-level claims also require audience-specific checks; source complexity or number of words cannot alone certify 200/400/600.

## Required acceptance gates and decision

1. Independent `APPROVE/REVISE/REJECT` for **every one** of 2,112 authored items; verify exact question, canonical answer, real accepted variants, ambiguity and primary source (with stable date).
2. Category editors should redesign the **movies-400**, **cars-400**, **riddles-400**, **games-600**, and date-heavy TV rounds, then update per-item ledgers and rerun normalized, semantic and answer-concept reviews.
3. Conduct blind mixed-audience rounds: record solve rate and time for each item, and only then assign 200/400/600 (32 approved in each tier of each category). Check both within-category and across-category difficulty; reject ambiguous items.
4. For unmade visual packs (logos, guess-picture, flags, proverbs, maps), author original/licensed images and test legibility plus answer uniqueness. Never pretend a plain text bank is an image-question pack.
5. Run exact-head automated tests and synthetic PostgreSQL17 QA after each edit, plus browser, RTL, security/release checks; **CI success is necessary but not independent factual/human approval**.
6. Keep PR #48 Draft, **NO-GO** for merge, seed, deploy, or player activation until all of the above are evidenced and the owner explicitly signs off.

**Do not market “2,112 perfect questions.” At best: 2,112 authored candidates, 0 complete independent item-by-item signoffs confirmed by this audit.**
