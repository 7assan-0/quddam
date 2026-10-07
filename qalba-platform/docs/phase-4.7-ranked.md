# Phase 4.7 — توب 100

Dedicated `RANKED_LIST` module for the existing `top-list` game type. Existing Category Board, Social Deduction, Letter Network, Survey Battle, Forbidden Word and Bluff engines are unchanged. The old generic `/games/top-list/new` route remains compatible; the library card and new game history use `/ranked/new` and `/ranked/host/:id`.

## Rules and authority

Two persisted teams, ordered by position (Coral then Turquoise), five rounds, ten attempts per team, twenty seconds per attempt. Starting positions are A/B/A/B/A. Correct and wrong attempts alternate. Previously disclosed answers consume no attempt or time reset. Exact authored positive entry points are awarded; no ranking formula in the engine. Full discovery, twenty valid attempts, or host ending the round enters ROUND_RESULTS. Remaining answers are disclosed without points. After five rounds, highest total wins; equal totals produce two winners. Same-session rematch is free, preserves team identity/name/order and creates fresh snapshots.

`LOBBY → READY → GUESS_ACTIVE → ROUND_RESULTS → ROUND_INTRO → GUESS_ACTIVE … → FINAL_RESULTS → COMPLETED`. READY/ROUND_INTRO/GUESS_ACTIVE can PAUSE; RESUME restores the previous phase. ABANDONED is terminal. Commands and projections enforce all transitions on the server.

## Content and sources

`RankedListQuestion`, `RankedListEntry`, `RankedListUse` are separate content/snapshot entities. Uses connect to generic GameRound and ScoreEvent. Five immutable list snapshots are selected at START, with same-match uniqueness and preference outside the host's recent fifty uses. Rematch picks a fresh set if available.

The starter bank has 82 original editorial lists, 820 entries and 15 categories. They are explicitly labelled curated selections with editorial ordering, NOT popularity, sales or statistical rankings. No fabricated factual ranking is included. FACTUAL lists require a source label, HTTPS URL and valid dated source; source freshness is displayed. Administrators remain responsible for verifying source correctness and refreshing factual data.

Lists support 5–200 entries; the game title is not a fixed database size. Ranks must be contiguous starting at one; canonical answers and aliases share a globally unique normalized answer space within each list. Points are integers 1–1000, with a bounded total. Arabic normalization removes harmless marks/tatweel, standardizes alif/maqsura, NFC, whitespace and letter case. It preserves meaningful spaces and ة/ه. No fuzzy or semantic matching.

## Privacy, display and realtime

Both explicit Host and TV projections contain only rank, points and revealed status for undisclosed slots. Answer/display value/owner appear only after discovery or results. Neither projection contains aliases, snapshots, use IDs, private history or the hidden bank. SSR/RSC use the same authorized projections. Analytics and lastEvent contain controlled event names/internal identifiers, never guess text or bank content.

Display links reuse platform hashed tokens, TTL, completed grace, active/rate limits, QR and revocation. TV is read-only. SSE sends authoritative versions with heartbeat; REST fallback runs only during disconnection. Server-clock samples plus monotonic elapsed time drive the visual countdown. Authorization is verified before any timeout mutation.

## Timers and safe Undo

Server deadlines govern legality, refresh and late rejection. Timeout transactions count one wrong attempt and rotate once. A expired command resolves timeout and reports TIMER_EXPIRED. PAUSE stores remaining time; RESUME restores it and shifts saved Undo deadlines by the pause duration. With every client offline, resolution occurs on the next authorized request; this phase adds no always-on timer worker.

WRONG/TIMEOUT Undo restores attempts, team and original absolute deadline. CORRECT Undo compensates the score, restores attempts/team and retains the answer as REVEALED_VOID without an owner. That answer can never score again. Repeated Undo never hides newer voided reveals. No Undo from ROUND_RESULTS, because all answers have been disclosed. Undo never grants another twenty seconds; an exhausted restored deadline times out on the next authoritative request.

## Concurrency and admin

Every mutation uses a transaction, GameSession row lock, expected stateVersion, conditional version update and GameCommand payload hash. Same key/payload succeeds as duplicate before version checking; changed payload returns COMMAND_KEY_REUSED. Award and reversal ScoreEvents have unique command identifiers and round/rank audit reasons. Content selection locks question rows; admin updates replace nested entries atomically and cannot alter existing snapshots.

`/admin/ranked-lists` supports nested entry editing, ranks, points, alternatives, display values, categories, difficulty/status, search/filter, sources/dates and archive. Nested bodies use a byte-bounded 512 KiB parser; gameplay payloads retain the platform parser. CSV is deferred because the existing flat importer cannot safely represent nested lists.

## Accessibility and sizing

RTL text with numeric rank order preserved. Team A/B text markers and explicit rank/discovery labels supplement color. Host guess input has a label, character count, post-submit clearing/refocus. TV automatically cycles eight slots per page, reduced to four when long disclosed answers or display values need more space, preserving readable text with no horizontal board scroll or controls.

Quality results and exact command counts are recorded in the Phase 4.7 final report, only after execution.
