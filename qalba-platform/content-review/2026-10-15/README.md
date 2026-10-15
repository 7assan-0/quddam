# Quddam content remediation — review-only staging (2026-10-15)

This directory contains editorial CSV snapshots only. **They are NOT imported by prisma/seed.ts, the application, or a live database.** Do not imply that merging this PR publishes the revised question banks.

## Attached reviewed drafts

- `Board_1296_Remediated.csv` — 1,296 proposed board questions
- `Lightning_600_Remediated.csv` — 600 proposed lightning questions
- `Letter_224_V3_Canonical_Unmodified.csv` — 224 questions across 28 letters, six medium and two hard per letter. Do not import it alongside the old letter seed.
- `Survey_26_Remediated.csv`, `Forbidden_52_Remediated.csv`, `Bluff_13_Remediated_Sourced_Review_Pending.csv`, `Ranked_15_Remediated.csv`, `Ordering_15_Remediated.csv`, `Court_15_Remediated.csv` — proposed additional/replacement content, **not automatic production seed changes**.
- `Issue_Ledger_After_Remediation.csv` — the original 63-item ledger (60 patched locally and three originally source-blocked); these labels describe the supplied offline pack, **not 63 runtime-verified fixes**.
- `Before_After_Diff_Items.csv` — 60 editorial before/after comparisons.

## Source-code changes in this draft PR

- Diversify 48 of 60 previously same-format alphabetic ordering questions, preserving 180 original identifiers and 10 explicit archive IDs.
- Distinguish prosecution/rebuttal prompts in all 180 original fictional court cases.
- Add weights for the missing Arabic letters: ث خ ذ ز ض ظ غ (28 weighted letters total). Display of all letters still requires importing the matching approved bank; availability logic filters letters with fewer than eight questions.
- Fix the `orderingQuestion` and `courtCase` seed upserts, which formerly used empty `update` objects. **Only run seed against an isolated, disposable test DB after review.**
- `tests/content-remediation.test.ts` tests source invariants and actual game validators.

## Release gate

NO-GO until: independent editorial/factual and semantic duplicate review; explicit import mapping for the revised CSVs; isolated PostgreSQL seed twice plus archived-row checks; typecheck/lint/build/tests; browser session for all games; manual approval of migration, merge, and deployment.

Never apply this review CSV directory directly to a production database. No secrets or database connection strings are stored in it.
