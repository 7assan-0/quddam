# Qalba Phase 4.4 — قالوا الناس

Survey Battle is implemented as an isolated, server-authoritative module on the hardened Phase 4.3 baseline. Category Board, Out of the Loop and Letter Network rules and their tests are preserved. No commit, push, deployment or Game #5.

## 1. Architecture

`src/lib/games/survey-battle` contains pure rules, Arabic matching/content validation, transactional commands, explicit Host/TV projections and tests. The module reuses authentication, ordered generic Team records, GameSession, credits, GameCommand receipts, stateVersion, ScoreEvent audit, DisplayAccess, QR, authorized SSE and analytics conventions.

The existing library entry `survey-show` now links to `/games/survey-show/new`; runtime routes are `/survey-show/host/[id]` and `/survey-show/display/[id]`. This reuses the placeholder's identity rather than adding a duplicate library card. Dedicated state has schemaVersion 1 and module discriminator `SURVEY_BATTLE`. The old Party service now verifies its own state slug before projecting or accepting commands/receipts. This is a routing boundary; its game rules are unchanged.

Account history routes dedicated Survey Battle sessions back to `/survey-show/host/[id]`, checking both the game slug and state discriminator. Other existing history URLs, including legacy Party Survey sessions, retain their prior routing. The five-round/rematch E2E also opens the account history, follows the link and verifies the restored authoritative phase/version.

Exactly two teams persist explicit positions: A/0/Coral, B/1/Turquoise. Names and order survive rematch. One credit is consumed on first START; rematches in the same session are free. Starting and snapshot selection commit atomically with billing and command receipt.

## 2. State machine

| Phase | Server-authorized progress |
| --- | --- |
| LOBBY | START validates two ordered teams and content, debits one credit, snapshots surveys → ROUND_INTRO |
| ROUND_INTRO | START_ROUND → FACE_OFF |
| FACE_OFF | One private recorded judgment per team; resolve control or reset tied/wrong guesses |
| TEAM_CONTROL | BEGIN_ANSWERING → ANSWERING |
| ANSWERING | Correct reveals/adds to pot; wrong adds a strike; third wrong → STEAL; fully revealed board permits AWARD_ROUND |
| STEAL | One correct or wrong judgment → ROUND_RESULTS and atomic award |
| ROUND_RESULTS | NEXT_ROUND clears board/pot/strikes/control, or enters FINAL_RESULTS after the last round |
| FINAL_RESULTS | COMPLETE → COMPLETED; Undo remains available before finalization |
| COMPLETED | REMATCH creates a new set, clean state and zero scores |
| PAUSED | RESUME restores saved phase and exact board/control/pot/history; judgment is rejected |
| ABANDONED | Terminal cancellation |

Host can pause/resume, Undo, manually end or abandon only in legal phases. Manual ending uses permanent scores already awarded; an unfinished pot is not awarded. Final equal scores produce an explicit tie, never a random winner.

## 3. Survey model

SurveyQuestion stores question, categoryId, difficulty, status, locale, sourceType and timestamps. SurveyAnswer stores answer, alternatives, positive integer points and contiguous position. SurveyQuestionUse stores an immutable JSON snapshot for each session/match/round, with question reference and timestamp.

Validation requires 3–12 answers, descending points, contiguous positions and globally unique normalized accepted texts within each question, including alternatives. It rejects overlapping alternatives, duplicate normalized primary answers, empty text and nonpositive points. The MVP supports `ar-SA` and `CURATED` content only. Aggregate totalSurveyPoints is exposed; totals need not be 100.

Server START selects the entire round set using crypto.randomInt. It never repeats a survey within that match and prefers content outside the same account's last 40 selected surveys. A finite-bank fallback can reuse older history, but never a current-match question. Content rows are locked and revalidated before snapshots, so concurrent admin edits cannot mix question/answer versions. Active and historical snapshots survive editing and archiving.

## 4. Round and scoring rules

Default server configuration is five multipliers `[1, 1, 2, 2, 3]`. Config lives on GameSession; UI reads round count, multiplier and calculated pots from the projection. It does not choose score amounts.

