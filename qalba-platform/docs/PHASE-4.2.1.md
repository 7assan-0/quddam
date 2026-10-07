# Phase 4.2.1 — خارج الجو gameplay hardening

## Scope

This is a focused follow-up to Phase 4.2. Category Board, the Hamaasi Khaleeji design tokens, the word bank and the game's established voting and winner rules remain unchanged. No new schema migration is needed.

## Lobby removal

The host may issue `REMOVE_PARTICIPANT` only while the session is in `LOBBY`. The command takes a UUID key, expected state version and server-validated participant ID. It serializes with joins and starts on the `GameSession` row, removes that participant inside the transaction, normalizes remaining positions, and increments both session and room versions. The removed token hash disappears with its participant row, so private reads, actions and the active SSE stream lose access. A started or rematched round rejects removal. The host sees an `إزالة` control beside each lobby participant.

## Final guess deadline

Correct identification now starts a server timestamped 30-second `OUTSIDER_GUESS` deadline. Player, host and TV projections carry the public deadline and show a countdown; none expose the word to the outsider. Pause stores the remaining time and resume starts a fresh deadline from that remainder. Guessing at or after the deadline is rejected. Before the deadline, the host's `انتهت مهلة التخمين` command is rejected; after it, the command can award players a `GUESS_TIMEOUT` result. A connected authorized SSE client checks the deadline each second and commits the same result automatically, so the round completes when the outsider disconnects. An authorized read also resolves an already expired guess on reconnect. The timeout write and round outcome share one transaction and are guarded by phase under a row lock, preventing duplicate resolution.

## Private role card and display policy

The private phone card is visible in `ROLE_REVEAL`. In later phases it is concealed by default, including after a refresh or phase change. `إظهار بطاقتي` reveals the player's own private projection; `إخفاء بطاقتي` or a five-second timeout conceals it again. This changes screen presentation only; server projections and access boundaries are unchanged.

Social TV link issuance now uses the shared `DISPLAY_ACTIVE_LINK_LIMIT`, `DISPLAY_LINKS_PER_WINDOW` and `DISPLAY_LINK_WINDOW_MS` values. A session row lock serializes link creation before counting active and recent links. The full Playwright runner splits individual tests across four sequential shards while retaining its one database worker; this keeps every shard nonempty and bounds the Next development compiler cache.

## Changed files

- `src/lib/games/social-deduction/module.ts`, `service.ts`, `validation.ts`, `module.test.ts`
- `src/app/api/social/[id]/events/route.ts`
- `src/components/social-host.tsx`, `social-player.tsx`, `social-display.tsx`, `social-live.ts`
- `src/styles/components.css`, `tests/e2e/social-deduction.spec.ts`, `scripts/e2e-with-db.mjs`, `README.md`, this report

## Verification

| Exact command | Result |
| --- | --- |
| `npm run lint` | Passed, exit 0 |
| `npm run typecheck` | Passed, exit 0 |
| `npm run test` | 64 passed in 15 files, including 15 social deduction domain tests |
| `DATABASE_URL='postgresql://localhost:5432/qalba' npm run build` | Passed, production compilation and TypeScript validation |
| `npm run test:e2e:db -- social-deduction.spec.ts` | 10 passed before the additional host timeout command scenario |
| `npm run test:e2e:db -- social-deduction.spec.ts -g 'host expiry action'` | 1 passed; verified post-deadline host action and duplicate command |
| `npm run test:e2e:db` | 31 passed, exit 0: four sequential shards of 8 + 8 + 8 + 7 tests; all 20 previous non-social browser tests and all 11 social browser tests passed. The isolated PGlite database applied all 10 migrations and seeded content. |

The first isolated browser run was blocked before tests by a local `node_modules` symlink that Turbopack rejected; placing dependencies within the project resolved it. An initial full-suite attempt was interrupted after its file-level shard plan left the fourth shard empty. The final run above used test-level shards and completed successfully. No application change was made to address either test-environment issue.

## Operational limit

The durable deadline is resolved by an authorized read or live stream. If all devices disconnect, the stored phase advances immediately when one reconnects; this deployment has no independent background scheduler.
