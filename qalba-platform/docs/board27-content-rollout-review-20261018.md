# Board27 expansion — review-first staged plan (18 Oct 2026)

**Status: DRAFT / NO-GO for merge, real seeding, public launch.** This work is stacked on exact fact-reviewed (but NOT human-approved) Board576 PR #43, SHA `41374d8c0fd7eca7d28f62b2c0733e2dc60f2615`.

## Counts without conflating catalog, bank and match

- The seeded **catalog** contains exactly **27 distinct category names and slugs**.
- The existing PR #43 **authored Board pool** contains **6 × 96 = 576** questions (32 each at 200/400/600). This is a source/CI statement, **not a claim of current production DB state or human approval**.
- One **new staged unpublished Geography candidate** contains **96 more authored questions**, split 32/32/32. Current proposed authored total is **672**, of which **only the original 576 are included in the seed and sourceBanks**. Geography is deliberately **not** included in either; do not call it playable.
- The remaining **20 registered category packs** each require 96 additional questions (32 per tier), **1,920** yet to author. Total end-state goal **27 × 96 = 2,592**; complete published balance is still subject to review, user approval, import, and database verification.
- A match always has **6 chosen categories × 6 cells = 36 questions** and remains entirely unchanged.

## Expansion order

Complete candidate packs and line-by-line editorial review in coherent batches; do not publish an empty category as a fake new choice. Registry order: sports, history, geography (candidate drafted here), movies, series, anime, games, cars, logos, people, arabic, riddles, who-am-i, images, culture, food, travel, places, animals, jobs and objects.

Future contributors must keep category slug stable; 32 prompts per grade and 96 per category; original questions (not copied); precise question-answer equivalence; accepted Arabic/English/transliteration/number answers; non-duplicated concepts, not just non-duplicated strings; image licensing where relevant; fact sources and stable dates for dynamic subjects; and real difficulty calibration. Do **not** auto-publish anything merely because source counts pass.

## Quality gates

1. **Automated source QA:** exact 27-category registry alignment with existing seed; 96/32/32/32 quota; stable 576 starter IDs, full source audits, 672 staged exact prompt duplicates, self-revealing answers, same-answer/high-overlap clues, synchronized per-item review ledger.
2. **Content editorial:** a human independent fact reviewer must check each of the 576 old and each new question with authoritative evidence, accepted alternate answers, and an APPROVE/REVISE/REJECT decision. **The existing Board576 ledger still has 576 PENDING entries; 23 assistant corrections and 30 difficulty flags are NOT a substitute for approval.** New Geography96 ledger contains 96 PENDING entries; no signed reviewer, date, URL or playtest result has been invented.
3. **Difficulty:** review especially Geography drafts 33–40 (capital-city recall potentially easier than 400), and 88–91 (Maldives/Andorra/Lesotho/Gulf of Aden potentially easier than 600), as well as concept definitions at 600. Move items between grades or replace them **without breaking 32/32/32** after evidence-based blind playtesting.
4. **CI:** exact PR-head full Vitest, lint, TS, build, source binding, native **empty synthetic PostgreSQL 17** migration + seed/re-seed idempotency, asserting only original 576 are seeded. No production DB connections.
5. **Explicit approval and activation:** only after item-level signoff, accepted alternate answers, visual owner approval for the photographed category cards, and a further **separate** candidate PR importing reviewed categories with fresh exact-head PG17+browser+privacy/payment checks. No direct PR#43 or this draft to main; no disabling full security audit, including pre-existing `braces` issue.

## Why geography is quarantined

This source is an **editorial draft**. Automatically passing counts and textual duplication checks is not proof of actual geography fact correctness. No recorded item has independent sources verified yet. Its 96 rows are provided in `prisma/board-expansion/geography-candidate.ts`, and its draft ledger in `content-review/2026-10-18/Board_Geography_96_Review.csv`. Both must remain review-only. No selector, scoring, session, route, schema, payment, credits, or production behavior was changed by this PR.
