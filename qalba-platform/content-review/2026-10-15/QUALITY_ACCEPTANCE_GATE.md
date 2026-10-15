# Quddam — content quality acceptance gate (review-only)

Status: **NO-GO**. This document is a review contract, not publication approval. The user approved these criteria on 2026-10-15. It applies to all ten game experiences, not just question counts. No automatic merge, production import, staging deployment, payment, or billing action is authorized by it.

## Acceptance criteria

1. **Factual correctness:** Every publishable question has an unambiguous correct primary answer. Reference-sensitive facts require an independently checked authoritative citation and review date. Flag time-dependent claims and explicitly scope the date. An unsupported item is held or replaced, never quietly marked approved.
2. **No semantic repetition:** Compare the fact or task being tested within a game and across games, even if wording differs. Exact normalized-text tests are an additional automated minimum, **not** a substitute for semantic review. Identical answers alone are review candidates, not proof of repetition: e.g., two different facts can both answer “تونس”.
3. **Engaging and game-specific:** Questions must suit the respective game mechanics and remain enjoyable in repeated sessions; reject rote templates, awkward trivia, leading clues and near-identical challenges.
4. **Calibrated difficulty:** Easy must remain worthwhile; medium requires recall/reasoning; hard must be answerable from established knowledge and clear clues, not arbitrary obscurity. Record playtest evidence and revise mismatches.
5. **Meaningful variety:** Review category balance and distinct subject matter (history, religion, geography, science, culture, sports, technology, states, capitals, currencies) across a bank, not just nominal category labels.
6. **Safe answer acceptance:** Review each primary answer and every alias against the question, including spelling/normalization and potential false positives. Reject alternatives naming a different person, place, currency, compound, unit or object.
7. **Actual gameplay:** Validate in the game's real interface and input path (including timers, score, normalization, repetition behavior and multi-player where applicable); a passing unit test is insufficient.

## Required evidence per bank before approval

- Current canonical review-bank filename, stable IDs and exact row count, clear replacement/import mapping, and proof old bank is not concurrently imported.
- Editorial tracking for every item: status, primary answer, alternate answers, source citation when appropriate, independent reviewer, review date, category, difficulty and any hold reason.
- Full QA for the **227 Board reference-sensitive items** identified in the prior audit; verify the count/scope independently and do not infer approval from a source URL alone.
- Review all **63 ledger items** independently. Earlier ledger labels report 60 editorial local patches, not runtime-accepted fixes, and three open blockers.
- Cross-bank normalized duplicate regression plus semantic overlap review of all game content. Preliminary 2026-10-15 scan found one exact Board/Lightning question match (Board #907 vs Lightning science #31), now replaced in the review-only Lightning CSV with a distinct question about viscosity. NIST provides a preliminary factual reference: https://www.nist.gov/itl/math/rheology. The replacement remains subject to independent editorial/playtest acceptance.
- The same preliminary comparison yielded 76 shared-primary-answer pairs between Board and Lightning, seven Board/Letter pairs, and one Lightning/Letter pair. These **84 candidate pairs are NOT 84 proven duplicates**; triage them by whether the tested fact is the same, and perform wider semantic review beyond equal-answer pairs.
- The 84 candidate pairs are indexed in `Cross_Bank_Shared_Answer_Triage.csv`, all marked `REVIEW_REQUIRED`/`UNDECIDED` until independent item-by-item adjudication. They contain identical primary answers, **not proof of duplicates**.
- A separate non-identical-answer semantic match was confirmed during phrase-similarity screening: Lightning `lightning-v600-science-36` (المحفز) and Letter `letter-mh-047` (حفاز) both tested the catalyst concept. The Lightning review CSV now has a replacement Arrhenius question with answer `طاقة التنشيط`, preliminary IUPAC source https://goldbook.iupac.org/terms/view/A00102. Its editorial suitability remains unapproved; see `tests/content-review-cross-bank.test.ts` for a known-regression guard.
- Letter V3 is superseded for editorial review by `Letter_224_V4_Aliases_Corrected_Review_Pending.csv`; nine false alternatives were removed. V4 still needs independent fact, meaning and alias review. Preserve the 28 letters × eight questions (six medium and two hard each).
- Isolated import/migration plan; twice-executed content seed against disposable PostgreSQL with archived-row and idempotence checks; full application tests, typecheck, lint, build and end-to-end game sessions on the **actual final candidate SHA**.
- Review and acceptance of remaining editorial, ambiguity, accessibility and runtime findings. None of these gates can be waived by achieving a numeric count.

## Publication decision

**NO-GO** while any false answer, unresolved ambiguity, unverified reference-sensitive item, harmful semantic duplication, broken game path or unapproved migration remains. Tests must report the exact SHA they validated. Author approval of criteria does not equal approval to merge/deploy. Only a separate explicit owner approval after evidence review may advance a future release candidate.