Face-off compares the points of both Host-confirmed answers. Only one correct answer gives that team control. Two valid different answers are revealed and added to the pot once each. Equal points—including both wrong or the same answer—reset the face-off without revealing those guesses. Host may explicitly reset a pending attempt.

Correct answers reveal one unused slot and increase rawPot while permanent scores stay unchanged. Three wrong answers automatically start the opponent's steal. Once every answer is revealed, Host awards the round to the control team. `finalPot = rawPot × multiplier`; the award happens exactly once.

Every award writes a ScoreEvent, including a zero pot. Command-scoped unique keys prevent duplicate audit entries. Undo and rematch score resets write compensating deltas; the stored Team score matches authoritative state.

## 5. Steal

Opponent gets one judgment. A valid unrevealed answer reveals that answer and awards the opponent the existing pot. Its own answer points are deliberately not added to the pot. A wrong answer awards the original control team the pot. Both outcomes enter ROUND_RESULTS. Revealed-answer steals, repeated resolutions and guesses outside STEAL are rejected.

## 6. Undo, pause and timing

Undo stores up to 60 pre-action snapshots of round, phase, selected use, face-off, revealed answers, strikes, control, pot, multipliers, scores and winners. It restores correct/wrong judgments, face-off resolution/reset, steal, round award, next-round transition and manual end. Undo of an awarded steal restores STEAL, the prior board and permanent scores, with an inverse ScoreEvent. Completed and abandoned sessions cannot be undone.

Rounds are intentionally untimed in this verbal, Host-judged MVP. No answer deadline is inferred from browser time. Pause forbids judgments and preserves exact state and Undo history; refresh restores that state. Existing games' hardened timers are unchanged.

## 7. Privacy, security and realtime

TVProjection is an allow-list: public phase, current question, aggregate total, numbered slots, revealed answer text/points, teams/scores, pot, strikes and result. A hidden slot contains only `slot` and `revealed:false`. No hidden answer IDs/text/alternatives/individual points, pending face-off choices, future surveys, raw state, history or command receipts reach TV JSON, SSE or HTML/RSC. HostProjection includes only the current immutable answer set required for judging, never the future set.

All mutations require authentication, ownership, same-origin requests, bounded JSON and strict Zod payloads. Browser fields cannot supply scores, control, multiplier, strikes or winner. Arabic matching trims/collapses whitespace, removes harmless diacritics/tatweel, normalizes common alifs and maqsura, and uses exact curated alternatives. It does not merge ة/ه, delete meaningful spaces or use fuzzy matching. Host confirms a selected answer or marks wrong; suggestions do not auto-award points.

Session row locks, expected stateVersion and payload-hashed receipts serialize competing commands. Same key/payload returns duplicate success without mutation; changed payload returns COMMAND_KEY_REUSED. Receipts are checked before stale-version denial. State, credit, score/audit and receipt commit in one transaction. SQL IDs are bound parameters.

Display tokens are random, hashed, scoped, expiring and revocable. Shared constants enforce three active links, six creations per ten minutes, six-hour TTL and completed-display grace. TV is read-only; old Party endpoints reject dedicated sessions before their receipts or phase logic.

SSE sends an authorized projection immediately, observes authoritative versions each second and emits heartbeats every ten seconds. Display authorization is rechecked during the stream. Event metadata includes GAME_STARTED, ROUND_STARTED, FACE_OFF_STARTED, CONTROL_CHANGED, ANSWER_REVEALED, STRIKE_ADDED, STEAL_STARTED/RESOLVED, ROUND_AWARDED, SCORE_CHANGED, GAME_PAUSED/RESUMED and GAME_COMPLETED. Healthy EventSource has no browser polling; a real stream failure enables a three-second fallback, stopped on recovery/access end. Commands refresh stale state without blindly retrying mutations.

Arabic/RTL layouts use established Qalba tokens, Coral/Turquoise borders plus A/B markers and active-team text. Answer reveal and point motion are restrained; strike feedback is 750 ms. Reduced motion disables these animations. Versioned `lastEvent` names such as STRIKE_ADDED and the `data-strikes`/`data-revealed` attributes provide optional feedback/sound integration hooks; no audio playback or assets are required or shipped. Numbered slots, labeled strike icons, live score/answer announcements and native controls provide accessible feedback. Five target sizes and long Arabic wrapping are verified in browser tests and screenshots.

