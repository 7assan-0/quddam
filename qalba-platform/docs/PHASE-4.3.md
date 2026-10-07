# Phase 4.3 — شبكة الحروف

## 1. Architecture

Isolated module: src/lib/games/letter-network, slug letter-network. This is distinct from the old party-engine letter-battle slug. No Category Board or Out of the Loop rule, endpoint, component or existing test is changed.

Reuses authentication, credit wallet, generic GameSession, explicitly ordered Team, transactional GameCommand, hashed/revocable DisplayAccess, analytics allow-lists and SSE conventions. State schema v1 is persisted in session JSON. Content is a dedicated bank.

Exactly two teams: position 0/A/Coral and position 1/B/Turquoise. Order is never inferred alphabetically. One credit is charged on first START; REMATCH is free in the same session, consistent with the social-game session policy. Duplicate START cannot debit twice.

The shared Prisma helper now reuses one bounded client/pool per process in production as well as development. This prevents separate pools for each call/SSE tick without changing authentication, billing or rules.

## 2. Board topology

25 cells: five rows by five columns, pointy hexes with odd rows offset right. Interior cells have six symmetric neighbors. Adjacent-row column offsets are [-1,0] for even rows and [0,1] for odd rows, plus same-row left/right neighbors.

The board is a local LTR coordinate surface inside Arabic RTL. A connects geometric column 0 to 4; B connects row 0 to 4. Accessible labels identify physical coordinates, letter and ownership. Captures show أ/ب in addition to color.

Generation uses crypto.randomInt and configurable frequency weights. A letter needs at least eight valid published questions; at least five letters must qualify. Frequency cannot exceed its question count. The seed provides 100 original questions: ten each for ا ب ج د ر س ك م ن و, spanning general knowledge, Saudi Arabia, geography, history, science, sport, technology, games, food, travel and film/TV. Other weighted letters remain unavailable until content is sufficient.

## 3. Win-path algorithm

Pure multi-source BFS visits only cells owned by the relevant team, starting at its entry edge. The first reached exit returns a connected path through parent pointers. The server stores its IDs; Host and TV highlight those exact cells. Disconnected corners, square-only diagonals, enemy cells and missing cells cannot win.

## 4. State machine and chosen rules

| Phase | Legal progress |
| --- | --- |
| LOBBY | START validates teams/content and charges credit → READY |
| READY | SELECT_CELL chooses unused published question and snapshot → CELL_SELECTED |
| CELL_SELECTED | OPEN_QUESTION → QUESTION_ACTIVE, 30-second deadline |
| QUESTION_ACTIVE | CORRECT captures/next turn or RESULTS; WRONG/expiry → STEAL |
| STEAL | Opponent gets 15 seconds; correct captures, wrong/expiry returns cell to AVAILABLE |
| PAUSED | Saves prior phase, cell, question, team, history and remaining timer; RESUME restores |
| RESULTS | UNDO reopens judged move; COMPLETE → COMPLETED |
| COMPLETED | REMATCH → new READY board, same team IDs/names/order |
| ABANDONED | Terminal Host cancellation |

After both teams fail, the question is consumed, but the cell remains available. Next selection chooses a different unused question. Normal starting-team order alternates after each resolved cell, regardless of which team captured a steal.

Host can select/open, privately reveal for judging, judge correct/wrong/steal, pause/resume, Undo, manually end without a winner, complete, cancel and rematch. Invalid controls are absent and invalid commands are rejected server-side.

## 5. Changed files

New domain:
- src/lib/games/letter-network/module.ts
- src/lib/games/letter-network/questions.ts
- src/lib/games/letter-network/service.ts
- src/lib/games/letter-network/validation.ts
- src/lib/games/letter-network/module.test.ts
- src/lib/games/letter-network/service.test.ts

New pages and APIs:
- src/app/games/letter-network/new/page.tsx
- src/app/letter-network/host/[id]/page.tsx
- src/app/letter-network/display/[id]/page.tsx
- src/app/api/letter-network/route.ts
- src/app/api/letter-network/[id]/route.ts
- src/app/api/letter-network/[id]/commands/route.ts
- src/app/api/letter-network/[id]/display/route.ts
- src/app/api/letter-network/[id]/display-access/route.ts
- src/app/api/letter-network/[id]/events/route.ts
- src/app/admin/letter-questions/page.tsx
- src/app/api/admin/letter-questions/route.ts
- src/app/api/admin/letter-questions/[id]/route.ts

