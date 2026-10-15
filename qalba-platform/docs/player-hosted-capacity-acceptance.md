# Phase 2.1 — Nine-player / one-hour acceptance gate

**Status: nine-player native Chrome preflight passed; exact-head execution records are attached to draft PR #9.** See [the nine-player verification report](player-hosted-nine-verification.md) for the expiry correction, reproducible runner, sanitized preflight evidence and outstanding gates. Earlier local Chrome results from commit `83fad608` cover host + three guests / 30 minutes only and must not be recycled as evidence for the nine-player variant. A preflight with modified working-tree files is explicitly identified as such and does not approve its predecessor commit or any later head.

Owner-approved target: **playing host A** + guests B through I (eight guests), one-hour absolute room lifetime measured from creation. The host occupies the fixed ninth-player slot 0, has their own player-facing buzzer and score, and retains a separately labeled administration panel; no extra guest slot is consumed. Implementation remains opt-in, localhost-only, single-process signaling, no public deployment or extra service spending. PR #9 stays draft and stacked on unmerged PR #8.

## Changes to inspect

- `rooms/protocol.ts`: `MAX_PLAYERS=9`, `MAX_GUESTS=8`, nine-slot score tuple, wire protocol 3 and strict invalid-slot/snapshot checks; one host awards, guests send current-round BUZZ only.
- `rooms/signaling.ts`: 60-minute fixed expiry, eight guest admission, peer indices 1–8, exact capability-to-slot routing and no guest-to-host elevation. Requests have finite caps: 12,000 global/min/process; 180/min/capability; host signaling 96/min and guest signaling 24/min; 512 bounded rate records. 16 rooms, 45-second host/guest leases, 3 retries, 100k request body and 95k SDP string limits remain. Signaling is **not** publicly deployed and still refuses non-loopback origins.
- `rooms/client.ts`: optional guest-only storage accepts slots 1–8; v3 prefix cannot accidentally read old four-slot stored state. Never store host credentials.
- `player-hosted-rooms.tsx`: nine labels A–I, connected count out of 8, explicit 60-minute duration; original games and payments unchanged.
- `rooms/controller.ts`: an independent absolute-deadline timer and synchronous guards stop gameplay, incoming snapshots, pending setup and retries at the original expiry even when polling stalls. Expiry remains terminal across nested connection callbacks; retry credentials cannot change the original identity or deadline.

## Required local run before any PASS claim

Use the existing local verified checkout of `experiment/player-hosted-auto-rooms`, then run under `qalba-platform`:

```powershell
npm ci
npm run db:generate
npm run typecheck
npx vitest run src/lib/player-hosted --reporter=verbose
npm run lint
npm run build
```

Use synthetic/local environment only; `db:generate` requires no database migration. Report actual numbers and errors; do not imply that editing tests equals passing them.

## Required real-browser acceptance

1. Enable the **same local-only** feature flag and exact loopback origin documented in `player-hosted-rooms.md` on a trusted localhost browser. No wildcard listener, firewall/trust changes or public origin.
2. Open a host and **eight** guest tabs. Join using the link/code without manual SDP. Verify all eight guest slots B–I connect and receive the same initial nine-score snapshot.
3. Attempt guest nine (tenth participant); verify a room-full rejection without allocating a slot, leaking capabilities or disrupting other peers.
4. In separate rounds, test host A **pressing the same player-buzzer control and receiving a point**, early guest B and last guest I winning. Verify host-vs-guest first-arrival lock in both orders, denied duplicate/stale host and guest presses, host's own score displayed correctly on all peers, one accepted buzz/host award per round and monotonically increasing versions. Confirm the host's player controls and administrative controls are visually separated, and no guest receives any admin control. Inject malformed/stale/duplicate packets in automated tests; browser test is not described as fuzzing unless actually performed.
5. Refresh guest I; verify it resumes as I, with no host privileges and no score rollback. Close a different guest; confirm other connections survive. Reset the host during an open round; all guests become terminal and cannot buzz or become host.
6. For the absolute expiry, unit-test the boundary at 59:59.999 and exactly 60:00 under a controlled clock; then, if feasible, independently verify a **real 60-minute** continuous local session with heartbeat traffic. A fake-clock test alone is not a measured hour of browser/network stability.
7. Record browser/OS versions, CPU and memory during eight simultaneous peer connections, packet/send failures, and sanitized evidence without room codes, tokens, SDP or ICE metadata. Where actual browser constraints block a test, state NOT RUN or BLOCKED.
8. Keep the earlier LAN/different-network, production-runtime and financial gates unchanged. Do not assert universal connectivity or $0 future hosted signaling/TURN costs.

## Sign-off / rollback

Only update the PR to PASS after the scoped unit/type/lint/build checks **and** a real host + eight guests browser run that includes **host A playing and winning**, not merely hosting. Even then, classify LAN, cross-network NAT/TURN, one-hour real-world reliability and deployment separately. If the amendment fails, preserve a clear failure report; do not merge PR #8/#9 or deploy. Rollback is stopping local tabs/Node, disabling the lab flag, and reverting the amendment on the experimental branch after preserving unrelated work. No OCI, payment, email or production data is part of this change.
