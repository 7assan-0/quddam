# Quddam content remediation — review-only staging (2026-10-15)

This directory contains editorial CSV snapshots only. **They are NOT imported by prisma/seed.ts, the application, or a live database.** Do not imply that merging this PR publishes the revised question banks.

See [QUALITY_ACCEPTANCE_GATE.md](QUALITY_ACCEPTANCE_GATE.md) for the mandatory acceptance standards, [SEVEN_GAMES_PRELIMINARY_AUDIT.md](SEVEN_GAMES_PRELIMINARY_AUDIT.md) for the initial seven-game inventory, and [SEVEN_GAMES_REMEDIATION_PROGRESS.md](SEVEN_GAMES_REMEDIATION_PROGRESS.md) for the actual follow-up changes and blockers. None of these documents is release approval.

Current Court ledger: `Court_180_Individual_Editorial_Gate_V2.csv` reflects removal of the universal ungrounded prior-agreement fact across 180 original cases. `Court_180_Individual_Editorial_Gate.csv` remains the first-pass historical evidence, not the current gate. Both are review-only and **NO-GO** for human editorial/playtest acceptance.

Current Bluff fact-review sheet: `Bluff_169_Item_Review_Gate_V3.csv` (169 rows; 6 original source-corroborated, 150 original without item-level references, 13 staged with preliminary corroboration). Earlier V1/V2 sheets are historical; no item is publication-approved. Human factual/alias/editorial signoff remains pending.

## Attached reviewed drafts

- `Board_1296_Remediated.csv` — 1,296 proposed board questions
- `Lightning_600_Remediated.csv` — 600 proposed lightning questions
- `Letter_224_V3_Canonical_Unmodified.csv` — historical unmodified V3 snapshot; do **not** use for approval because nine invalid alternative answers were identified.
- `Letter_224_V4_Aliases_Corrected_Review_Pending.csv` — proposed replacement review snapshot: 224 questions across 28 letters, six medium and two hard per letter; nine invalid alternative answers removed. **Still pending independent factual, alias and semantic review.** Do not import alongside the old letter seed.
- `Survey_26_Remediated.csv`, `Forbidden_52_Remediated.csv`, `Forbidden_13_Hard_Candidates_Review_Pending.csv`, `Bluff_13_Remediated_Sourced_Review_Pending.csv`, `Ranked_15_Remediated.csv`, `Ordering_15_Remediated.csv`, `Court_15_Remediated.csv` — proposed additional/replacement content, **not automatic production seed changes**. The 13 new hard Forbidden cards require actual team playtesting.
- `Lightning_600_Remediated.csv` contains review-only replacements for two verbatim cross-game duplicates: Board #907 vs Lightning science #31 (now viscosity; preliminary NIST reference), and original Bluff cinema #11 vs Lightning screen #03 (now clapperboard; reference/editorial acceptance still pending). Semantic QA/playtesting remains pending.
- `Issue_Ledger_After_Remediation.csv` — the original 63-item ledger (60 patched locally and three originally source-blocked); these labels describe the supplied offline pack, **not 63 runtime-verified fixes**.
- `Before_After_Diff_Items.csv` — 60 editorial before/after comparisons.

## V4 letter alias audit

The nine incorrect alternatives removed in V4 were associated with question IDs `letter-mh-022`, `031`, `062`, `099`, `132`, `153`, `183`, `186`, `202`. They incorrectly accepted a different country, compound, currency, person, location, device, rock-unrelated term or currency as the target answer. V3 is retained solely as historical evidence. This is an editorial-only correction, not a deployed data migration or a completed verification of all 224 items.

- `Ordering_15_Remediated.csv` also resolves a confirmed instruction/last-item contradiction at `ordering-supplement-geography-01`: fourth answer item now "بدء الرحلة", matching the instruction.

## Source-code changes in this draft PR

- Diversify 48 of 60 previously same-format alphabetic ordering questions, preserving 180 original identifiers and 10 explicit archive IDs.
- Distinguish prosecution/rebuttal prompts in all 180 original fictional court cases.
- Add weights for the missing Arabic letters: ث خ ذ ز ض ظ غ (28 weighted letters total). Display of all letters still requires importing the matching approved bank; availability logic filters letters with fewer than eight questions.
- Fix the `orderingQuestion` and `courtCase` seed upserts, which formerly used empty `update` objects. **Only run seed against an isolated, disposable test DB after review.**
- `tests/content-remediation.test.ts` tests source invariants and actual game validators.

## Release gate

NO-GO until: independent editorial/factual and semantic duplicate review; explicit import mapping for the revised CSVs; isolated PostgreSQL seed twice plus archived-row checks; typecheck/lint/build/tests; browser session for all games; manual approval of migration, merge, and deployment.

Never apply this review CSV directory directly to a production database. No secrets or database connection strings are stored in it.

## Latest item-by-item acceptance gate (2026-10-15)

See [EDITORIAL_AND_GAMEPLAY_GATE_STATUS.md](EDITORIAL_AND_GAMEPLAY_GATE_STATUS.md) for the exact factual/semantic/gameplay findings and NO-GO status. It references these current inventories:
- `Bluff_169_Item_Review_Gate_V2.csv`: all 156 original + 13 staged candidate items, references/aliases/semantic flags and explicitly pending editorial sign-off. Supersedes earlier `Bluff_169_Item_Review_Gate.csv` as current review state.
- `Court_180_Individual_Editorial_Gate.csv`: 180 distinct scenarios but 180 repeated background-fact formulations still require human editorial and jury playtesting.
- `Forbidden_13_Hard_Candidates_Review_Pending.csv` and `Forbidden_13_Hard_Playtest_Gate.csv`: 13 provisional hard cards and individualized clue/risk review. No actual human playtest claimed.

Two original Bluff semantic duplicates were replaced with independently referenced chess-stalemate and CSS font-size facts, and one staged SMTP duplicate was replaced with RFC-backed DNS MX. Source-code changes remain on this Draft PR only, and review-only CSVs are **not imported**.
