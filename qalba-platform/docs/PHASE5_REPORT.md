# Phase 5 report — game credits and history

## Implemented

- Configurable welcome games: three by default in the seed, editable by an admin. Registration grants once in a database transaction; older accounts get the same one-time entitlement when they next visit the library/profile or start a match.
- Starting a Category Board match atomically deducts one game credit, records a unique ledger debit, and marks the session as charged. Lobby creation, refresh, command retry, pause/resume and continued play do not deduct another credit. A zero balance returns an explicit error and leaves the lobby unchanged.
- Profile shows wallet balance, hosted match history with scores and links back to matches, credit ledger and purchase history with an empty state.
- Protected admin credit page sets the starter grant and provides an idempotent manual grant to a registered email address. Admin routes validate inputs, role and same-origin writes.
- Library and landing copy now describe the active credit flow and the unavailable checkout accurately.

## Files changed

- Billing service: `src/lib/billing/credits.ts`.
- Registration and game transaction: `src/app/api/auth/register/route.ts`, `src/lib/games/category-board/service.ts`, `src/app/api/games/category-board/[id]/commands/route.ts`.
- Admin UI and APIs: `src/app/admin/credits/page.tsx`, `src/components/credit-manager.tsx`, `src/app/api/admin/credits/{settings,grants}/route.ts`, `src/app/admin/page.tsx`.
- Account/product UI: `src/app/profile/page.tsx`, `src/app/games/page.tsx`, `src/app/page.tsx`, `src/app/globals.css`.
- Data/docs/tests: `prisma/schema.prisma`, `prisma/seed.ts`, new migration, `scripts/integration.mjs`, `tests/e2e/{category-board,foundation}.spec.ts`, `src/app/api/auth/register/route.test.ts`, `README.md`, architecture and checklist.

## Database changes

- `20260929170000_wallet_nonnegative` adds a database `CHECK (balance >= 0)` constraint to `CreditWallet`.
- Existing `FeatureFlag` holds `welcome-credits` configuration. Existing `GameCredit` idempotency keys record grants and debits, and `GameSession.creditConsumedAt` marks paid starts. No prices or purchases are fabricated.

## Tests executed and results

| Gate | Result |
| --- | --- |
| ESLint and TypeScript | Passed |
| Vitest | 21/21 passed |
| Migration, seed and HTTP integration on PGlite | Passed: full game, one-time grant, four starts, retry/no duplicate debit, insufficient balance, admin grant retry/config, history, RBAC and reseed preservation |
| Next production build | Passed; `/admin/credits` and both admin credit APIs generated |
| Playwright with migrated PGlite/Chromium | 5/5 passed: account flow, host/TV/mobile journey, credit after start/refresh, admin credit forms |

## Remaining work and known limits

- Checkout and payment providers are Phase 9. With exhausted balance, an admin must add credit; a player cannot buy games yet.
- Full admin imports/reports, realtime rooms, seven additional games and analytics/security hardening remain later phases.
- An older account receives its welcome credit only on its first library/profile visit or start after this release. The admin setting at that first grant determines the amount.
- Tests used embedded PostgreSQL-compatible PGlite and Chromium. Live PostgreSQL deployment, payment providers, SMTP delivery and concurrent production load were not tested.
- The TV display still needs the signed-in host session and polls for state about every 1.5 seconds; independent participant access belongs to the room phase.

No Git commit or push was made.
