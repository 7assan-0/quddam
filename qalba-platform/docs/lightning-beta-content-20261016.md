# Lightning — 600 eligible-question editorial candidate and beta gates (2026-10-16)

**PARTIAL / NOT RELEASE APPROVED.** This is an unmerged Draft PR stacked on PR #16 exact base `11f4991062b27980d0022ba70f90aeadf10eedab`. No production seed, live data change, merge, deployment, payments, migration or new cloud resources.

## Authored expansion and stable identifiers

| Candidate | Added | Total | Per category | Difficulty of new rows |
| --- | ---: | ---: | ---: | --- |
| Existing baseline | — | 300 | 20 | Unchanged |
| `lightning-expansion-01.ts` | 60 | 360 | 24 | 2 MEDIUM + 2 HARD each |
| `lightning-expansion-02.ts` | 120 | 480 | 32 | 4 MEDIUM + 4 HARD each |
| `lightning-expansion-03.ts` | 125 (120 regular + 5 replacements) | **605 authored / 600 eligible** | **40 eligible** | 4 MEDIUM + 4 HARD each, plus 5 HARD replacements |

All original IDs `lightning-{category}-{1..20}` retain their indices and exact source wording. There are **605 source rows**, with five known meaning-equivalent legacy questions intentionally `ARCHIVED` in a fresh seed and replaced by five additional appended rows. Thus there are **600 eligible candidate prompts, 40 per category**. The five retained archived IDs are `lightning-sports-1`, `lightning-science-16`, `lightning-technology-9`, `lightning-technology-13`, and `lightning-technology-17`. Their historical IDs and snapshots are never rewritten. Because existing DB rows use empty-update upsert, previously published copies are **not silently archived by seed**; the enhanced audit blocks their known overlap until a separate approved content operation archives them. This is not a claim of 600 independently fact-approved questions or a validated deployed bank.

## Quality measures added

- Existing per-row canonical answer/alias validation and source content validation remain enforced.
- A new *blocking* read-only source and configured-database audit detects Lightning/Category Board eligible published prompt collisions after NFC, Arabic diacritic/Alef/Ya, punctuation and whitespace normalization. A second curated blocking check tracks five confirmed **meaning-equivalent** legacy pairs that are not caught by literal matching. Both checks operate on eligible published records, emit only IDs, and do not edit database content. Same text with conflicting canonical answers is flagged separately. It emits IDs, not private authored answers or match snapshots. Different prompts with the same answer remain allowed.
- The previously introduced `LIGHTNING_EDITORIAL_TARGET_600_NOT_MET` audit warning still applies automatically if **eligible** content falls below 600, e.g. on an old DB or if a candidate is archived/inactive; reaching the target does not bypass blocking errors. Existing DBs with the five old pairs still published fail the new semantic gate; seed's `update:{}` deliberately does not rewrite legacy rows.
- Tests cover total count, per-category distribution, stable historical IDs, difficulty tiers, collision reporting, excluded draft/archive/inactive rows, no source mutation and same-answer/nonduplicate behavior.

## Preliminary static candidate check (not a test PASS)

Read-only comparison of the authored literal rows after five replacements observed 300+60+120+125=**605 total**; with the five curated legacy exclusions, **600 eligible / 40 per category**, no invalid empty row or duplicate canonical/alias pair, zero identical normalized prompt collisions within Lightning and zero normalized-prompt matches with the 36 current Category Board *source* prompts. A separate comparison of identical answer concepts revealed five confirmed old question paraphrases, now retired from fresh-seed eligibility without deleting their IDs. Clarification edits in expansion 02 replaced some near-duplicate geographic and travel questions with distinct topics. This does **not** establish absence of semantic paraphrases, correctness of every fact, the contents of a deployed DB, a successful Playwright run or a passed final SHA.

Useful primary review references for selected nontrivial entries (not a blanket factual certificate): KAUST identifies Thuwal as its official address, https://www.kaust.edu.sa/en/contact ; FIBA publishes its current official rules/equipment documents at https://about.fiba.basketball/en/services/resource-hub/downloads . Editorial review must attach evidence for any other uncertain geographic, history, sport, science, technical or date-sensitive prompt and correct/withdraw ambiguous answers rather than relying only on automated checks.

