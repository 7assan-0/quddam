# Beta blocker remediation — execution gate (2026-10-16)

Base: PR #13 exact head `ceda2b45671db560f887df836367edcb4da2788f`. This branch is isolated; no merge, deployment, billing or infrastructure changes.

## Verified baseline
PR #13 reports full Vitest 1480/1480, native PG17 and Chrome passes. Production dependency audit: two affected High package nodes; all-dependency audit: fourteen affected nodes (one Critical). These are baseline claims from the source-bound report, **not rerun on this branch**.

## Work gates and acceptance
1. Dependencies: capture exact `npm audit --omit=dev --json` and `npm audit --json` on a clean install, identify vulnerable dependency paths, available nonbreaking fixes and compatibility. Modify package manifest and lockfile together, no blind `npm audit fix --force`. Re-run clean install, production audit, full Vitest, Prisma generate, typecheck, lint, build, PG17 and affected browser tests. No PASS until evidence is attached.
2. Rate limits: inventory public authentication, invitation, room JOIN, RSVP, signaling, redemption and other write endpoints; document key scope, time source, per-instance versus shared state, fail-closed behavior and proxy trust. Add bounded concurrency, expiry, restart and bypass tests before changing behavior. Do not claim in-memory per-process limits protect a multi-instance deployment.
3. Data governance: specify retention periods, deletion/export behavior, ownership transfer, historical immutable results and legal/operational approval owner. Do not implement destructive migrations or promise compliance without approved policy.
4. PR #9: independent WebRTC lab is not a Night adapter. Keep canonical server results authoritative. Decide participation model (shared-screen host-led versus nine independent players), lifecycle and host authority first. Loopback-only origin gate and empty ICE server list remain unchanged without explicit networking approval. Create a separate combined candidate only after product contract approval and re-run tests on its exact SHA.

## No-GO gates
Cross-device LAN, distinct-network NAT, six other complete games, approved privacy policy, dependency production audit and integrated PR #9/Night source are NOT RUN / NOT APPROVED until separately evidenced. Historical tests cannot be inherited by a combined commit.

## Change policy
Draft only. Never merge main, publish environment, open a public listener, enable payment, change live data or create cloud resources without owner approval. Preserve previous evidence and record exact SHA for each new test run.

## Approved participation direction
The owner selected both shared-screen play and individual phone participation through one QR/code room. The authoritative server owns identity, allowed actions, round state, scores and credits. Peer-to-peer transport is optional and must not be a prerequisite for participation or a source of official results. Target capacity is 20 participants plus host, subject to measured acceptance; current category-board and nine-seat lab limits remain distinct until a new implementation is tested. Keep the PR #9 experiment isolated and default-off. No network exposure or deployment was approved by this product decision.

## Dependency remediation procedure
Run from a disposable checkout of the exact PR head in qalba-platform. Record command exit codes independently and keep raw audit output outside Git:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm audit --omit=dev --json
npm audit --json
npm ls --all
```

Review affected production dependency paths and the smallest compatible patched versions. Change manifest and lockfile together; do not use a forced major upgrade or suppress nonzero audit exits. Then repeat a normal clean install, Prisma generation, full unit suite, TypeScript, lint, build and affected PostgreSQL/browser acceptance. A new audit result and exact-head evidence are required before changing the blocker status.
