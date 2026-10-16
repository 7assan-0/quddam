# Lightning — 600-question editorial candidate and beta gates (2026-10-16)

**PARTIAL / NOT RELEASE APPROVED.** This is an unmerged Draft PR stacked on PR #16 exact base `11f4991062b27980d0022ba70f90aeadf10eedab`. No production seed, live data change, merge, deployment, payments, migration or new cloud resources.

## Authored expansion and stable identifiers

| Candidate | Added | Total | Per category | Difficulty of new rows |
| --- | ---: | ---: | ---: | --- |
| Existing baseline | — | 300 | 20 | Unchanged |
| `lightning-expansion-01.ts` | 60 | 360 | 24 | 2 MEDIUM + 2 HARD each |
| `lightning-expansion-02.ts` | 120 | 480 | 32 | 4 MEDIUM + 4 HARD each |
| `lightning-expansion-03.ts` | 120 | **600** | **40** | 4 MEDIUM + 4 HARD each |

All original IDs `lightning-{category}-{1..20}` retain their indices and exact source wording. New IDs append through 40, across 15 categories. The current seed keeps existing DB rows unchanged via its empty-update upsert. No historical match, immutable snapshot or existing question is rewritten. The 600 count is an **authored source candidate**, not a claim of 600 independently approved facts or 600 published rows in a deployed database.

## Quality measures added

- Existing per-row canonical answer/alias validation and source content validation remain enforced.
- A new *blocking* read-only source and configured-database audit detects Lightning/Category Board eligible published prompt collisions after NFC, Arabic diacritic/Alef/Ya, punctuation and whitespace normalization. Same text with conflicting canonical answers is flagged separately. It emits IDs, not private authored answers or match snapshots. Different prompts with the same answer remain allowed.
- The previously introduced `LIGHTNING_EDITORIAL_TARGET_600_NOT_MET` audit warning still applies automatically if **eligible** content falls below 600, e.g. on an old DB or if a candidate is archived/inactive; reaching the target does not bypass blocking errors.
- Tests cover total count, per-category distribution, stable historical IDs, difficulty tiers, collision reporting, excluded draft/archive/inactive rows, no source mutation and same-answer/nonduplicate behavior.

## Preliminary static candidate check (not a test PASS)

Read-only comparison of the authored literal rows **at the 600-candidate assembly step** observed 300+60+120+120=600, 40 per category, no empty row, no duplicate canonical/alias pair, zero identical normalized prompt collisions within Lightning and zero normalized-prompt matches with the 36 current Category Board *source* prompts. Clarification edits in expansion 02 replaced some near-duplicate geographic and travel questions with distinct topics. This does **not** establish absence of semantic paraphrases, correctness of every fact, the contents of a deployed DB, a successful Playwright run or a passed final SHA.

Useful primary review references for selected nontrivial entries (not a blanket factual certificate): KAUST identifies Thuwal as its official address, https://www.kaust.edu.sa/en/contact ; FIBA publishes its current official rules/equipment documents at https://about.fiba.basketball/en/services/resource-hub/downloads . Editorial review must attach evidence for any other uncertain geographic, history, sport, science, technical or date-sensitive prompt and correct/withdraw ambiguous answers rather than relying only on automated checks.

## Required verification — exact *final* PR SHA

On Node 24 and a **new isolated migrated/seeded PostgreSQL test database**:

```sh
cd qalba-platform
npm ci --no-audit --no-fund
npm run db:generate
npm run test -- --maxWorkers=1 --retry=0 tests/content/lightning-board-uniqueness.test.ts src/lib/games/lightning/module.test.ts src/lib/games/lightning/service.test.ts
npm run typecheck
npm run lint
npm run build
npm run db:migrate
npm run db:seed
npm run content:validate -- --output content-audit.json
npm run test:e2e:db -- tests/e2e/lightning-quiz.spec.ts
```

The migration/seed commands above require the independently configured isolated `DATABASE_URL` and synthetic seed credentials; **never** point them at production. The e2e runner independently creates its own isolated DB. Capture original failures and fresh exit codes bound to the final exact SHA. Verify content audit source **and** database counts, eligible published totals, aliases, category activation, no overlap, and the fact that reseeding does not modify pre-existing IDs or live match snapshots. Financial CI is a separate gate, not standalone Lightning Host/TV/buzzer acceptance.

## Release blockers / decision

- Fact-check and editorially approve or archive the new 300 candidates, including review of *meaning-level* overlaps that string equality cannot discover. This is separate from the row count.
- Isolated PostgreSQL content report and all new/affected unit tests, TypeScript, lint and build on the final committed head.
- Full Lightning Playwright (Host + two independent team buzzer phones + read-only TV), winner/timer/steal/concurrency/reconnect/rematch/credits and end-of-game persistence.
- Product's future 20-player shared QR integration is **not** represented by the existing standalone two-team buzzer flow. Real-device LAN/NAT and load tests remain NOT RUN until genuinely performed.
- PR #16 full security audit and the other platform operations/privacy gates must pass before external Beta.

**Current verdict: PARTIAL.** No implicit merge or deployment approval.
