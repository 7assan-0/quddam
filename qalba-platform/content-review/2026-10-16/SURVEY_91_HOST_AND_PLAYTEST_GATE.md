# قالوا الناس — Review-only candidate: host judging and playtest contract
Date: 2026-10-16
Status: **NO-GO**. Applies to `Survey_91_V1_Combined_Review_Only.csv`, NOT the imported 65-round runtime seed.

## What has changed
- The original 65 questions and IDs were preserved as review-only copies, except targeted scenario replacements at `survey-seed-23` (hotel check-in) and `survey-seed-49` (phone-holder problems).
- Of the 26 staged questions, 13 were substantively rewritten with new six-answer sets. The 2026-10-15 file is kept intact as historical evidence.
- The combined 91-round candidate has 13 categories × 7 rounds; 546 answer slots; 117 recorded **candidate** alternative phrasings; and exactly 100 authored game points per round. Original 93/99/105-point totals were rescaled using largest-remainder proportional rounding, with position order preserved. This is a **proposal**, not a hidden runtime/seed change.
- No new percentages, respondents, survey sample, or polling claims. The actual host/display/setup already show the edited-game-content disclaimer; preserve it.

## Host spoken-answer adjudication
The automatic matcher only does exact comparison after Arabic normalization. It does NOT infer broad synonyms, detect speech, or guarantee fair semantic matching. The human host is final judge. The 117 candidate aliases are for human editorial checking; review each in its **own question** alongside all six answer slots. Never accept a broad alias that maps to two concepts. Never map an already-revealed answer to another slot simply to award extra points.

| Candidate | Clearly acceptable example | Reject / do not auto-map | Reason |
|---|---|---|---|
| `survey-supplement-daily-02` | “تسكير الشبابيك” → إغلاق النوافذ | “نسيت غرض” | The revised prompt asks what is checked before leaving |
| `survey-supplement-family-01` | “مكعبات” → تركيب مكعبات | Generic “نلعب” when both a group game and several activities could fit | Avoid overlapping answer classes |
| `survey-supplement-food-02` | “ما ترتفع” → ما تنتفخ | “المقادير” | Distinct from the old recipe-preparation question |
| `survey-supplement-travel-01` | “تروح الحمام” → تدخل دورة المياه | “أشتري سماعة للرحلة” | This round is post-baggage airport activities, not packing |
| `survey-supplement-travel-02` | “تدور كرسيك” → تبحث عن رقم المقعد | “أفضل الممر” | This round is entry moments, not seat preferences |
| `survey-supplement-tech-01` | “الشاشة معلقة” → تجمّد الشاشة | Vague “الجوال فيه مشكلة” | Six independent fault descriptions should be identifiable |
| `survey-supplement-cars-01` | “ضغط الكفر” → ضغط الهواء | “الاستبنة” → no slot | Only characteristics of the inspected tyre |
| `survey-supplement-games-02` | “يصفقون” → تصفيق | “نوزع الفرق” | Now award ceremony, not pre-game organization |
| `survey-seed-23` | “كلمة سر النت” → كلمة مرور الواي فاي | “قريب من المحطة” | Now asks reception questions, not hotel-selection motives |
| `survey-seed-49` | “طيحة الجوال” → سقوط الجوال | “الملاحة” | Now asks malfunctions, not generic reasons to use a holder |
| `survey-supplement-light-02` | “ضحك جماعي” → ضحكة معدية | “وين جوالي؟” | Replaced earlier near-repeat of searching for a misplaced object |

## Real human playtest (not performed by this PR)
1. Prepare three separate five-round game sessions with two teams and a host, drawing across 13 categories; include at least two rewritten questions each session. Record the question IDs used.
2. Collect participants' *first spoken guesses* before showing the answer sheet. Log utterance, expected concept, host decision, any alternate phrase or ambiguous multiple-slot mapping.
3. Require no false-positive alias, no unresolvable overlapping slot, and no repeated core joke/task within one five-round session. Update/reject offending item instead of auto-passing.
4. Verify score totals, face-off, three strikes, steal, TV hidden-answer redaction, undo and rematch. Confirm all three views continue to disclose that weights are authored, not empirical polls.
5. Independently mark each of 91 ledger rows with named reviewer, date, alias decision, and playtest status. Do NOT fill blanks with invented names, dates or outcomes.

## Engineering evidence scope
`tests/survey-91-review-candidate.test.ts` validates the review CSVs and candidate matching in source. The Playwright baseline exercises the **existing imported 65 original rounds**, not the 91-candidate bank, because no candidate CSV import is authorized. A clean browser result cannot be cited as a candidate-bank playtest. Review/import mapping, isolated revised-bank seed, full revised bank browser behavior and owner approval are separate future gates.

**Do not merge, import, publish, deploy, change a live DB, enable billing or advance the next game on this evidence alone.**
