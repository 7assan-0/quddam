# Phase 4.5 — الكلمة الممنوعة

## Architecture

An isolated `src/lib/games/forbidden-word` module uses the existing `secret-word` library identity. Its state discriminator is `FORBIDDEN_WORD`; legacy Party sessions remain compatible and the generic Party service refuses dedicated sessions. Auth, credits, ordered Team records, GameCommand, ScoreEvent, DisplayAccess, analytics allowlists and SSE conventions are reused. No other game's rules change.

## States and format

`LOBBY → READY → ROUND_INTRO → CARD_ACTIVE → ROUND_RESULTS → ROUND_INTRO … → FINAL_RESULTS → COMPLETED`.

`PAUSED` stores the exact previous phase. `ABANDONED` is terminal. Default: six 60-second rounds, in persisted team positions A/B/A/B/A/B. The highest total wins; equal totals explicitly tie. START consumes one credit; rematches inside the session are free. Server-only duration validation permits 30, 45, 60 and 90 seconds; MVP setup uses 60.

## Scoring and verbal judgment

Correct +1; skip 0; foul subtracts one from the active team's accumulated total, clamped at zero. Round score is the actual change in team total, so it can be negative if a foul removes a point earned in an earlier round. Host judges verbal play. Each judgment, including zero-point results, writes a ScoreEvent. Undo writes a compensating audit event. Clients send only the action, command key and expected version.

## Timer and Undo

One server deadline covers all cards in a round. Pause banks server-calculated remaining milliseconds; resume creates a deadline from that bank. The client renders with the established server-time offset; it cannot award points or end a round early. Healthy SSE checks authoritative state each second and sends ten-second heartbeats. Only a disconnected stream enables three-second fallback reads.

An expired read or late command resolves the round transactionally, without scoring its unresolved card. Late judgments fail. With all devices closed, the persisted deadline is resolved on the next authorized request; no background scheduler is required.

Undo restores the latest card judgment within the current live round, restores score, removes the following card's use marker and clears the restored card's resolution. The original deadline is unchanged, so no extra time is created. While paused, banked time is unchanged. An expired round cannot be resurrected. A judgment that exhausts the deck may be undone before the original deadline. The match deck and its judgment history are bounded to at most 300 distinct cards. No history contains card text.

## Content and persistence

`ForbiddenWordCard` stores target, 3–6 forbidden terms, category, difficulty, locale, status and timestamps. The seed contains 208 independently authored cards across 13 categories, with 16 in each category and three difficulty levels. Validation removes harmless Arabic diacritics/tatweel, normalizes alif/maqsura and whitespace, and rejects duplicate terms or a target equal to any forbidden term. Ta marbuta is not broadened. Gameplay uses human judgment and no fuzzy text matching.

START creates a shuffled immutable deck in `ForbiddenWordCardUse` with fresh random snapshot IDs. The most recent 80 actually served cards for the account are moved to the end of selection where possible. No card repeats within the match. Admin edits/archives cannot alter snapshots. If every available snapshot is exhausted, the round ends explicitly and final results are available; content is never silently repeated.

Migration `20261004010000_forbidden_word` adds the card, snapshot/use and clue-access tables, foreign keys, uniqueness/indexes and card-count/result constraints. Existing game tables remain generic.

## Privacy and access

TV receives an explicit public allowlist: teams, scores, round, timer, summary, outcome event names and winner. It never queries or receives card snapshots, even after resolution. Host receives only the current card while active or paused. A separate clue projection serves that current card to a hashed, expiring, read-only phone token scoped to session, match and round. New clue links revoke prior links; round transitions invalidate old tokens. A clue token does not authorize Host commands or TV access, and TV tokens cannot read clue data. Both views have no-store/no-referrer headers. Public events and analytics carry no card text.

Display access reuses `DISPLAY_ACTIVE_LINK_LIMIT`, `DISPLAY_LINKS_PER_WINDOW`, `DISPLAY_LINK_WINDOW_MS`, shared TTL and completion grace. Host can create QR links, copy and revoke. Mutations require authentication, ownership, same origin and strict bounded payload validation.

## Exactly-once commands

Every mutation holds the session row lock in a transaction, checks the module and Host, compares a SHA-256 payload hash for an existing key, then checks expected stateVersion. Same key/payload returns duplicate success; changed payload returns `COMMAND_KEY_REUSED`. A conditional version update, score audit, snapshot use markers and command receipt commit atomically. Automatic timeouts use a stable internal match/round key. No client provides score values or card choices.

## Surfaces and content tools

`/games/secret-word/new`, `/secret-word/host/[id]`, `/secret-word/display/[id]`, `/secret-word/clue/[id]`, `/api/secret-word/**`, and `/admin/forbidden-word-cards` are dedicated routes. The admin editor creates, edits, archives and filters by target, category, difficulty and status. Publishing requires a valid active category. CSV is deferred because the existing generic-question import schema does not represent dedicated card arrays or validate them.

Qalba's established panel/button/color/font tokens are reused. Ownership includes textual A/B markers, not color alone. Host, TV and phone are Arabic and RTL, with large judgment controls and reduced-motion feedback. Profile history resumes this dedicated module while preserving legacy sessions.

## Verification and runner

New unit tests cover domain/content validation, timers, scoring, round order, explicit ties, Undo, rematches, privacy, scoped access and Promise.all command races. New Playwright cases cover Host/TV sync, exact score audit, timeout/late actions, pause/refresh, Undo, JSON/SSE/HTML/RSC privacy, concurrent judgments, six-round completion, credit/rematch/history behavior, admin validation and all five requested viewport sizes plus accessibility and phone scope.

All baseline tests are retained byte-for-byte. E2E still uses native Playwright discovery and one worker. The existing case isolation is extended to the new game. The test-only PGlite socket permits four connections so the application and independent SQL fixtures can coexist; the application pool stays bounded to one. Each dev server starts with a fresh generated compiler cache to prevent interrupted SST persistence files from breaking the next invocation. Each independent browser test server has its own auth-rate-limit namespace, preventing unrelated specs from exhausting the shared seeded admin account's window; the production eight-attempt limit and within-invocation checks remain intact. Test timeouts, waits and assertions are unchanged. Native JSON records every discovered case; no automatic retries are added. Explicit `E2E_CONTINUE=1` can finish an interrupted full run using the same report directory: it requires identical runtime/source-test fingerprints and validates clean native results and exact discovered case IDs before accepting completed reports. Failed, retried or incomplete reports cannot be reused. Completed cases are not executed a second time.

See the delivered Phase 4.5 report and evidence for executed quality-gate counts and exact failures/fixes.

## Scope limits

Phone is read-only; verbal rule enforcement remains with Host. Future multi-player team rooms, in-product timer/round configuration and CSV bulk tools are deferred. Up to 300 content snapshots per match; deck exhaustion ends explicitly. Display never reveals resolved target text. No commit or push is part of this phase.
