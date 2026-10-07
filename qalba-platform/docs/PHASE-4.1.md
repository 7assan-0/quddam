# Phase 4.1 — Category Board engine hardening

## State and command contract

The session JSON remains schema version 1 for compatibility with existing matches. New matches use a bounded `undoStack` of 20 gameplay snapshots. A snapshot freezes the current question timer at the command timestamp and records the turn, cell completion, score delta, and consumed power-up. Undo writes a compensating score event and refunds a power-up in the same database transaction as the state change. Old `lastJudgment` and `lastManualScore` snapshots can still be undone once.

Pause and resume are lifecycle commands. They preserve undo history. Pause stores the server-computed remaining duration and whether the timer was running. Resume creates a new server deadline from that duration. The server rejects timed judgments and power-ups after expiration with `TIMER_EXPIRED`; the host may reset the timer or skip the question.

The host submits a command key and expected state version. A successful transaction updates the state, score event, round, power-up inventory, and command receipt together. A repeated key and payload returns the current state without applying the action again. A reused key with another payload returns `COMMAND_KEY_REUSED`, and a stale version returns `STALE_GAME_STATE`.

## Display access and transport

The host creates a six-hour, 256-bit random display token. Only its SHA-256 hash is stored. The token can read one Category Board match through `/display/{id}` and `/api/display/{id}`; it cannot call host command endpoints. The host can revoke all display links for that match. Completed matches remain readable for at most 30 minutes, subject to the token's earlier absolute expiry. The display route disables referrer disclosure and response caching.

The TV listens to a server-sent event stream and fetches authoritative state after reconnect. The stream observes database versions every second, making it safe across app instances without an in-memory event bus. The client has a three-second polling fallback while disconnected. Both transports stop after `COMPLETED`. A completed display can be manually reloaded to see a later administrative score correction.

The server returns `serverNow` and the deadline. Host and TV use an offset from server time, with half-round-trip correction on ordinary fetches. Persisted `Team.position` controls the initial and rematch ordering; the migration restores positions from existing Category Board state.

## Verification

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run test` — 49 passed in 14 files.
- `DATABASE_URL='postgresql://localhost:5432/qalba' npm run build` — passed.
- `npm run test:e2e:db` — 17 passed. This command applies 9 migrations and seeds an isolated PGlite database.

## Limits

- The SSE server checks the database once per second per open display. For a large number of screens, use a shared PostgreSQL notification or pub/sub transport while retaining version checks and the reconnect fetch.
- After match completion, the TV closes its subscription. A host score correction made afterward appears upon a manual display reload.
- Legacy host-authenticated `/play/{id}/display` remains for compatibility; newly generated links use the read-only token route.
