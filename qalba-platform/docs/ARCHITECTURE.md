# قلبة — architecture through phase 6

## Scope and boundaries

This checkout started from an empty workspace. Phases 1–6 provide the Arabic design system, email accounts, server-side sessions, PostgreSQL migrations, original questions, protected admin tools, playable Category Board, a separate TV display and game credits. Room synchronization and checkout remain subsequent phases.

## Runtime

- Next.js App Router, TypeScript, React and Tailwind CSS. Server Components load private data. Route Handlers own mutations.
- PostgreSQL via Prisma with the `pg` driver adapter. No in-memory/browser state is authoritative for accounts, credits or gameplay.
- Auth uses salted `scrypt` password hashes and opaque random session tokens; only SHA-256 token hashes are stored. Cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production. Every write checks its request origin, validates input with Zod, and checks the account/role server-side.
- Auth rate limits use a PostgreSQL-backed window keyed by a keyed digest of the normalized email and action. A production deployment must provide `AUTH_RATE_LIMIT_SECRET`; checkout and room endpoints have database-backed rate limits.
- Password reset uses expiring, single-use token hashes. SMTP is configured through environment variables. The public endpoint returns the same response whether an address exists.

## Domains and contracts

`src/lib/auth` owns identity, sessions, passwords and access control. `src/lib/questions` owns validation, filtering and history-aware selection. `src/lib/db` owns the database adapter. The schema reserves independent tables for the games engine, rooms, billing and analytics so those modules can be added without rewriting auth/content.

Game modules own typed state, validated commands and a pure decision function. The platform service checks host identity, loads the module, writes command records, score deltas, question history and the new snapshot inside a transaction, then returns a safe projection. Clients never submit a score or credit balance. Commands carry an idempotency key and expected state version. Later realtime transport can broadcast committed projections without owning game decisions.

Category Board is the first module. Its board fixes six category IDs, three values (200/400/600), and private question snapshots at creation, so an admin edit cannot change an active match. Question history is recorded when a cell opens. Its state stores the active question, turn, timer deadline, remaining time and the last judgment that can be undone; power counts live in `SessionPowerUp`. The host decides answers; the module decides legal transitions and point deltas. `GameCommand` has a unique `(sessionId, key)` pair, and the server compares `stateVersion` before committing. An undo reverses a judgment with a compensating `ScoreEvent`; versions never go backwards. Answer text is returned only once revealed. A rematch creates a new session and prefers unseen questions. A new match spends one credit on `START`.

The host page combines a responsive board and controls. Host-only pause, score adjustment and early-end commands use the same authoritative service. Pausing freezes the active timer; resuming leaves it stopped until the host restarts it. Each manual adjustment emits a `ScoreEvent` and can be undone once, including after completion. An early end records a completed session with unused cells and cannot itself be undone. The separate TV projection reads only the safe view, polls the host-authenticated GET endpoint for committed changes and has no game mutation controls; rooms deliver sanitized updates through short-lived SSE streams.

Phase 5 credit flow: a `welcome-credits` database flag sets the grant for newly registered users; an idempotent `welcome:<userId>` ledger entry also grants the same entitlement once to accounts created before this phase, at their next dashboard/profile visit or game start. The `START` command atomically checks and decrements `CreditWallet.balance`, inserts a unique `game-start:<sessionId>` debit, sets `creditConsumedAt`, then commits the state version and command record. Creating a lobby, refreshing, resuming, viewing the display or retrying a committed start never spends another credit. A failed start leaves the session in the lobby and writes no debit. An admin can grant credits through a protected ledger action. Hosted invoice purchases use an adapter and a server-verified, idempotent credit ledger.

## Data and security decisions

- `GameType` has a stable slug and enabled flag; each module gets its own rules. `GameSession.state` is a versioned JSON snapshot, with rounds, accepted commands and score events retained relationally for audit. Player responses belong to later multiplayer modes.
- `QuestionHistory` records per-account usage. Selection excludes recent questions first, then broadens only if necessary; this is not a promise of global uniqueness when a category is exhausted.
- Content status is draft/published/archived. Only published questions are eligible when a new board is created. A player can report a question opened in their own game; admin review may archive it for future sessions without changing an active snapshot.
- The credit ledger and purchases carry unique idempotency keys. Wallet balances have a database nonnegative check. Checkout fetches the hosted invoice from Moyasar before a single transactional credit grant. Active products and coupons come from the database.
- Admin bootstrap credentials come from required seed environment variables. Seed scripts do not embed a reusable password.
- No user-uploaded HTML is rendered; text is escaped by React. Query access uses Prisma parameters. Access control is repeated in handlers, not inferred from client links.

## Local operation

Provide `DATABASE_URL`, run `npm install`, `npm run db:generate`, `npm run db:migrate`, then `npm run db:seed` with bootstrap credentials. Run `npm run dev`. A real PostgreSQL instance is needed for normal deployment, while the automated integration and browser tests use an isolated PostgreSQL-compatible PGlite server. SMTP settings are needed for email reset; `.env.example` documents them.

## Phase 6 administrative design

The admin area reads bounded result sets and computes dashboard metrics from real database records. Mutation routes independently check an authenticated admin and same-origin JSON input, and validate game, power, pricing, coupon, feature-flag, user and report changes. Suspending a user invalidates their existing sessions at the next request and blocks new login; an admin cannot suspend or demote themselves, and the final active admin is protected. Active products and coupons drive the checkout flow.

Question import accepts bounded UTF-8 CSV with a header row, previews row validation errors before committing, and inserts the validated batch in one transaction. CSV export produces a BOM and quoted fields suitable for Excel. An account may report a question once after it opens in that account's match. Moderators review the report and can archive the question; existing match snapshots remain unchanged.
# Phase 7 rooms and live participation

Each Category Board session can own one expiring room. The account host creates it and keeps authority through the existing versioned command service. Guests receive a random room-scoped, HttpOnly cookie; only its SHA-256 hash is persisted. A guest is bound to one Player and optionally a Team. Room version changes on joins/readiness/responses, while session stateVersion changes on host actions. A server-sent event stream watches those database versions and delivers a sanitized room projection; reconnects rehydrate state from PostgreSQL. The stream has a bounded lifetime and browser retry. This DB polling transport is suitable for modest party rooms; a pub/sub fan-out is needed at high concurrency.

Guest responses and multiple-choice votes are unique per round, validated against the currently open question, and never award scores. Only the host's board commands can start, judge, reveal, or edit results. The room projection omits unopened questions, unrevealed answers, power-up inventory, and host-only controls.

## Phases 8–10

Seven additional modules live under `src/lib/games/party`, each with pure transition rules and shared transactional persistence, host UI and redacted display state. Private phone participation is currently specific to Category Board rooms.

`PaymentProvider` isolates the Moyasar hosted invoice API. A purchase holds a product credit/price snapshot and optional coupon reservation. The callback and reconciliation endpoints retrieve the invoice with a server secret, verify ID/amount/currency/status and insert one unique wallet ledger entry in the same transaction as the paid status. The scheduled reconciler recovers missed callbacks and expires uninvoiced reservations. No card data is handled by the platform.

Analytics events are inserted with the business transaction. Properties are allowlisted internal IDs and slugs; a protected daily retention job deletes events older than 90 days. Admin reports use aggregate counts. Security headers and role/origin checks protect browser routes. Real provider and PostgreSQL load tests remain deployment gates.
