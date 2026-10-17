# قالوا الناس — isolated baseline diagnostic, 17 October 2026

**REVIEW ONLY / NO-GO.** This does not import or approve the 91 candidate rows.

The original PR #22 run #38997498357 and its manually retried original-seed-browser job both ended after build when GitHub reported a runner shutdown, exit 143. Neither produced a passing one-case Chromium report. Structural review-only checks passed independently. The failures must remain failures, not inherited successes.

Targeted E2E test: `Survey Battle: full five-round winner, completion and free rematch are clean`, on the unchanged runtime-seeded original 65 only. The shared `e2e-warmup.ts` has a documented `survey-history` route group containing login/register, survey host/display/API, and `/profile`; the prior filtered CI supplied no `E2E_WARMUP_GROUP` and therefore invoked the default warm-up across every game group. This branch restricts warm-up to the case's required routes and enables `pw:webserver` diagnostics, without changing the production game code, match assertions, exact-head source guard, retry=0, web-server timeout, database seeding or native report acceptance predicate. This is a diagnosis and potential runner-load fix, not a claimed root cause until a clean run finishes.

Remaining editorial issues are independently recorded in PR #22: `survey-seed-26` pencil vs lead, `survey-seed-58` vs `survey-supplement-occasions-01` near-theme overlap, `survey-seed-61` vs `survey-seed-65` lost-item repetition, `survey-seed-49` shake vs fall, and `survey-supplement-tech-01` generic phone-hang ambiguity. Keep the 91-item review ledger, 117 aliases and all human sign-offs pending; no automated editorial PASS, candidate import, production source edit, merge or deploy.

Acceptance: independently successful original-65 one-test Chromium report, no skips/flakes/retries, original source SHA bound; then real item-by-item editorial and group spoken-answer playtest; only later an owner-approved isolated revised-91 seed/browser proof. No external beta/release authorization.