New components/content/test infrastructure:
- src/components/letter-setup.tsx
- src/components/letter-live.ts
- src/components/letter-board.tsx
- src/components/letter-host.tsx
- src/components/letter-display.tsx
- src/components/letter-question-manager.tsx
- prisma/letter-questions.ts
- prisma/migrations/20260930190000_letter_network/migration.sql
- src/lib/db.test.ts
- tests/e2e/letter-network.spec.ts
- scripts/e2e-warmup.ts
- docs/PHASE-4.3.md

Updated:
- prisma/schema.prisma; prisma/seed.ts
- src/app/games/page.tsx; src/app/admin/page.tsx
- src/styles/components.css (Letter Network scoped additions; design tokens unchanged)
- src/lib/db.ts (bounded client reuse)
- playwright.config.ts; scripts/e2e-with-db.mjs
- next.config.ts (new display privacy headers and E2E-only compiler memory eviction)
- README.md

## 6. Database

One new migration: 20260930190000_letter_network; eleven total forward migrations.

LetterQuestion stores letter, question, answer/alternatives, difficulty, category, status and timestamps. Indexed by letter/status and category/difficulty.

LetterQuestionUse stores session/match/cell identifiers and immutable question, answer and alternative snapshots. Indexed by session/match and question/time. Added relations on generic Category and GameSession only.

Selection never repeats within a match and prefers candidates outside the same host account's last 80 uses. Fallback is only to current-match-unused questions. Rematch retries generation to avoid the exact prior letter sequence and clears ownership, history, answer fields, result and path.

Admin create/edit/archive, difficulty/category, alternatives, search and letter filtering are at /admin/letter-questions. Bank edits cannot change active/historical snapshots. CSV is deferred because the existing importer is Category Board-specific.

## 7. Privacy and security

Authenticated owner required for Host pages and every command; ADMIN required for content management. Same-origin mutation checks, bounded JSON and strict Zod payloads reject client ownership, answers, paths, turn and timer fields.

TV is read-only and tokens are scope-checked on every projection/revalidation. Tokens are cryptographically generated, hashed at rest, expiring and revocable. Shared policy constants enforce three active links, six creations per ten minutes, six-hour TTL and thirty-minute completed grace.

Explicit allow-list projections never expose stored state/history, unused questions or bank answers. Host receives an answer only after REVEAL_ANSWER. TV never gets an active answer/alternatives, including during pause/steal and after private Host reveal. A resolved previous answer is public, but the next selection clears it. JSON, SSE and RSC/HTML privacy are browser-tested.

Admin validates every normalized accepted answer begins with its configured letter. Normalization trims/collapses whitespace, removes harmless diacritics/tatweel, normalizes common alifs and alif-maqsura. It does not merge ة/ه, remove internal spaces or accept approximate answers. Verbal correctness remains a Host judgment.

## 8. Timer and realtime

Initial answer: 30 seconds; steal: 15 seconds. Deadlines are server timestamps. Client countdown uses the returned server-time offset. Late judgment and early expiry are rejected.

Pause saves exact remaining milliseconds and removes the running deadline; resume rebases that remainder from server time. Refresh restores authorized question/cell/team/state/timer.

SSE sends authorized state immediately, checks versions every second and sends ten-second heartbeats. Timer reads/SSE resolve deadlines transactionally. A long disconnection can expire both windows based on the original deadlines, not grant extra time on reconnect. With no viewers, no scheduler is running; the next authorized read resolves overdue state before returning it.

Healthy SSE causes no client polling. Only stream failure enables a three-second fallback, stopped on reconnect. lastEvent carries GAME_STARTED, CELL_SELECTED, QUESTION_OPENED, TIMER_STARTED, ANSWER_REVEALED, ANSWER_CORRECT/WRONG, STEAL_STARTED, CELL_CAPTURED, TURN_CHANGED, GAME_PAUSED/RESUMED, WIN_PATH_COMPLETED and GAME_COMPLETED as appropriate, without secret answers.

