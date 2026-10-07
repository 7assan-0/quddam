# Phase 4.9 — رتّبها

An isolated `ORDERING` module (`ordering-challenge`) uses GameSession, explicit Team positions, immutable OrderingQuestionUse snapshots linked to GameRound, GameCommand receipts, ScoreEvent audit, shared DisplayAccess policy and allow-listed analytics. Existing games and tests are unchanged.

## Match

Seven simultaneous rounds. Each round has 4–8 items, one secure server shuffle and opaque random UUIDs. Team A is Coral; Team B is Turquoise. A current question, both private draft orders, team revisions and submission flags live in server-only GameSession JSON. Correct positions, aliases, source metadata and explanations live in immutable snapshots. Neither JSON state nor snapshots are serialized directly to gameplay clients.

LOBBY → START → READY → START_ROUND → ORDERING → REVEAL → SHOW_RESULT → ROUND_RESULTS → NEXT_ROUND → ORDERING (or FINAL_RESULTS after round seven) → COMPLETE → COMPLETED. REMATCH creates another match in the same session. PAUSED stores its prior phase and exact remaining server time. ABANDONED terminates play. ROUND_INTRO is reserved for a future introduction screen; the MVP starts directly from READY into ORDERING.

Host may end the match manually; the current active round is finalized from latest saved orders and scored with reason MANUAL_END. Abandon cancels the unresolved round without scoring. UI actions and API transitions are validated independently.

## Scores and disclosure

Each exact position earns two points. A perfect entire order earns two extra points. Total position error is display-only; it never breaks a tie. A round's points are awarded once at REVEAL. Both zero-point and positive results have ScoreEvent receipts; per-team metrics (exactMatches, perfectBonus, totalPoints, positionError) are recorded in the use's scoreAudit. VOID_RESULT writes compensating negative deltas, preserves the already public order and prevents replay. Original metrics remain visible for audit with a void marker and zero awarded points.

A submitted team can be reopened while ORDERING is still active and its original deadline remains valid. Since the second final submit automatically reveals, only the first submitted team has a reopening interval. Reopening preserves its order and deadline, clears its final flag and increments its own revision. Once REVEAL begins there is no transition back into secret ordering. SHOW_RESULT only advances presentation; it never scores again. Host REVEAL validates both submissions, although automatic finalization normally makes the explicit command unnecessary.

## Controller identity and concurrency

Dedicated OrderingControllerAccess tokens are random 32-byte secrets, hashed at rest, session/match/team scoped, expiring after six hours, and revocable. Permissions are ORDER_TEAM_A / ORDER_TEAM_B. One active link per team, six creations per ten-minute window. Rematch revokes all old match links and requires reissue. Tokens never authorize Host or TV endpoints and the body cannot name another team.

All authoritative writes lock the GameSession row inside a transaction. Host uses expectedVersion. Controllers use current roundNumber and expectedRevision for their own team, so an opponent's concurrent save or submission never rejects a legitimate independent input. Global stateVersion still increments on every authoritative mutation. Same actor/key/semantic action returns duplicate success before phase/version checks; changed action, order or actor produces COMMAND_KEY_REUSED. Order arrays must contain every current opaque item ID exactly once.

SAVE_ORDER and SUBMIT_ORDER carry complete meaningful item states. The phone persists each completed button move or pointer drag, disables concurrent editing while a save is in flight and restores authoritative data after errors. Submission atomically saves the supplied order and locks it. HTTP lost-response retries keep keys scoped to the current semantic input and own revision/round.

## Timer and realtime

A 45-second server deadline starts with the round and survives refresh. Pause stores remaining milliseconds and clears the deadline; resume rebases that exact duration. Client countdowns use a server-time/performance-time anchor calibrated by response travel time. Local clocks never authorize a save, score or final submission.

Expiry finalizes missing teams using their latest persisted order, or the original shared shuffle if no save exists. It is resolved once under the row lock on the next authorized read, SSE refresh or command. No background worker is required. With no connected authorized reader at all, resolution occurs on reconnect. No controller disconnect can block a healthy Host, TV or opponent.

SSE sends dedicated Host, TV or assigned-team projections with stateVersion and ten-second heartbeats. Healthy clients do not poll; REST fallback starts only after actual SSE errors and stops on recovery. Revoked access closes the stream and disables controller actions. Event metadata contains controlled names only, never orders, correct positions, aliases or raw tokens.

## Content/admin

180 original Arabic challenges across fifteen categories: 60 language exercises, 60 authored arithmetic/time/explicitly fictional timeline exercises, 40 planet comparisons and 20 decimal-prefix comparisons. Factual comparisons use NASA and BIPM primary sources checked on 2026-10-04. No current population/statistical rankings are invented. Related curated comparisons share facts and subsets; challenge IDs do not repeat within a match and recent host history is preferred against repeat IDs.

/admin/ordering-questions supports atomic nested creation/edit, archiving, search, category/status/difficulty filters, item positions/aliases/display values, ordering metadata, explanations and source fields. All saved challenges require 4–8 unique items and contiguous positions 1..N. Labels and aliases share one collision namespace after safe Arabic normalization. Published content requires an active category. Factual content requires a source label, HTTPS URL and non-future source date. Non-factual exercises are explicitly marked as authored, rather than presented as statistical fact. The orderingType is descriptive; the engine uses correctPosition only.

Snapshots are selected and created at START. Source question/category locks serialize selection against admin nested edits. Subsequent authoring, archival, positions or point changes cannot alter a running/historical match. The last 100 host use records guide new selection. START consumes one existing Qalba credit; same-session rematches are free.

CSV is deferred rather than forcing nested content through a flat importer. Match/timer configuration UI, multiple simultaneous team controllers and a persistent background expiry worker are also deferred.

## Accessibility

Vertical position 1 always means the top, independently of RTL. Pointer drag supports touch/desktop; labeled up/down controls support keyboard and screen readers. Every row announces its label and numeric position. Team names and A/B markers supplement colors. Host/TV/phone layouts are tested at 390×844, 430×932, 768×1024, 1440×900, 1920×1080 and 3840×2160. A three-column reveal becomes vertical on small phones.

Revoked controller/display pages use the existing Next notFound boundary; streamed HTML may have HTTP 200 but contains no controller data. REST/SSE still return access denial and perform their own authorization. The Lightning-specific pre-stream proxy and its tests remain unchanged.
