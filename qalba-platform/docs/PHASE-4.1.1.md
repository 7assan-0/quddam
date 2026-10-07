# Phase 4.1.1 — final game engine hardening

## Scope

No game rules, visual tokens, branding, or database schema changed. The pass touches command delivery, the Category Board display transport, and the display handoff controls.

## Commands and idempotency

The unique `GameCommand(sessionId, key)` receipt is now inserted early inside the same transaction as the game state, credit debit, score event, and power-up inventory changes. PostgreSQL serializes concurrent inserts of the same key until the winner commits or rolls back. If a stale version, unique conflict, or transaction conflict occurs, the service checks the committed receipt again. Matching payload hashes return `duplicate: true` with the current state. A different payload returns `COMMAND_KEY_REUSED`; an absent receipt returns `STALE_GAME_STATE`. Existing receipts lacking a payload hash fail closed when retried.

The integration test uses simultaneous `Promise.all` requests with one key and verifies a single command receipt, credit debit, power-up usage event, inventory decrement, and score event. Playwright tests simultaneous same-key and different-payload requests.

## TV connection and handoff

The SSE stream stays open while the game is active. It sends a heartbeat comment every ten seconds and closes on game completion, cancellation, or lost access. The client polls only after a genuine EventSource error. A browser test maintains the TV connection for 32 seconds, checks that no warning or fallback reads occur, and confirms a subsequent host reveal arrives on the same stream.

The host's existing “فتح شاشة العرض” action opens a small dialog with a generated QR image, copy action, same-device action, expiry time, and revocation. A separate browser can use the copied URL without the host's cookie. The host view exposes only active-link status and expiration; raw tokens are returned once for the newly issued link and remain stored solely as SHA-256 hashes. After a host refresh, the revoke button remains available. Revocation removes access for existing links.

Link creation is rejected after a completed match's 30-minute display grace period. A link issued during that grace period expires no later than the grace deadline. Creation removes old expired records for that match, allows at most three active links and six creations per ten minutes, and returns HTTP 429 when the limit is reached.

## Validation

| Command | Final result |
| --- | --- |
| `npm run lint` | Passed, no warnings |
| `npm run typecheck` | Passed |
| `npm run test` | 49 tests passed in 14 files |
| `DATABASE_URL='postgresql://localhost:5432/qalba' npm run build` | Passed |
| `npm run test:integration` | Passed: database-level concurrency counts and full platform integration |
| `npm run test:e2e:db` | 20 tests passed; migrations and seed applied to isolated PGlite |

The focused browser run initially found old expectations for opening a tab directly and checking a streaming page's HTTP status after revocation. The tests now follow the dialog and query the protected state API. The final full run passed.

## Remaining operational consideration

Each open SSE display currently observes its database version once per second. The stream has no planned 25-second restart, but a larger production deployment should move change notification to shared pub/sub while preserving the version check and reconnect fetch. At completion the TV intentionally stops its subscription; a later final score correction appears after a manual reload.