## 8. Files changed

39 source/documentation files: 11 modified, 28 added; no removed files. Generated Next route typings are excluded from the implementation diff.

Modified:

- `README.md`
- `next.config.ts`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `scripts/e2e-warmup.ts`
- `scripts/e2e-with-db.mjs`
- `src/app/admin/page.tsx`
- `src/app/games/page.tsx`
- `src/app/profile/page.tsx`
- `src/lib/games/party/service.ts`
- `src/styles/components.css`

Added:

- `docs/PHASE-4.4.md`
- `prisma/migrations/20261003210000_survey_battle/migration.sql`
- `prisma/survey-questions.ts`
- `src/app/admin/survey-questions/page.tsx`
- `src/app/api/admin/survey-questions/[id]/route.ts`
- `src/app/api/admin/survey-questions/route.ts`
- `src/app/api/survey-show/[id]/commands/route.ts`
- `src/app/api/survey-show/[id]/display-access/route.ts`
- `src/app/api/survey-show/[id]/display/route.ts`
- `src/app/api/survey-show/[id]/events/route.ts`
- `src/app/api/survey-show/[id]/route.ts`
- `src/app/api/survey-show/route.ts`
- `src/app/games/survey-show/new/page.tsx`
- `src/app/survey-show/display/[id]/page.tsx`
- `src/app/survey-show/host/[id]/page.tsx`
- `src/components/survey-board.tsx`
- `src/components/survey-display.tsx`
- `src/components/survey-host.tsx`
- `src/components/survey-live.ts`
- `src/components/survey-question-manager.tsx`
- `src/components/survey-setup.tsx`
- `src/lib/games/survey-battle/isolation.test.ts`
- `src/lib/games/survey-battle/module.test.ts`
- `src/lib/games/survey-battle/module.ts`
- `src/lib/games/survey-battle/service.test.ts`
- `src/lib/games/survey-battle/service.ts`
- `src/lib/games/survey-battle/validation.ts`
- `tests/e2e/survey-battle.spec.ts`

Byte comparison with the Phase 4.3 archive confirmed 41 protected existing test/domain files unchanged. Design tokens, the three hardened game modules and their old tests were not edited. Shared integration changes are limited to the game/admin links, scoped presentation, survey schema/seed, privacy headers, E2E route warm-up and the legacy Party routing discriminator.

## 9. Database changes

One new migration: `20261003210000_survey_battle`; 12 forward migrations total. Added SurveyQuestion, SurveyAnswer and SurveyQuestionUse, plus relations from generic Category and GameSession. No Category Board-specific fields were added to the new bank.

Database constraints include positive bounded answer points, nonnegative position, unique question/position and unique session/match/round plus session/match/question. Indexes support published-bank filtering and recent-use history. Bank foreign keys preserve snapshot references; answer edits replace content in a transaction, while immutable use snapshots remain untouched. GameCommand, ScoreEvent, credits and DisplayAccess schemas are reused without changes.

## 10. Seed content

65 original curated questions, six answers each: 390 answers across 13 categories. Categories cover daily life, Saudi outings, family, food, travel, school/university, technology, games, sport, cars, work, occasions and light situations. Points are authored game weights, explicitly labeled as curated—not a scientific or population survey. Totals vary between 93, 99 and 105.

The seed adds 13 survey categories to the existing 27, for 40 categories total. It reuses the existing game library entry; 10 GameType rows remain. The existing 181 original questions are unchanged, with the 65 dedicated surveys added separately. Seed upserts do not overwrite later admin edits.

Admin `/admin/survey-questions` supports create/edit/archive, category/difficulty/status, answer points/order/alternatives, text search and category/status filters. Every answer payload is serialized using an explicit allow-list. CSV is deferred: the existing flat Category Board importer does not safely express the nested answer/weight/alternative invariants.

## 11. Added unit tests

58 new tests: 40 pure-domain/content tests, 16 service/privacy/concurrency tests and two shared routing isolation tests. The 109 existing unit tests remain unchanged.

