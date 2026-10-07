# Phase 7 report — rooms and live participation

## Implemented

- A Category Board host can create or reopen a room with a six-character code. Guests enter a name, choose a team, and join without an account at `/join`. A room lasts eight hours and accepts up to 20 players.
- The lobby lists joining players and their readiness. A separate mobile room view shows the active question, visible choices, scores and result. Guests send one text response and one multiple-choice vote per round; the host can review responses from the board panel. The host still judges answers and controls points through versioned commands.
- Server-sent events stream a sanitized room projection, rehydrate on reconnect and close after 25 seconds so the browser reconnects. Database versions make updates visible across application instances. Unrevealed answers, unopened question snapshots and host controls are excluded from guest payloads.
- Room-specific random tokens are stored only as hashes, while the cookie is HttpOnly/SameSite and Secure in production. Mutations require same-origin requests. Room joining is rate-limited; roster capacity and names are serialized with a row lock. Response submission locks the game session and rejects stale questions. Duplicate response/vote constraints enforce one per round.

## Files changed

- Schema and migration: `prisma/schema.prisma`, `prisma/migrations/20260929190000_rooms_realtime/migration.sql`.
- Service/routes: `src/lib/rooms/service.ts`, `src/app/api/rooms/**`, `src/lib/auth/rate-limit.ts`.
- UI: `src/app/join/page.tsx`, `src/app/rooms/[code]/page.tsx`, `src/components/{room-join,room-live,room-host-panel}.tsx`, `src/components/board-host.tsx`, `src/app/{layout,page}.tsx`, `src/app/globals.css`.
- Docs/tests: `docs/{ARCHITECTURE,IMPLEMENTATION_CHECKLIST,PHASE7_REPORT}.md`, `src/lib/rooms/service.test.ts`, `scripts/integration.mjs`, `tests/e2e/rooms.spec.ts`.

## Database changes

- `Room.version` tracks lobby mutations. `RoomParticipant` stores a room token hash, linked player and team. `RoomVote` stores one choice per player and round, with foreign keys to round/participant. A unique `PlayerResponse(roundId, playerId)` prevents duplicate text responses.

## Tests executed and results

| Gate | Result |
| --- | --- |
| ESLint and TypeScript | Passed |
| Vitest | 28/28 passed |
| Migration, seed and HTTP integration on PGlite | Passed, including room create/retry, invalid code, guest access, readiness, SSE, response uniqueness, host review and authorization |
| Next production build | Passed |
| Playwright on migrated PGlite/Chromium | 7/7 passed across existing journeys and new host/guest room/mobile flow; targeted room rerun passed after final migration |

## Remaining work and known limits

- Phase 8 adds the seven other game modules. Phase 9 adds checkout and verified provider webhooks. Phase 10 covers analytics, operations and load/security hardening.
- SSE polls PostgreSQL every 1.5 seconds per connected room client. This works across instances for modest party rooms; larger deployments need a pub/sub fan-out and connection/load testing. Hosting must support streaming Node responses.
- Room answers and multiple-choice votes are advisory to the host; automatic scoring and game-specific voting rules belong to later game modules. The room code is a social invitation, not a substitute for the guest token.
- Tests used PGlite and Chromium. Real PostgreSQL under concurrent load and a production reverse proxy were not tested. The join rate limit uses the forwarded client address and therefore depends on a trusted proxy to set that header.

No Git commit or push was made.
