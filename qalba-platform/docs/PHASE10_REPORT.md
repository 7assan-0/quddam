# Phase 10 report — analytics and release checks

## Implemented

Transactional event recording covers registration, creation/start/completion of games, opened/answered questions, Board power-ups, purchase start/completion, and room creation/joining. Event properties are constrained to an allowlist of internal IDs and controlled slugs, with no raw responses, guest names, card details or IPs. Admin analytics shows 30-day event counts. A protected cron route deletes detailed events older than 90 days, with a public Arabic privacy explanation. Security headers deny framing, limit browser permissions and set HSTS. Checkout verifies the hosted URL domain before redirect. Existing session, role, origin, credit and game command checks remain server-side.

## Files changed

`src/lib/analytics/events*`, auth/game/room/billing services, `src/app/admin/analytics/page.tsx`, `src/app/api/analytics/prune/route.ts`, `src/app/privacy/page.tsx`, layout/footer, `next.config.ts`, `prisma/schema.prisma`, migration, `.env.example`, integration probes and E2E security tests.

## Database changes

An index on `AnalyticsEvent.occurredAt` supports the retention cleanup. Existing events table stores only allowlisted properties going forward.

## Tests executed and results

ESLint and TypeScript passed. Vitest passed 37/37. All eight migrations and seed ran in isolated PGlite for the full Category Board HTTP integration, seven complete party game sessions and the mock-provider checkout integration. Production build passed. Playwright passed 11/11 across account, admin, Category Board, seven-mode entry, bluff voting, rooms, pricing and security routes. A separate Letter Battle mobile/TV rerun caught and fixed a hidden-grid projection bug, then passed. Real PostgreSQL concurrency, provider sandbox and production proxy tests were not run.

## Remaining operational checks

Set a random 32+ character `ANALYTICS_CRON_SECRET` and schedule a POST to `/api/analytics/prune` with a Bearer token daily. Validate checkout and callback with Moyasar test credentials and real PostgreSQL before switching to live payments. Test room streaming under the target reverse proxy and load; PGlite browser tests do not establish production scale. Expand and editorially review sample questions before a commercial launch.