Coverage includes complete/duplicate/alternative validation, safe Arabic normalization, all 65 seeded surveys, non-repetition, face-off winner/tie/both-wrong/private-pending serialization, correct reveal/duplicate rejection, strikes/steal, ×1/×2/×3 pot awards, duplicate award/audit, phase/control, Undo answer/strike/face-off/award/180-point steal/manual end, pause/resume, final ties, rematch, hidden-slot privacy, owner/token scope, command-key reuse and stale versions. Promise.all service cases cover correct/wrong, distinct reveals, third-strike/correct, duplicate reveal/award, competing steals and next-round double-click. PostgreSQL-compatible races are also exercised by E2E.

## 12. Added E2E tests

12 new Playwright cases in `tests/e2e/survey-battle.spec.ts`:

1. Setup, private face-off and multiple reveals synchronize Host and TV pot.
2. Three strikes and successful steal transfer the accumulated pot.
3. Failed steal awards control team; repeat is denied.
4. Five rounds award exact ×1/×2/×3 totals without repetition.
5. Undo successful steal restores score, board, strikes and phase.
6. TV JSON/SSE/HTML omit hidden answers and points; TV cannot issue commands.
7. Real concurrent reveals, correct/wrong and steals serialize; duplicate keys mutate once.
8. Full winner, completion and free rematch reset safely; account-history return restores the same match.
9. Admin create/edit/filter/archive, validation and immutable active snapshot.
10. Five viewports, long Arabic content, exact team colors, WCAG A/AA and reduced motion.
11. Face-off tie, pause, refresh and Undo preserve private state.
12. Duplicate Start/award/Complete, shared display limits, origin policy and legacy-route rejection.

All 42 existing browser tests remain unchanged. UI tests wait for hydration and authoritative state/DOM conditions; old tests and timeouts were not weakened, skipped or removed.

## 13. Executed quality gates and diagnosis

| Command | Exit code | Exact final result | Wall seconds |
| --- | ---: | --- | ---: |
| `npm run lint` | 0 | Passed; no ESLint findings | 6.583 |
| `npm run typecheck` | 0 | Passed | 2.446 |
| `npm run test` | 0 | 167 passed / 0 failed; 21 files | 1.592 |
| `npm run build` | 0 | Passed; 29/29 static pages generated | 6.333 |
| `npm run test:e2e:db` | 0 | 54 passed / 0 failed / 0 skipped / 0 flaky | 649.473 |

Unit total: 109 existing + 58 new = 167. Browser total: 42 existing + 12 new = 54. The full DB command finished with exit 0 in 649.473 seconds. All 54 native case results contain one passed attempt, retry 0 and no errors. There are 22 native execution reports across 11 spec files: ten old specs and twelve isolated new cases. No implementation-file hash changed during the final run; all 41 protected old test/domain files remain byte-identical. OOM-kill counter stayed 2 → 2 during this run; no additional memory kill.

Final per-spec results:

| Spec | Passed | Failed | Skipped | Flaky |
| --- | ---: | ---: | ---: | ---: |
| `board-hardening.spec.ts` | 7 | 0 | 0 | 0 |
| `category-board.spec.ts` | 1 | 0 | 0 | 0 |
| `checkout.spec.ts` | 1 | 0 | 0 | 0 |
| `design-accessibility.spec.ts` | 2 | 0 | 0 | 0 |
| `foundation.spec.ts` | 5 | 0 | 0 | 0 |
| `letter-network.spec.ts` | 11 | 0 | 0 | 0 |
| `party.spec.ts` | 2 | 0 | 0 | 0 |
| `rooms.spec.ts` | 1 | 0 | 0 | 0 |
| `security-analytics.spec.ts` | 1 | 0 | 0 | 0 |
| `social-deduction.spec.ts` | 11 | 0 | 0 | 0 |
| `survey-battle.spec.ts` | 12 | 0 | 0 | 0 |

Evidence: `final-quality-gates.json`, `final-full-exit.json`, `final-full-json/summary.json`, all 22 native reports and `final-audit.json` in the evidence archive. The audit checks unique test IDs, single attempts, source hashes, old-file comparison and migration count. No test was retried in the final run.


