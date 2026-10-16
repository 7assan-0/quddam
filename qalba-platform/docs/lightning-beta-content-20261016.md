# Lightning — content expansion 01 / beta gate (2026-10-16)

Status: **PARTIAL / NOT RELEASE APPROVED**. Independent working branch stacked on PR #16 exact head `11f4991062b27980d0022ba70f90aeadf10eedab`. No merge, publishing, live data, payments, schema changes or cloud resources.

## Scope performed

- Existing authored Lightning bank: **300** prompts, 15 categories, 20 per category.
- Added **60** separately authored prompts in `prisma/lightning-expansion-01.ts`, exactly four per category. The exported source bank becomes **360**, 24 per category, with two medium and two hard expansion entries per category.
- Every original seed ID `lightning-{category}-{1..20}` and its original question order remain intact. The extension receives indices 21..24. No existing question history or immutable snapshot is edited. The seed uses the existing empty-update upsert and does not rewrite existing bank rows.
- Added a **blocking**, read-only cross-game audit for *eligible published* Lightning vs Category Board prompt identity. Arabic diacritics/Alef variants, whitespace and punctuation normalize for editorial comparison; it emits **IDs only**, checks identical prompts even when canonical answers conflict, and does not reject different prompts merely for sharing an answer. This applies independently to source and configured database audit (`npm run content:validate`), and also to the seed's existing source audit preflight.
- Preserved the existing engine minimum of 15 playable questions. The agreed **600-question editorial goal** is explicitly reported as `LIGHTNING_EDITORIAL_TARGET_600_NOT_MET` warning; it is not falsely labeled a runtime failure or silently represented as achieved. **240** more carefully reviewed original questions remain.
- Added tests for source total, stable IDs and difficulty expansion, duplicate rejection, eligible-status filtering, conflict reporting, same-answer nonduplication and nonmutation.

## Preliminary inspection — not an execution certificate

A read-only static comparison of the authored row literals on this branch observed **300 + 60 = 360** prompts in 15 category groups; no exact Arabic-normalized/punctuation-normalized duplicates within this authored bank or against the **36 Category Board seed prompts**. Each added row has a prompt and canonical answer. These observations do *not* validate a configured database, hidden semantic paraphrase collisions, factual correctness of all 360 questions, or a successful runtime test. PR CI and editorial review must establish those separately.

## Required independent verification

On the exact final branch head, with Node 24 and a fresh **isolated** migrated and seeded database:

```sh
cd qalba-platform
npm ci --no-audit --no-fund
npm run db:generate
npm run test -- --maxWorkers=1 --retry=0 tests/content/lightning-board-uniqueness.test.ts src/lib/games/lightning/module.test.ts src/lib/games/lightning/service.test.ts
npm run typecheck
npm run lint
npm run build
npm run content:validate -- --output content-audit.json
npm run test:e2e:db -- tests/e2e/lightning-quiz.spec.ts
```

Capture exact SHA, process exit codes, source/database bank counts, blocking overlap IDs, warnings, tests passed/failed/skipped/flaky and original failures. Never run a configured-database content validation on production just to claim this PR passed; do not weaken CI or retry failing tests away. Check original unchanged IDs and row status on an isolated reseed.

## Further acceptance blockers

1. Editorial review of the 60 candidates and remaining 240 questions with appropriate primary references for nontrivial factual assertions. Review **meaning-level** overlap with Category Board, which string normalization alone cannot prove absent.
2. Content audit on actual isolated PostgreSQL bank, including category activation and published statuses.
3. Full Playwright Lightning Host + both team buzzer phones + TV journey, loss/reconnection, timeout/steal, concurrent buzz, rematch, credit/idempotency and final persistence, with result bound to the final SHA.
4. Product-wide shared QR/20-player integration is **not provided by this standalone two-team buzzer engine**. Do not claim integration or a real-device LAN/NAT pass.
5. PR #16 full security audit and broader beta operations gates remain separate blockers.

Only after the above can the game be labeled GAME_READY for its approved scope; external Beta remains NO-GO until platform gates also pass.
