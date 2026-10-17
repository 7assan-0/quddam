# Board576 – editorial fact-check and ambiguity remediation (17 Oct 2026)

**Branch:** `content/board-576-fact-review-20261017`, stacked on PR #42. **Candidate DRAFT, NOT approved for publishing.** This is an assistant-led initial editorial pass over 576 authored records, NOT an independent specialist's factual approval or six-response empirical pilot.

## Inventory, criteria, actions

Read the 72 legacy rows and all 504 new rows in the six source files. Checked the unambiguous target, published/stable law or science context, prompt–answer alignment, cross-old/new synonym repeats, category and assigned point tier. The original 72 rows remain byte-identical and ID-stable; none of their existing scores will be silently overwritten. Corrected **23 new candidate rows in situ** with their existing stable IDs and their 200/400/600 bucket unchanged. Rebuilt `content-review/2026-10-17/Board_576_Item_Review.csv` from exact revised source, all 576 entries, with `assistant_screening=ASSISTANT_SCREENED_NOT_INDEPENDENT`, individual correction notes, references where independently consulted, zero fictitious editor/reviewer/date or live participant results, and **30 difficulty review flags**.

### Confirmed high-impact examples

| Stable ID | Finding | Action / authoritative basis |
|---|---|---|
| 169 | Al Khobar was inaccurately described as the city known for the main port south of Dammam | Removed the misleading port reference, retained clear Khobar coastal clue; Saudi government places **King Abdulaziz Port in Dammam**: https://my.gov.sa/en/content/transport |
| 220 | Saudi UNESCO rock-art site was described with a vague self-answering clue | Named Jubbah / Umm Sinman + Shuwaymis / al-Manjor and Raat as the two components: https://whc.unesco.org/en/list/1472 |
| 259 | Crossing the goal line at any location is not sufficient to count a goal | Specified **between posts and under crossbar**: https://www.theifab.com/laws/latest/determining-the-outcome-of-a-match/ |
| 269 | Being simply ahead or receiving a pass does not itself constitute an offside offence | Tied judgement to position when teammate plays/touches, active involvement, Law 11: https://www.theifab.com/laws/latest/offside/ |
| 329, 335, 355 | Colloquial vapor/mist, precipitation vs rain, crust vs lithosphere ambiguities | Narrowed prompts rather than accepting several different plausible answers |
| 393 | Previously claimed average particle kinetic energy *must drop* on condensing gas, which is wrong for an isothermal phase change | Replaced with released **latent heat of condensation** at fixed temperature: https://openstax.org/books/university-physics-volume-2/pages/1-5-phase-changes |
| 411, 438, 444, 450, 465 | Vague sound-port term, conflating Linux kernel with full OS, incomplete RAM-versus-SSD comparison, circular IP definition and circular/over-narrow NVMe description | Rewrote for one intended answer. NVMe is a specification for nonvolatile memory across multiple transports, often PCIe: https://nvmexpress.org/specifications/ |
| 493, 537, 543, 557, 562 | Circular password prompt, default credentials incorrectly named as the **vulnerability**, accountability conflated with individual account assignment, vague Nonce uniqueness, false implication that MAC secret key must be short | Rephrased to identify actual practice/technical concept; MAC uses a **shared symmetric secret**: https://csrc.nist.gov/glossary/term/message_authentication_code |
| 252, 494, 524, 552, 415 | Duplicated facts across old/new despite different spelling or answer language: area of penalty; phishing; least privilege; SQL injection/حقن SQL; self-answering PDF | Replaced with independent original questions (stadium stands, face unlock, system hardening, TOCTOU, purpose of PDF). TOCTOU: https://cwe.mitre.org/data/definitions/367.html |

Additional consulted sources: current IFAB 2026/27 Law 1 goal/area dimensions https://www.theifab.com/laws/latest/the-field-of-play/ and Law 15 throw-ins https://www.theifab.com/laws/latest/the-throw-in/ and 8-second corner consequence https://www.theifab.com/laws/latest/fouls-and-misconduct/ ; UNESCO Saudi listing https://whc.unesco.org/en/statesparties/sa and Hima inscriptions https://whc.unesco.org/en/list/1619/ ; UNESCO Al Faw capital of Kinda https://whc.unesco.org/en/list/1712/ ; NIST MAC definition above. Sources support cited **specific facts**, not the entire 576 as a set.

## What tests can and cannot establish

Current source inspection finds **576 total**, exactly 6 categories × 96 and each 32 × 200 / 32 × 400 / 32 × 600 per category. Zero exact/normalised duplicate prompts, zero same-answer high-lexical-overlap pairs under the documented threshold, and zero new prompts containing their own complete answer in normalised text. Added machine checks for critical previously wrong records and synced ledger. This does **not** prove absence of paraphrase duplicates with different canonical answers or every historical fact in the full archive.

Thirty rows have `RECOMMENDED_TIER_RECHECK`: historical 3, 6, 12, 13, 21, 24, 27, 30, 33, 66, plus candidate 133,145,147,225,226,236,320,384,392,400,402,403,404,405,465,466,483,485,489,567. Examples: 600 asks what pH is (403), which connector is USB-C (489), what 2^10 is (145), where Amlaj belongs (225). They are only an initial editorial hypothesis; no score changes, no hypothetical participant scores and no re-seeding existing published questions. Empirical blind calibration kit is already present in `scripts/board-576-blind-calibration.mjs`.

## Mandatory release gates remaining

1. Independent human factual reviewer signs off **all 576** rows, with authoritative item-specific source or confirmed commonly settled stable fact, alternate valid answers, accepted forms, and clear `APPROVE/REVISE/REJECT` per question. Review 30 difficulty flags in particular.
2. Real blind two-group human playtest: 12 participants, 6 independent attempts per question across six actual sittings, judgement on alternate spoken answers and timed results. No automatic approval without complete data or human editor.
3. Revise affected source and ledger, preserve 96/each and the 32-point-value buckets, then rerun source QA + seed on EMPTY synthetic PG17 + literal exact-head unified Chrome Night/Shillatak/Room36/PGlite integration.
4. Respect separate full dependency audit blocker (braces) and do not merge, seed customer DB, activate payments, create paid cloud resources, or public-release by implication.

**Decision:** `EDITORIAL_REVISED_PENDING_INDEPENDENT_REVIEW_AND_REAL_PILOT`, not approved.