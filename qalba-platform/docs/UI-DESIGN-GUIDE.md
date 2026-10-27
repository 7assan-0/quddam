# Quddam — UI delivery rules

Status: owner decisions + implementation guardrails. This file complements `qalba-platform/AGENTS.md` (Next.js technical instructions). It does **not** imply that unfinished designs or gameplay flows have been implemented or approved.

## Non-negotiable product decisions

- Arabic-first interface; preserve semantic RTL reading/navigation order. Display numerical values with Latin digits (0–9), including boards, timers, wallet figures and results.
- Category Board launches with **six categories × six cells = 36 tiles** (two independent questions each for 200, 400 and 600 points); do not change selection, scoring or credits as part of a visual patch.
- **New Board setup defaults to exactly 60 seconds per question.** The setup screen must not offer competing time choices. Existing game sessions and other game timers must not silently change. The backend/API may still accept historical durations until a separate validated domain change is approved.
- The requested end-state *question screen flow* is three clean stages: **question → «التالي» reveals answer → «التالي» displays first team / second team / «ولا أحد» judgment**. No manual answer input. This is an **outstanding cross-layer requirement**, not a statement that the currently deployed server command/state machine supports these three choices. Implement it only with matching authoritative server commands, migrations only when explicitly approved, and regression tests; never fake point awards client-side.
- Favor uncluttered screens and one obvious primary action at each stage. The owner rejected the previous busy visual treatment. Keep the question itself as the focus.
- Category selection should ultimately use a restrained cream/beige backdrop and genuinely relevant **approved real-world images** where available. No random image URLs, invented assets or unrelated AI pictures. Until image assets and final screenshots are available, do not claim visual acceptance or substitute illustrations as if approved.
- Keep separate host, phone and TV experiences; TV must remain readable at distance, while mobile controls must not overflow.
- Preserve existing team identities, game availability, room access, score/credit/receipt policies and approved routes.

## Accessibility & implementation standards

- Minimum touch area: 44 × 44 CSS pixels for interactive controls; visible focus indicators and keyboard operation.
- Readable long Arabic titles, safe text wrapping, strong contrast, non-color-only status indicators and meaningful disabled explanations.
- Respect `prefers-reduced-motion`; avoid gratuitous backgrounds, animations and extra informational panels.
- Keep modal explanations accessible and distinct from checkbox selection. Information buttons must never toggle categories.
- Verify in real browsers at 360px, 390px, 1440px and 1920px, including RTL, overlays, long names, question/answer/results, 36 tiles and TV mirroring.
- Presentation changes should be isolated from game services, payment, authentication, Prisma, database operations and production deployment.
- Require human visual signoff, plus unit/TypeScript/lint/build/browser checks on the **exact** final commit; prior green PR checks do not apply to new heads.

## Delivery workflow

1. Start from the latest explicitly selected **unmerged UI candidate**, not production `main` without review.
2. Read `AGENTS.md` and nearby components/styles before changing code.
3. Land one coherent screen or flow per reviewable commit or PR; list screenshots and tests not yet performed.
4. No merge, push to `main`, Vercel redeploy, migration, seed, payment activation or production data change without explicit owner approval.