## 9. Undo

Each judgment stores a bounded pre-action snapshot including remaining server time, cell/question-use reference, ownership, turn, phase, winner/path and history position. Undo restores it and rebases running time.

Winning capture Undo removes winner/path and reopens the original question. Wrong/steal Undo restore their preceding phase. Undo of automatic expiry grants the appropriate full answer window instead of restoring an expired deadline. Manual ending is also undoable, including from pause.

## 10. Concurrency

A session row lock serializes mutations. Ownership, command receipt, expected stateVersion, phase and payload are validated before committing state and receipt in one transaction. A conditional version update adds another guard.

Same-key/same-payload retries return duplicate=true without mutation; changed payload reuse is rejected. Concurrent different selections and correct/wrong races permit exactly one legal commit.

## 11. Added tests

43 game unit tests plus two bounded-database-pool tests. Cover weighted board/content eligibility, Arabic initials, physical neighbors, direct/winding paths for both teams, false positives, selection/capture/steal, turn order, expiry, pause/resume, Undo including victory, rematch, projections, question history and strict payloads.

11 new Playwright scenarios:
1. Create/setup/capture synchronized Host and TV.
2. Wrong → opposing steal → opponent capture.
3. Full Team A path → highlighted victory → Undo → clean rematch.
4. Pause/refresh/resume for answer and steal; reuse failed cell with a new question.
5. JSON/SSE/HTML answer privacy and read-only TV.
6. Real Promise.all concurrent selections, duplicate capture and correct/wrong race.
7. Duplicate Start/Complete and changed-key-payload rejection.
8. Host disconnection, late judgment denial and both deadlines expiring exactly once.
9. Display scope/active limit/revocation, ownership and cross-origin denial.
10. Admin validation/search/archive and active snapshot integrity.
11. 390×844, 768×1024, 1440×900, 1920×1080 and 3840×2160 layouts and accessible ownership markers.

Existing tests remain unchanged.

## 12. Quality-gate results

Final verification on 2026-10-03:

| Command | Exact result |
| --- | --- |
| npm run lint | Passed, exit 0 |
| npm run typecheck | Passed, exit 0 |
| npm run test | 109 passed in 18 files, exit 0; 64 existing tests, 43 game tests, 2 database-pool tests |
| DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qalba npm run build | Passed, exit 0; compiled in 1756 ms; generation 27/27 |
| E2E_REPORT_DIR=/workspace/scratch/9a82f66bf5de/diagnostics/full-json npm run test:e2e:db | Passed, exit 0; 42 passed across 10 specs; 0 failed, 0 skipped, 0 flaky. Run exactly once after the three individual traced cases and fixes. |

The full browser run includes all 31 existing cases and all 11 new cases. Native Playwright JSON reports and summary.json contain every result, with no result errors. Sum of spec durations: 504.149473 seconds. All eleven migrations were applied to the isolated database, including the one new letter_network migration. Seeding reported 27 categories, 10 game types and 181 original questions (100 in the new letter bank).

| E2E spec | Passed | Failed/skipped/flaky |
| --- | --- | --- |
| board-hardening.spec.ts | 7 | 0/0/0 |
| category-board.spec.ts | 1 | 0/0/0 |
| checkout.spec.ts | 1 | 0/0/0 |
| design-accessibility.spec.ts | 2 | 0/0/0 |
| foundation.spec.ts | 5 | 0/0/0 |
| letter-network.spec.ts | 11 | 0/0/0 |
| party.spec.ts | 2 | 0/0/0 |
| rooms.spec.ts | 1 | 0/0/0 |
| security-analytics.spec.ts | 1 | 0/0/0 |
| social-deduction.spec.ts | 11 | 0/0/0 |

The database E2E runner migrates/seeds an isolated PostgreSQL-compatible PGlite socket, builds production, then exercises the existing HTTP-loopback development fixtures with Turbopack. Each discovered spec runs once against a fresh one-worker server, with read-only route warm-up scoped to that game. Per-spec JSON reports provide exact aggregate totals; failed specs are never retried. E2E-only full compiler-cache eviction addresses development-server memory pressure. Production authentication and Secure-cookie policy remain unchanged.

