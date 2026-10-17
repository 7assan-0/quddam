# قالوا الناس — 91-round acceptance continuation, 2026-10-17

**Status: REVIEW ONLY / NO-GO; no candidate imported into the runtime or live database.**
This follow-up stacks on PR #15 exact head `fdbc576ee596918ec5ab9418bcada12caad42f18`.
Its source of truth is still `Survey_91_V1_Combined_Review_Only.csv` and the 91-item pending ledger. The previous structural checks succeeded, but the original-65 Chromium job in [run #38847634265](https://github.com/7assan-0/quddam/actions/runs/38847634265) **did not pass**: runner received an external shutdown signal and returned exit 143 after its production build; there is no evidence the candidate 91 was browser-tested. We independently re-run baseline in owner-gated CI, without changing/pretending to import the review CSV.

## Triage for actual human editorial review

These are **concrete review candidates**, not automated factual findings or sign-offs:

| Stable ID | Issue to resolve with a reviewer | Safe acceptance question |
| --- | --- | --- |
| `survey-seed-26` | The answer buckets “قلم إضافي” and “رصاص” may both be claimed for a spoken “قلم رصاص”. | Is the intended second answer a distinct “قلم رصاص” or “رصاص” without a pen? Decide a unique concept per slot and explicitly reject ambiguous spoken guesses. |
| `survey-seed-58` / `survey-supplement-occasions-01` | “Before sending an invitation” and “before a graduation ceremony” substantially overlap on date, time, venue, invitations and location. | Can ordinary players distinguish the scenarios? If not, rewrite the supplement or keep the pair out of the same match. |
| `survey-seed-61` / `survey-seed-65` | Lost-object comedy overlaps: remote/control and other small objects recur in the same light category. | Preserve genuinely different prompts, or apply per-session near-theme spacing to avoid a repetitive five-round experience. |
| `survey-seed-49` | Shaking and falling are related but distinct phone-holder failure slots. | Test real utterances and rule whether vague “الجوال مو ثابت” can safely match only one answer. |
| `survey-supplement-tech-01` | Six different failure modes of a phone can sound similar in casual speech. | Check whether generic “الجوال معلق” collides with frozen screen vs disabled touch. |

Human review must record the specific item, original spoken guess, chosen answer/alias, reject/pass rationale, reviewer and date in the existing ledger. These suggestions are intentionally **not marked approved** and do not revise any original or supplement candidate without item-level decision.

## Acceptance gates

1. Deterministic 91-item candidate test: 65 retained IDs +26 supplemental IDs, 13×7, 546 answer slots, 117 candidate aliases, authored 100 points per round, zero normalized collisions; preserve the player-facing *not a real survey* disclaimer and all ledger statuses pending until actually reviewed.
2. Re-run actual Chromium **original 65 seed only** once, on isolated disposable PGlite with retries=0; exit 143 or missing JSON is a failure, never inherited PASS.
3. Independently review every 91 question/answer set, six slot distinctions and each proposed alias, including the cases above; conduct actual group spoken-answer playtesting.
4. Only after owner approval: separately design an isolated **candidate-bank** import/migration and validate it in a fresh synthetic DB, with snapshot/ID compatibility and original data untouched. Do not deploy, merge or start the next game's content from a green structural check alone.