The DB browser runner migrates/seeds an isolated PostgreSQL-compatible PGlite socket and validates a production build. Old specs retain their fresh one-worker development server per spec. Survey Battle uses Playwright's own discovery and exact file/line filters to give each of its 12 cases a fresh server, with only that case's required routes warmed up. Each discovered case executes once; the runner checks the selected case ID and cardinality. No automatic retry, test timeout change, assertion change or skipped case. Native JSON is kept for every invocation, with a per-spec aggregation and observed runner exit. HTTP-loopback fixtures retain existing development cookie behavior; production Secure-cookie policy is unchanged. Redirected stdout can stop updating before completion in this environment.

Failures and fixes:

- Initial focused attempt: zero tests executed because Next could not read existing Turbopack persistence (`Loading persistence directory failed: invalid digit found in string`). Cache inventory contained orphan temporary SST files; quarantining/regenerating the cache restored startup. The exact corrupt file was not proved.
- Focused 12-case run: 8 passed, 4 failed. The admin edit case could not return to the “إضافة سؤال” heading within 5 seconds. Network trace proved PATCH 400 with `Unrecognized keys: "id", "surveyQuestionId"`. An individual traced run reproduced it. Fix: explicit answer input fields instead of spreading returned database rows. API strict validation stayed intact. The same individual test then passed.
- The following responsive, pause and policy cases timed out after 60 seconds opening `/register`. Their original traces show no completed navigation response after the worker restart. The original cascade's root cause is not proved. Pause and policy passed independently with traces. Responsive independently reached a real reduced-motion failure: expected animationName `none`, received `survey-reveal`. Fix: match the reveal selector's CSS specificity in the reduced-motion rule. Assertions stayed intact; it then passed, including WCAG and all five viewports.
- Visual QA found team border color was overridden by a more specific border shorthand. Game-scoped selectors now win; the responsive test additionally checks the actual Coral/Turquoise RGB values. The individual traced case passed again with refreshed screenshots.
- A pre-final full run was canceled to finish the legacy/dedicated routing boundary found during review. It is preserved separately and is not a completed quality-gate result. One premature isolated attempt could not reach its temporary DB; another could not start while the old dev server was still running. Both executed zero tests. Execution was serialized after the cancellation.
- The isolated routing case then reproduced legacy GET 500 where 404 was required. Source review also found the generic END branch precedes module dispatch. Fix: require PartyState.slug to match the persisted game slug before projection, receipt handling or commands. This preserves old Party rules and prevents dedicated-session transitions through that API. The case then passed with legacy GET/END 404 and unchanged stateVersion.
- The first completed full run finished with 53 passed / 1 failed / 0 skipped / 0 flaky; all 42 existing cases passed. The only failure was `Survey Battle: duplicate Start award Complete; display and origin policies are enforced`: `apiRequestContext.get: socket hang up` on `GET /api/games/party/sessions/:id`, test line 70, after 4,902 ms. The cgroup OOM-kill counter rose from 0 to 1 during that run (8 GiB limit). This verifies memory exhaustion during the run; the exact killed process was not identified. The failure coincided with first compilation of a legacy handler used by the isolation assertion late in the survey spec.
- That exact case passed in an individual traced run without a code change. The harness fix adds read-only warm-up requests for the two legacy handlers actually used by this spec, before browser activity. It uses the established route-scoped warm-up and memory-eviction behavior; no test wait, timeout or assertion changed. The same individual traced case passed again after the warm-up change (21,676.467 ms, exit 0). The complete 53/1 report is retained under `prewarm-full-json`, alongside the OOM evidence and both individual traces.
- The one full rerun after that warm-up change finished 45 passed / 9 failed / 0 skipped / 0 flaky (547.567 seconds, exit 1). Again, all 42 old cases passed. The multiplier case failed first with `apiRequestContext.post: socket hang up`; all eight following cases failed at `/register` with `net::ERR_CONNECTION_REFUSED`. The OOM-kill counter rose from 1 to 2. Thus adding more eager compilation did not fix the runner's resource limit.
- All nine failures were then run individually with traces and one-second cgroup/process RSS samples. Eight passed. The full-match/rematch case hit the unchanged 60-second test timeout while a POST remained pending (`Target page, context or browser has been closed` during timeout cleanup). Its Next development server reached 7,151,044 KiB RSS; the cgroup stayed near the 8 GiB cap with heavy memory-pressure events. No additional OOM kill occurred in these individual attempts. Database-process peaks stayed below 1 GiB. This localizes the resource pressure to the development server/compiler, rather than a failed gameplay assertion; no JavaScript heap snapshot was taken.
- Final harness fix: normal Survey gameplay warms only Survey handlers; admin and legacy-isolation handlers are warmed only in their respective cases. The DB runner gives each newly added Survey case a fresh development server, using native Playwright discovery/location filters and verifying exactly one matching case ID. Old specs retain their established behavior. Race requests within a case still share the same server and database; refresh, rematch and admin snapshot checks still occur within one uninterrupted scenario. Production settings and game rules are unchanged by this harness fix.
- In the previously timed-out full-match/rematch case, this scoped warm-up reduced Next-server peak RSS from 7,151,044 KiB to 1,467,604 KiB; the individual traced command finished with exit 0 in 30.042 seconds, including DB setup and build. The remaining exact failures were also rechecked individually after the fix; their native reports, traces and memory measurements are retained under `isolated-after-memory`.
- A subsequent full run was canceled early (exit 130; five old-spec reports completed) before modifying source, after review found the new game's account-history link still led to the legacy `/play/:id` route. That route correctly rejects the dedicated state. The Profile link now checks the Survey slug/discriminator and uses its Host URL. A stronger assertion was added to the new full-match/rematch test; no old test was changed. `/profile` is warmed only for that scenario.
- After those targeted checks, the full suite was run once on a frozen final candidate. No implementation changes occurred during it. The canceled run and all failed/individual reports are preserved separately; incomplete or failing attempts are not claimed as quality-gate passes.

