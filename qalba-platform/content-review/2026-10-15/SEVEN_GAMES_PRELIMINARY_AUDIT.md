# Quddam — preliminary audit of the seven remaining launch games (2026-10-15)

**Status: REVIEW ONLY / NO-GO.** Source: branch `fix/content-remediation-63-20261015`; canonical launch slugs checked against `src/lib/games/launch-policy.ts`, source seeds and review-only CSVs. Counts are code/CSV inventory, **not live DB statistics** and not editorial publication approval. Revised CSVs are not imported by `prisma/seed.ts`.

| Launch game | Original source items | Additional review-only candidates | Main content acceptance concern |
|---|---:|---:|---|
| قالوا الناس / `survey-show` | 65 authored rounds | 26 | All scores are **curated game weights**, NOT respondent percentages or a real poll. Ensure this is transparent in player-facing UI; test six answers/aliases per round and whether matches feel fair |
| الكلمة الممنوعة / `secret-word` | 208 cards (13 categories × 16) | 52 | Verify difficulty in actual spoken play; review forbidden inflections, near-synonyms, target leakage and repetitive clues. Original card distribution derived from seed rule: 117 EASY, 65 MEDIUM, 26 HARD; supplement 26 EASY, 26 MEDIUM, 0 HARD |
| صدّقني / `bluff` | 156 original fact questions (13 × 12) | 13 | Independently fact-check primary/alternate answers, ambiguities and original items; supplemental URLs alone are not proof. Confirm invented bluff answers do not expose or accidentally match true aliases |
| توب 100 / `top-list` | 82 authored lists (10 entries each) | 15 | Ranks are **editorial game orders**, NOT worldwide/popularity/statistical rankings. Clearly disclose this to players. The 15 supplements are all EASY, and objective ranking is not proven by an ordered list |
| رتّبها / `ordering-challenge` | 180 originals, of which 10 known repeated IDs intentionally ARCHIVED (170 expected publishable after isolated seed) | 15 | Avoid formulaic permutations and subjective timelines masquerading as universal truths. The review CSV geography #01 had an instruction/final-item mismatch ("ابدأ رحلتك" vs "الوصول للموقع"); the item was corrected to "بدء الرحلة" in the review-only CSV |
| المحكمة / `the-court` | 180 original fictional cases | 15 | All **180 original scenarios have the same concluding question** ("هل يحتاج اتفاقًا أوضح مع المجموعة، أم أن الموقف له عذر مقبول؟"). Despite previous prosecution/rebuttal diversification, this recurring frame is a major editorial monotony concern. Rewrite substantive scenario stakes and endings, preserve balanced prosecution/defense, no fixed right answer |
| خارج الجو / `out-of-the-loop` | 55 words, 11 categories × 5 each | No additional review bank | Small per-category pool risks familiar/repeated play over multiple nights. Check word clarity/guessability, category balance, session-history handling and repeated round selection before deciding expansion volume |

## Checks completed for six staged CSVs

- All six parse with complete column counts: Survey 26, Forbidden 52, Bluff 13, Ranked 15, Ordering 15, Court 15.
- Survey: all 26 have six JSON answers summing to 100 **authored game points**; no claim of actual population sample. Forbidden: 52 cards each include four distinct forbidden terms, with no term identical to the target by normalized equality; the 52 new targets do not exactly repeat original 208 target names.
- Bluff: the 13 staged items contain source URLs and JSON alternatives, but source content/references **have not** been independently audited in this pass. Ranked: 15 staged lists each have ten uniquely labeled answers and contiguous rank positions; their difficulty is all EASY.
- Ordering: 15 staged items have structurally contiguous positions; two flagged as factual have a source URL. One directly observed instruction/last-item mismatch corrected as described above. Court: 15 JSON facts arrays parse; all are hypothetical scenarios requiring editorial playtest.
- Original Out-of-the-loop seed: exactly 55 word strings; no exact duplicate after Arabic normalization. Repeat-exposure and semantic suitability are **unverified**.
- Original seeded Survey 65 prompts, Forbidden 208 targets, Bluff 156 prompts and Ranked 82 titles have no exact duplicates within their respective source sets in the preliminary normalized text scan. That does **not** prove semantic uniqueness.

## Cross-game duplicates beyond the earlier three-bank check

- Original Bluff `bluff-seed-cinema-11` exactly repeated staged Lightning `lightning-v600-screen-03`: "ما اسم الشخص الذي يؤدي دور شخصية أمام الكاميرا؟". In the **review-only** Lightning CSV, the latter was replaced with a distinct clapperboard question; factual/alias review and playtest of that replacement remain pending.
- Expanded regression coverage now checks normalized questions in staged Board 1296, Lightning 600, Letter V4 224, staged Bluff 13 and original Bluff 156 (2,289 total). Similar facts with different wording remain subject to separate semantic triage, and heterogeneous formats (surveys, forbidden cards, rankings, ordering, court, social) need their own meaning-aware evaluation.
- This review is not evidence of actual deployment, complete game-loop acceptance, real user session quality, production DB content, or independent fact checking.

## Recommended priority / release blockers

**P0 — before content approval:** independently verify all factual questions and true aliases in original and staged Bluff; review any source-sensitive factual Ordering; complete prior 227 Board reference-sensitive checks; review substantive duplicate facts across question-answer games; prove no misrepresentation of curated Survey/Ranked data. Make importing reviewed banks an explicit migration/map, not a side effect of merging this PR.

**P1 — game experience quality:** diversify Court scenario setup and endings beyond a repeated universal question; validate Forbidden restricted clue matching in real speech and rebalance hard cards based on playtests; add varied Out-of-the-loop words after testing category clarity and anti-repeat; review Ranked/Survey answer fairness, alternate phrasings and difficulty in repeated sessions; reduce mechanical Ordering templates.

**Release remains NO-GO.** An independent human/editorial review and actual game/browser tests are still required; no main merge, Staging, production, database import, billing, or deployment action is authorized.