## Strict Beta v1 acceptance gate

The catalogue's ordinary runtime minimum (15 questions) is not the Beta launch target. A separate read-only gate, `src/lib/content/lightning-beta.ts`, requires:
- **600 structurally valid, eligible PUBLISHED questions**, not 600 raw rows (the five historical archives never count);
- **15 distinct active categories with at least 40 valid eligible questions each**;
- zero bank validation failures and zero published cross-game exact/Arabic-normalized or five known curated semantic collisions;
- **both authored source AND a fresh isolated migrated/seeded database** passing. Source-only reporting returns `NOT_RUN_DATABASE` with Exit 2, never a launch PASS.

Run the stricter validation only with disposable synthetic credentials:

```sh
cd qalba-platform
# Point DATABASE_URL at an isolated disposable, migrated & seeded database.
LIGHTNING_BETA_TEST_DATABASE=1 node --import tsx scripts/lightning-beta-validate.ts --output lightning-beta-report.json
# Exit 0 = source+database PASS; Exit 1 = factual structure/count/overlap failure;
# Exit 2 = source-only/unexecuted database or setup failure.
```

No production writes are performed by this validator. A new Playwright case also checks the isolated fresh-seed database: 605 authored rows, 600 PUBLISHED/active/ar-SA across 15 categories (40 each), and the exact five archived historical IDs. That Playwright runner uses isolated PGlite; it is **not proof of native PostgreSQL 17**. Native PostgreSQL 17 and a full 21-case Lightning browser run must be independently executed on the exact final SHA.

Selected primary-reference spot checks, not a complete editorial certificate: KAUST's official location is Thuwal (https://admissions.kaust.edu.sa/about-kaust/kausts-location); the FIBA rule hub publishes the 2024 four-by-ten-minute regulation (https://refereeing.fiba.basketball/en/rules); the Saudi Ministry of Foreign Affairs describes 1932 unification (https://www.mofa.gov.sa/ar/ministry/officialvisits/JeddahSummit2023/Pages/AboutKingdom.aspx). Every other ambiguous or date-sensitive authored assertion needs appropriate primary-reference editorial approval before publication.

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
LIGHTNING_BETA_TEST_DATABASE=1 node --import tsx scripts/lightning-beta-validate.ts --output lightning-beta-report.json
npm run test:e2e:db -- tests/e2e/lightning-quiz.spec.ts
```

The migration/seed commands above require the independently configured isolated `DATABASE_URL` and synthetic seed credentials; **never** point them at production. The e2e runner independently creates its own isolated DB. Capture original failures and fresh exit codes bound to the final exact SHA. Verify content audit source **and** database counts, eligible published totals, aliases, category activation, no overlap, and the fact that reseeding does not modify pre-existing IDs or live match snapshots. Financial CI is a separate gate, not standalone Lightning Host/TV/buzzer acceptance.

## Release blockers / decision

- Fact-check and editorially approve or archive the 305 added candidates (including five replacement prompts), including further review of *meaning-level* overlaps that string equality cannot discover. A pre-existing database with the five old IDs still published must undergo an explicitly approved, backed-up content retirement; run validation again afterward. No automatic production update is authorized. This is separate from the row count.
- Isolated PostgreSQL content report and all new/affected unit tests, TypeScript, lint and build on the final committed head.
- Full **21-case** Lightning Playwright (including fresh-seed inventory, Host + two independent team buzzer phones + read-only TV), winner/timer/steal/concurrency/reconnect/rematch/credits and end-of-game persistence.
- Product's future 20-player shared QR integration is **not** represented by the existing standalone two-team buzzer flow. Real-device LAN/NAT and load tests remain NOT RUN until genuinely performed.
- PR #16 full security audit and the other platform operations/privacy gates must pass before external Beta.

**Current verdict: PARTIAL.** No implicit merge or deployment approval.