Exact failing titles from the 45/9 run (each begins with `Survey Battle:`):

| Title after prefix | Error in that full run |
| --- | --- |
| multipliers ×2 and ×3 award exact scores across five rounds | apiRequestContext.post: socket hang up |
| Undo successful steal restores scores, board, strikes and phase | page.goto: net::ERR_CONNECTION_REFUSED at /register |
| TV JSON, SSE and rendered HTML never contain hidden answers or points | same connection-refused error |
| real concurrent reveal, correct/wrong and steal requests serialize | same connection-refused error |
| full five-round winner, completion and free rematch are clean | same connection-refused error |
| admin creates edits filters archives; active snapshots remain immutable | same connection-refused error |
| responsive accessible board at five target sizes and reduced motion | same connection-refused error |
| face-off tie, pause, refresh and Undo preserve private state | same connection-refused error |
| duplicate Start award Complete; display and origin policies are enforced | same connection-refused error |

Exact gate commands:

```sh
npm run lint
npm run typecheck
npm run test
npm run build
E2E_REPORT_DIR=/workspace/scratch/9a82f66bf5de/diagnostics44/final-full-json npm run test:e2e:db
```

Focused run used `E2E_WARMUP_GROUP=survey npm run test:e2e:db -- tests/e2e/survey-battle.spec.ts --trace on`, with explicit JSON report and trace output paths. Individual traced runs used the same command plus one of these exact grep filters:

```text
Survey Battle: admin creates edits filters archives; active snapshots remain immutable$
Survey Battle: responsive accessible board at five target sizes and reduced motion$
Survey Battle: face-off tie, pause, refresh and Undo preserve private state$
Survey Battle: duplicate Start award Complete; display and origin policies are enforced$
```

All nine after-memory-fix individual commands (exit 0; tracing enabled):

