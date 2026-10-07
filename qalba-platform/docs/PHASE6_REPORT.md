# Phase 6 report — administration and content operations

## Implemented

- Admin dashboard with real account, active session, match, Saudi-day match, confirmed revenue, published content, report and question-usage metrics. Popular games/categories and a separate aggregate analytics page use database records. Empty data remains zero.
- User directory with email search and pagination. Admins can change another account's role, suspend/reactivate it, and view its wallet/game counts. A suspended account cannot log in or use an existing session. Self-demotion/suspension and removal of the last active admin are blocked in a serializable transaction.
- Game settings for Category Board and configurable power-up availability/starting counts/extra seconds. Unsupported game engines cannot be enabled by the API. Existing sessions retain their saved state.
- Product and coupon CRUD for configurable future pricing; purchases are shown read-only. The player checkout is still unavailable, and these records do not grant credits.
- Player report submission for a question opened in their own match, with a unique account/question constraint. Admin report review can resolve, dismiss or archive a question; question snapshots in existing games remain unchanged.
- UTF-8 CSV question preview/import with 250-row and 500 KB limits, Zod validation, duplicate checks and atomic commit. CSV exports for questions, users, categories, games, purchases and reports quote fields, use a BOM for Excel and neutralize formula-like spreadsheet cells. Export is bounded at 10,000 rows per dataset.
- Feature flag editing, apart from the separate guarded welcome-credit setting.

## Files changed

- Schema/migration: `prisma/schema.prisma`, `prisma/migrations/20260929180000_admin_moderation/migration.sql`.
- Auth/game/reporting: `src/lib/auth/session.ts`, `src/app/api/auth/login/route.ts`, `src/lib/games/category-board/service.ts`, `src/components/board-host.tsx`, `src/components/question-report-form.tsx`, `src/app/api/questions/reports/route.ts`.
- Admin services/routes: `src/lib/admin/{errors,pricing,csv,metrics}.ts`, `src/app/api/admin/{users,games,powers,products,coupons,features,reports,questions/import,questions/export,export}/...`.
- Admin pages/components: `src/app/admin/{page,users,games,pricing,features,reports,analytics,exports,questions}/...`, `src/components/{user,game,pricing,feature,report}-manager.tsx`, `src/components/question-import.tsx`, `src/app/globals.css`.
- Docs/tests: `README.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_CHECKLIST.md`, `scripts/integration.mjs`, `tests/e2e/{category-board,foundation}.spec.ts`, new CSV and metrics unit tests.

## Database changes

- `User.suspendedAt` stores suspension. `QuestionReport` has a unique `(userId, questionId)` index to block duplicate reports.
- Products, coupons, reports and feature flags use previously defined relational tables; there are no fabricated payment or analytics events.

## Tests executed and results

| Gate | Result |
| --- | --- |
| ESLint and TypeScript | Passed |
| Vitest | 26/26 passed, including CSV parsing/validation and Saudi-day calculation |
| Migration, seed and HTTP integration on PGlite | Passed: full game/credits; reports/moderation; users and suspension; game/power/pricing/flag validation; CSV preview, atomic import and export; admin authorization and reseed preservation |
| Next production build | Passed with new admin and report routes |
| Playwright on migrated PGlite/Chromium | 6/6 passed: host/mobile/TV, question report, credit admin, CSV preview/import/export, product form |

## Remaining work and known limits

- Phase 7 rooms and realtime participation, Phase 8 additional games, Phase 9 payment checkout and webhook verification, and Phase 10 event-level analytics/security/load hardening remain.
- CSV is the supported import format. Excel users can open/edit/export CSV UTF-8, but direct `.xlsx` upload is not implemented.
- CSV exports stop at 10,000 records per dataset and imports at 250 questions per transaction. Larger datasets need paginated exports and a background import job.
- Active-user count means distinct users with an unrevoked, unexpired session. It is not a last-30-day engagement measure. Saudi-day counts use UTC+03:00.
- Products and coupons can be configured but cannot be purchased. Revenue displays confirmed `PAID` records only; none are created by this phase.
- Tests used embedded PostgreSQL-compatible PGlite and Chromium. Live PostgreSQL deployment, SMTP delivery, concurrency/load, payment providers and production operations were not exercised here.

No Git commit or push was made.
