# قالوا الناس — assistant-led triage, 91 questions and 117 aliases
Date: 17 October 2026. Scope: exact review-only candidate stacked on PR #30 `f74d1809e225f21e1a3a7e810a15bf548b5956ba`. **NOT independently approved, NOT real-poll data, NOT imported, NOT human-playtested.**

## Actions on this branch
1. Read 91 proposed rows (65 stable source IDs, 26 review-only new IDs), all 546 primary answer slots, all 117 proposed aliases, and historical human-pending ledger.
2. Corrected one unambiguous candidate prompt–answer mismatch: `survey-supplement-tech-01` previously asked specifically for an **عطل**, but one answer is “تحديث يتطلب إعادة التشغيل” (a planned update is not a malfunction). Reworded in both review-only CSVs and the existing item ledger to **«سبب يخليك تعيد تشغيل جوالك؟»**. Six original slots, 100 authored points and three aliases preserved. The seeded 65 and historical `Survey_26_Remediated.csv` were NOT edited.
3. New full assistant preliminary inventory `Survey_91_Assistant_Triage_No_Human_Signoff.csv`: exactly 91 item rows, **12 P1 / 13 P2 / 66 STANDARD**. STANDARD means *no specific issue noted in an initial text screen*, **not** approval. All have separate item/score/blind-playtest PENDING and empty reviewer/date.
4. New `Survey_117_Alias_Semantic_Review_Pending.csv`: all 117 candidate alias-to-primary mappings, **6 P1 / 4 P2 / 107 STANDARD**, all PENDING, reviewer/date blank. An exact normalized collision count of zero cannot justify treating the 117 aliases as semantically accepted.

### Most important unresolved editorial decisions

| ID | Why | Required host/editor decision |
|---|---|---|
| survey-seed-11 | “تقسيم الأطباق” and “تجهيز الصحون” may be same household task | Define assigning dishes to people versus placing/preparing plates, or replace slot |
| survey-seed-20 | “المكونات” broadens “المقادير” (names vs quantities) | Narrow or remove the alias after Saudi spoken tests |
| survey-seed-26 | Generic “قلم” can cue specific pen types, glue is ranked unusually high before eraser | Clarify bare answer, test ranked first guesses; no invented poll |
| survey-seed-49 | “الجوال مو ثابت” does not establish shake versus fall | Clarify concrete symptom, never award two slots |
| survey-seed-58, supplement-occasions-01, supplement-occasions-02 | Venue, map URL, guest transport and departure time may elicit “الموقع” ambiguously | Distinguish exact location vs location link vs directions and keep near-theme rounds apart |
| survey-seed-61 vs seed-63 | Lost-object comedy in two prompts can make a five-round match repetitive | Session-level topic spacing and real first-guess testing |
| supplement-tech-01 | Updated fault-vs-update wording; “الجوال معلق” can still describe freeze or non-working touch | Human clarifies screen visual freeze versus touch input failure |
| supplement-saudi-01 | “برادة” may mean a dispenser as well as a portable cooler | Test dialect; remove if ambiguous |
| supplement-games-02 | “توزيع الجائزة” is broader than “تسليم الجائزة” | Do not auto-map without specific evidence |
| supplement-light-01 | “تتأكد من الجيران” does not necessarily mean asking the neighbours | Review or remove that loose alias |
| supplement-light-02 | “ضحك جماعي” is not always a “ضحكة معدية” | Review or remove alias instead of claiming one-to-one synonymy |
| supplement-cars-01 | Six structurally different tyre properties, but numerical ordering is authored, not empirically measured | Blind top-of-mind answer frequency, host understanding of each answer and alias |

All detailed flags for 91 are recorded, including less serious ranking/wording risks.

## Scores and actual difficulty
Survey Show has **no 200/400/600 question tiers**. Its six answers carry descending **authored game scores**. This review confirms 91/91 candidate rounds sum to 100; 13 categories × 7, 546 primary slots, 117 aliases, zero within-round normalized alias collisions or literal duplicate prompts. **There are no empirical respondents, popularity percentages or calibrated difficulty levels.** Blind two-group playtest should separately record: first answer spontaneously guessed, how many of the six answers were found, attempts/strikes, host false positives and ambiguous decisions, rank order agreement and five-round theme repetition. Explicitly consider re-ranking the six answers when actual players disagree strongly with authored order; do not assign new live points without editor/owner signoff.

## Hold points
- Two independent Saudi Arabic speaking editors review each of 91 scenes, 546 concepts and 117 one-to-one aliases. Record reviewer, date, rationale, and APPROVE/REVISE/REJECT, not an assistant-generated blanket PASS.
- Two genuine groups play blind: display no answers before initial guesses. Preserve minimum information without participant PII and keep any raw spoken-answer observations private. Test explicit P1 situations. Host is final semantic judge; automatic matcher is exact-ish normalized matching, not semantic NLP.
- Later Codex may implement an isolated **91-candidate seed and browser** on a fresh synthetic DB after approved review and stable-ID mapping; the successful PR #30 Chrome result covers the **original 65 only**.
- Preserve in-app notice that scores are curated, not a scientific or measured survey. Do not merge, import into runtime, seed real DB, activate payments, launch or waive full dependency audit based on this documentation.

Outcome: `ASSISTANT_INITIAL_REVIEW_COMPLETE / CONTENT_PUBLICATION_NO_GO / HUMAN_REVIEW_AND_BLIND_RANK_CALIBRATION_PENDING`.