```sh
E2E_WARMUP_GROUP=survey E2E_REPORT_FILE=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case01.json npm run test:e2e:db -- tests/e2e/survey-battle.spec.ts --grep 'Survey\ Battle:\ full\ five\-round\ winner,\ completion\ and\ free\ rematch\ are\ clean$' --trace on --output=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case01
E2E_WARMUP_GROUP=survey E2E_REPORT_FILE=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case02.json npm run test:e2e:db -- tests/e2e/survey-battle.spec.ts --grep 'Survey\ Battle:\ multipliers\ ×2\ and\ ×3\ award\ exact\ scores\ across\ five\ rounds$' --trace on --output=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case02
E2E_WARMUP_GROUP=survey E2E_REPORT_FILE=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case03.json npm run test:e2e:db -- tests/e2e/survey-battle.spec.ts --grep 'Survey\ Battle:\ Undo\ successful\ steal\ restores\ scores,\ board,\ strikes\ and\ phase$' --trace on --output=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case03
E2E_WARMUP_GROUP=survey E2E_REPORT_FILE=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case04.json npm run test:e2e:db -- tests/e2e/survey-battle.spec.ts --grep 'Survey\ Battle:\ TV\ JSON,\ SSE\ and\ rendered\ HTML\ never\ contain\ hidden\ answers\ or\ points$' --trace on --output=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case04
E2E_WARMUP_GROUP=survey E2E_REPORT_FILE=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case05.json npm run test:e2e:db -- tests/e2e/survey-battle.spec.ts --grep 'Survey\ Battle:\ real\ concurrent\ reveal,\ correct/wrong\ and\ steal\ requests\ serialize$' --trace on --output=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case05
E2E_WARMUP_GROUP=survey-admin E2E_REPORT_FILE=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case06.json npm run test:e2e:db -- tests/e2e/survey-battle.spec.ts --grep 'Survey\ Battle:\ admin\ creates\ edits\ filters\ archives;\ active\ snapshots\ remain\ immutable$' --trace on --output=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case06
E2E_WARMUP_GROUP=survey E2E_REPORT_FILE=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case07.json npm run test:e2e:db -- tests/e2e/survey-battle.spec.ts --grep 'Survey\ Battle:\ responsive\ accessible\ board\ at\ five\ target\ sizes\ and\ reduced\ motion$' --trace on --output=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case07
E2E_WARMUP_GROUP=survey E2E_REPORT_FILE=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case08.json npm run test:e2e:db -- tests/e2e/survey-battle.spec.ts --grep 'Survey\ Battle:\ face\-off\ tie,\ pause,\ refresh\ and\ Undo\ preserve\ private\ state$' --trace on --output=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case08
E2E_WARMUP_GROUP=survey-policy E2E_REPORT_FILE=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case09.json npm run test:e2e:db -- tests/e2e/survey-battle.spec.ts --grep 'Survey\ Battle:\ duplicate\ Start\ award\ Complete;\ display\ and\ origin\ policies\ are\ enforced$' --trace on --output=/workspace/scratch/9a82f66bf5de/diagnostics44/isolated-after-memory/case09
```

The account-history follow-up used `E2E_WARMUP_GROUP=survey-history E2E_REPORT_FILE=/workspace/scratch/9a82f66bf5de/diagnostics44/history-after.json npm run test:e2e:db -- tests/e2e/survey-battle.spec.ts --grep 'Survey Battle: full five-round winner, completion and free rematch are clean$' --trace on --output=/workspace/scratch/9a82f66bf5de/diagnostics44/history-after` (exit 0; 29.047 seconds including setup/build).

Additional executed commands: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qalba npm run db:generate`; `npx vitest run src/lib/games/survey-battle/module.test.ts` (40 passed); `npx vitest run src/lib/games/survey-battle` (55 passed before the three isolation tests were added). Individual reports and traces retain before/after outcomes. The evidence ZIP includes native JSON, logs, cache startup evidence and five viewport screenshots.

## 14. Known limitations

- Exactly two teams; guesses are spoken and finally confirmed by the authenticated Host. No team phone controllers or automatic free-text judgment.
- Untimed rounds, fixed default five-round setup, no timer/settings UI. Multipliers are server configuration; pause preserves the untimed state.
- Curated game weights, not real survey research. Finite 65-question bank; recent-account avoidance is best effort once content is exhausted.
- Undo is bounded to 60 actions and ends at final completion/cancellation.
- No CSV/bulk import, optional audio assets or separate deadline scheduler in this MVP.
- Browser DB tests use PGlite, not a provisioned production PostgreSQL deployment. HTTPS hosting and real TV casting were not exercised.

Phase 4.4 only. No commit or push. Game #5 was not started.