Individual traced runs on the recovered saved checkpoint:

| Exact test title | Current error | Result |
| --- | --- | --- |
| Letter Network: setup and correct capture synchronize Host and read-only TV | None; game commands, projections and SSE return 200 | 1 passed; test 5.9 s, run 23.9 s |
| Letter Network: actual Team A path wins, Undo reopens winning move, rematch is clean | None; winning path, Undo and rematch assertions pass | 1 passed; test 9.6 s |
| Letter Network: admin validates starts, updates snapshots safely, filters and archives | None; 400 invalid-answer and 403 non-admin denials are expected assertions | 1 passed; test 7.1 s, run 24.4 s |

The original error files disappeared when the previous execution environment went offline. These are the last recorded three-case group, not a claim that three failures remain now. Current traces do not reproduce the old failures, so their original root cause cannot be proved from those traces. The saved code already gates Host controls until hydration, refreshes Host state before Undo, and waits for authenticated navigation before admin navigation. Those changes address the previously recorded lost-click, stale-Host and aborted-navigation symptoms.

An independent runner issue is evidenced by memory measurements: during an individual traced run the Next development server used 3,801,964 KiB RSS and the whole runner used 5,813,211,136 bytes. Broad warm-up unnecessarily loaded unrelated game compiler graphs. Scoped warm-up, fresh spec servers and E2E-only full memory eviction address this pressure. No application rule is changed. API reads now assert status/content type, and geometry checks first assert visible cells and non-null bounds. Original ownership, privacy, path and time assertions and their timeouts remain intact.

Chromium actions retain the checkpoint's existing 100 ms pacing; it was not increased during this diagnosis. Promise.all HTTP races are unaffected. Current final kernel counters show zero OOM and zero OOM kills. No old test was deleted, edited, weakened or skipped.

Exact individually traced commands (each executes one case):

```sh
npm run test:e2e:db -- tests/e2e/letter-network.spec.ts --grep 'Letter Network: setup and correct capture synchronize Host and read-only TV$' --trace on --output=/workspace/scratch/9a82f66bf5de/diagnostics/capture
npm run test:e2e:db -- tests/e2e/letter-network.spec.ts --grep 'Letter Network: actual Team A path wins, Undo reopens winning move, rematch is clean$' --trace on --output=/workspace/scratch/9a82f66bf5de/diagnostics/win-undo
npm run test:e2e:db -- tests/e2e/letter-network.spec.ts --grep 'Letter Network: admin validates starts, updates snapshots safely, filters and archives$' --trace on --output=/workspace/scratch/9a82f66bf5de/diagnostics/admin
```

Their stdout/stderr logs and trace.zip files are included in Qalba-Phase-4.3-Traces.zip, alongside the final native JSON reports and build log. Full-run stdout capture stopped updating before the last spec; native JSON reports plus the observed runner exit 0 are the authoritative complete evidence.

Other commands executed during this recovery: npm ci (606 packages installed); DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qalba npm run db:generate (Prisma 7.10.0 generated); npx playwright install chromium (Chromium 1194/headless shell and FFmpeg installed). A first grep with a leading ^ returned No tests found because Playwright matches the full title including its file prefix; it executed no test and was corrected before the single-case run. The first browser download mirror returned a truncated ZIP; Playwright's fallback mirror completed installation. No full-suite retry followed the final successful run.

## 13. Known limitations

- Two teams, Host-only selection/judgment; no private team controllers or automatic free-text judging.
- Finite 100-question starter bank. Exhausted current-match letters are rejected rather than repeat a question; add content, choose another letter or end the match.
- Recent-history and exact-board avoidance are best effort with a finite bank.
- Undo is bounded to 25 judged moves. Finalized COMPLETED sessions cannot be undone; Undo remains available in RESULTS.
- No CSV, extra teams, alternate topology or timer-settings interface in this MVP.
- No separate deadline scheduler; active SSE/reads resolve timeouts, including on reconnect.
- Database browser tests use PGlite, not provisioned production PostgreSQL. Production HTTPS deployment and real TV casting are not tested here.

No commit or push. Phase 4.3 only; no Game #4.
