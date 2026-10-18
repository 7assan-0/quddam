# Seven knowledge-category banks — 672-question candidate batch

**Status: AUTHORED DRAFT / NOT APPROVED FOR LIVE PLAY.** This batch covers the owner's requested first wave: **رياضة، تاريخ، لغة عربية، ثقافة، طعام، أماكن، حيوانات**.

## Exact counts

Each bank is 96 text Q/A candidates with 32 rows at each of 200 / 400 / 600. Each pack is stored separately under `prisma/board-expansion/*-candidate.ts`. Stable draft IDs are in `content-review/2026-10-18/Board_Knowledge_7x96_Review.csv`.

| Category | Slug | Draft items | Primary reviewer starting points |
|---|---|---:|---|
| الرياضة | `sports` | 96 | Olympics, World Athletics and World Rugby rule pages |
| التاريخ | `history` | 96 | Britannica historical entries and event timelines |
| اللغة العربية | `arabic` | 96 | Arabic Language Academy plus specialist grammar sources |
| الثقافة | `culture` | 96 | UNESCO Intangible Cultural Heritage list and country entries |
| الطعام | `food` | 96 | Britannica culinary reference and UNESCO food heritage entries |
| الأماكن | `places` | 96 | UNESCO World Heritage Centre site records |
| الحيوانات | `animals` | 96 | Smithsonian National Zoo, Britannica and IUCN starting points |
| **Total** | | **672** | |

## What has and has not been done

- **Authored:** 672 question/answer pairs, 224 at each tier across the seven categories.
- **Automated source gates:** exact count/tier quotas, normalized duplicate-prompt detection across the existing starter sample plus Geography96/Currencies96 and these seven packs, long-answer-in-prompt checks, and source-to-review-ledger synchronization.
- **Human factual review:** **PENDING for all 672**. Links in the CSV are reviewer starting points, not claims that each line has already been independently source-checked.
- **Accepted answer variants:** PENDING; blank in the CSV until a reviewer verifies Arabic spellings, transliterations, alternate names and valid answer forms.
- **Difficulty:** the 200/400/600 assignments are author hypotheses only. No blind player pilot has been run; do not treat a high point value as evidence that a question is genuinely harder.
- **Images/licensing:** these seven are text-only candidate banks. No external images have been added.
- **Runtime/seed:** these packs are intentionally **not imported** into `sourceBanks`, `prisma/core-content.ts`, or the Prisma seed. Current playable source remains the original 576 questions across six categories. No production DB, selector, scores, payments, rooms, sessions or deployment were changed.

## Required before import

1. A competent independent reviewer must mark each row APPROVE / REVISE / REJECT and record evidence, reviewer identity/date and accepted answer variants.
2. Fix any questionable or disputed facts and synchronize source + ledger.
3. Run a blind playtest for each category and reassign/replace items until each tier has defensible difficulty while preserving 32 items per tier.
4. Add category-specific QA: sports-rule version/source; date and chronology checks for History; specialist grammar review for Arabic; verify UNESCO inscription names/years for Culture; account for regional recipe variants in Food; primary heritage/site records for Places; scientific source verification and exceptions for Animals.
5. Run fresh exact-head Vitest, TypeScript, lint, production build, source-binding, empty synthetic PostgreSQL 17 seed/reseed, browser/RTL/44px, replay/rematch and security gates. Only then prepare a **separate** import PR with explicit owner approval.

## Current expansion arithmetic

- Baseline authored Board source: 576.
- Geography candidate: 96 (draft, not seeded).
- Currencies candidate: 96 (draft, not seeded).
- This seven-category batch: 672 (draft, not seeded).
- **Authored candidate pool across branches: 1,440**.
- Remaining 12 categories without a 96-item authored bank: movies, series, games, cars, logos, people, riddles, who-am-I, guess-picture, country-flags, proverbs, maps = **1,152 additional items**.
- End-state target remains **27 × 96 = 2,592**, with six selected categories and 36 question cells per match.

**Do not claim zero factual errors based on automated tests alone. No merge, seed, release or deployment approval is implied.**
