# Beta room integration review and approval gates

This is a source comparison and an unexecuted integration plan, prepared on 2026-10-16 for the Beta completion sprint. It does not merge branches, approve a network change, or inherit a browser/test PASS from an earlier PR. Current-sprint execution results belong in the Beta verification report. No application code, game engine, billing policy, previous migration or historical release evidence was changed for this review.

## Independently observed branches

GitHub's PR API and freshly fetched literal Git refs agreed during this review:

| Item | Inspected SHA | State / relationship |
| --- | --- | --- |
| main | `c5fbb232fb1fa54b5b3128c80b8dafa33cc79e7d` | Common ancestor of the two development tracks |
| PR #8 | `1a944902b9b11846e69667a2a1f6d9a8166d3204` | Base of PR #9 |
| PR #9 | `ca25d2e9dd51dc806f0591ff199aeb711b694806` | Draft, open, unmerged; branch `experiment/player-hosted-auto-rooms` |
| PR #10 | `90c98d376d9b727ca704c3e7da91b96e600f2de1` | Night foundation, ancestor of PR #12 |
| PR #12 | `35d970c3b91246e850dda23b6adeee93213889b6` | Base of PR #13 |
| PR #13, review starting point | `e0474a685b3892525f4ddecd26be497a5d3045dc` | Draft, open, unmerged; branch `feature/shillatak-private-leaderboard` |

The main→PR #9 delta has **36 added paths**. The main→starting PR #13 stack has **90 changed paths**. Their changed-path intersection is empty. PR #9 changes neither the package manifests/lockfile nor Prisma/migrations. This substantially reduces immediate textual conflict risk; it does not establish application compatibility. Counts describe these recorded commits, not an assumed future head.

Reproduce the read-only comparison after fetching the actual refs; replace the PR #13 SHA with any newer reviewed head. `GIT_NO_REPLACE_OBJECTS=1` disables Git replacement objects for these reads:

```sh
GIT_NO_REPLACE_OBJECTS=1 git merge-base ca25d2e9dd51dc806f0591ff199aeb711b694806 e0474a685b3892525f4ddecd26be497a5d3045dc
GIT_NO_REPLACE_OBJECTS=1 git diff --name-status c5fbb232fb1fa54b5b3128c80b8dafa33cc79e7d...ca25d2e9dd51dc806f0591ff199aeb711b694806
GIT_NO_REPLACE_OBJECTS=1 git diff --name-status c5fbb232fb1fa54b5b3128c80b8dafa33cc79e7d...e0474a685b3892525f4ddecd26be497a5d3045dc
```

No `git merge`, rebase, cherry-pick or application-file import from PR #9 was performed in this review.

## There are three different room/participation models

| Model | Actual current behavior | Integration consequence |
| --- | --- | --- |
| Existing database `Room` | `prisma/schema.prisma:477` associates a six-character code with one `GameSession`. `src/lib/rooms/service.ts:30` permits only `category-board`; line 38 sets a fixed **8-hour** expiry, line 65 rejects the host joining as a participant, and line 67 caps participants at **20**. Its UI uses HTTP/SSE/fallback polling, not RTC (`src/components/room-live.tsx:18`, `src/lib/realtime/client.ts:38`). | This is an implemented category-board path, not a nine-player Player-Hosted/Night room. Do not globally replace its capacity, expiry or host policy with experimental rules. |
| PR #9 automatic Player-Hosted laboratory | Nine individual scores; host A is slot 0 and guests occupy 1–8. Protocol payload is version **3**, channel label remains `quddam-rooms-v2`, and guest storage prefix is `quddam-guest-room-v3:`. Those are separate identifiers, not a schema mismatch. Host opens/awards/skips; a guest can only send bounded `BUZZ` for the current round. | This is a standalone buzzer/score transport demonstrator, not any of the original three game engines and not a persistent Night result source. |
| Night / invitations / Shillatak | `NightSession` orchestrates exactly three original game slugs and two fixed teams. `NightInvitation` is planning/RSVP, and `ShillaMembership` represents authenticated site accounts. Neither RSVP aliases nor RTC slots are group members or game authorities (`prisma/schema.prisma:1167`, `:1213`, `:1244`). | A planning link, RSVP cookie, group membership or RTC capability must never become host authority, a game controller token, or an accepted result receipt. |

PR #9 references below are pinned to its reviewed commit because those files intentionally do not exist in PR #13:

- [Capacity, nine scores, strict BUZZ and snapshot validation](https://github.com/7assan-0/quddam/blob/ca25d2e9dd51dc806f0591ff199aeb711b694806/qalba-platform/src/lib/player-hosted/rooms/protocol.ts#L3): `MAX_PLAYERS=9`, `MAX_GUESTS=8`, protocol 3; one accepted buzz locks a round and one award increments the winner once.
- [Fixed TTL and bounded signaling](https://github.com/7assan-0/quddam/blob/ca25d2e9dd51dc806f0591ff199aeb711b694806/qalba-platform/src/lib/player-hosted/rooms/signaling.ts#L5): creation+3,600,000 ms, 45-second host lease, eight lifetime guest allocations, maximum three retry/resume increments. Leaving does not allocate a new replacement seat beyond those original eight. `:44` states the in-memory single-process model; `:73`–`:89` enforce capacity/expiry.
- [Explicit loopback-only HTTP origin gate](https://github.com/7assan-0/quddam/blob/ca25d2e9dd51dc806f0591ff199aeb711b694806/qalba-platform/src/lib/player-hosted/rooms/signaling.ts#L135): HTTP `localhost`, `127.0.0.1` or `[::1]` only, exact configured/request/Host origins, no CORS. Flag-on does not make it usable at a private LAN address or public hostname.
- [Controller authority, teardown and zero external ICE servers](https://github.com/7assan-0/quddam/blob/ca25d2e9dd51dc806f0591ff199aeb711b694806/qalba-platform/src/lib/player-hosted/rooms/controller.ts#L19): host-owned star with eight RTC links, `iceServers: []` at `:34`; original-expiry checks/timer at `:42`–`:55`; bounded inbound packets at `:105`–`:125`; role checks at `:273`–`:292`; terminal abort/close at `:294`–`:308`.
- [Guest-only browser persistence](https://github.com/7assan-0/quddam/blob/ca25d2e9dd51dc806f0591ff199aeb711b694806/qalba-platform/src/lib/player-hosted/rooms/client.ts#L27): host credentials are not stored. Guest rejoin restores its slot using its scoped capability; it does not promote to host.
- [Host pagehide closes the room; independent game controls](https://github.com/7assan-0/quddam/blob/ca25d2e9dd51dc806f0591ff199aeb711b694806/qalba-platform/src/components/player-hosted-rooms.tsx#L41): host refresh/departure destroys authority; admin and host-player buzzer controls are separate at `:110`–`:123`. The UI itself labels the experiment local and nonpersistent at `:96`.

## Confirmed semantic gaps and blockers

1. **A simple branch combination cannot deliver nine-player Night.** `src/lib/night/service.ts:94`–`:103` creates canonical ranked/ordering/survey `GameSession` records and a two-team mapping. `src/lib/night/adapters.ts:23`–`:37` requires the same owner, completed first match, credit-consumption marker, matching state/team scores, normal command history and all **5 / 7 / 5** original rounds. PR #9 has no database session, team mapping, original questions or server receipt. Accepting its client scores would weaken the result trust boundary and is explicitly excluded.

2. **Existing game controls differ.** Ranked and survey commands are host-authorized (`src/lib/games/ranked/service.ts:33`, `src/lib/games/survey-battle/service.ts:54`–`:66`). Ordering additionally has permissioned per-team controller capabilities (`src/lib/games/ordering/service.ts:18`–`:23`, `:81`–`:97`). Eight generic RTC guests cannot currently issue the original games' individual/team actions. Showing the P2P lab alongside Night would leave these flows separate, not integrated.

3. **Browser-hosted authority is unsuitable as a replacement for verified persisted results.** The host processes its own buzz locally and remote buzzes after transport latency, and controls awards. A first *accepted* guest buzz cannot subsequently be replaced by the normal host action path, but that is not neutral competitive fairness or proof against a modified host. Night, highlights and Shillatak must continue to derive from authoritative canonical results, not a client-provided winner or score.

4. **Remote availability is unimplemented.** The signaling gate deliberately refuses nonloopback origins; no STUN/TURN is configured. A single-machine RTC success does not prove LAN, carrier NAT, different networks, mobile suspension or Internet joining. Moving signaling to a public host, relaxing its origin policy, adding ICE services, TLS trust changes or network listeners requires a separately reviewed owner-approved plan. Free trials are not a budget plan.

5. **Lifecycle policies conflict.** A P2P room ends at creation+60 minutes, host departure, a lost host lease or signaling process restart. Night has persisted game progress, its own original engine timers and no matching one-hour room identity. Guest reload is bounded to the original seat and expiry; host refresh cannot recover the room. Decide how a room expiry during a canonical game affects the user interface and reconnect path before integration. It must not silently restart Night, delete accepted results, transfer host authority, bypass a paid START or add an extra credit debit.

6. **There is no approved combined candidate or evidence.** Historical PR #9 / #10 / #12 receipts describe their named heads and scopes. The current PR #13 Beta tests can verify the Night/Shillatak stack; they cannot prove a nonexistent P2P adapter, a merged build, or remote nine-player play. A combined successor must get a fresh exact-head source inventory and fresh tests.

Text conflicts may appear later in navigation/layout, `proxy.ts`, flag wiring, API authorization, privacy headers, test setup and package versions once an integration actually touches them. Review semantics even if Git reports a conflict-free patch. No known dependency upgrade or additional Prisma migration is necessary merely to keep PR #9 isolated; persistence/identity changes for an actual adapter would need their own reviewed design and migration.

## Proposed small, reviewable integration sequence — not executed

1. **Approve a Beta participation contract.** Owner chooses whether the first private Beta is a host-led shared-screen Night with existing display/controller links, or requires all nine players to join the three games independently. Keep the latter **NO-GO** until the adapter/network gates below pass. Confirm fixed teams/seat assignment, host-as-player behavior per game, disconnect/expiry policy and permitted local/network test scope. This is a product/authority decision, not a cosmetic navigation fix.
2. **Freeze prerequisite heads and inspect a proposed combination.** Once separately approved, create a new integration branch from the actual approved Night/Shillatak head. Review the full main→PR #8→PR #9 dependency chain, not only PR #8→PR #9. Preserve every historical receipt and existing game/payment behavior. Owner approval to perform this step is still required; no merge is authorized by this document.
3. **Add only an isolated lab entry, behind its existing default-off flag, if useful.** Keep its route, capabilities, storage, scores and loopback gate separate. Re-run all transport/browser tests and flag-off HTTP tests. This PR would establish coexistence only and must say so in its title and evidence.
4. **Implement one narrow canonical participation adapter after design approval.** Start with one original game and strict server-side session/team/seat authorization, bounded allowed intents, idempotency keys and source versions. Preserve original commands and result verification. Specify private versus public projections and never send answer-bearing host state to generic guests. No new pricing, no automatic score import and no generic host-capability reuse.
5. **Extend that approved adapter to the other two games.** Preserve Ordering's private per-team order and revision controls; verify Ranked/Survey host adjudication remains explicit. Prove reconnect/stale-message isolation across game transitions. Only then connect the Night UI to the approved room contract; RSVP remains planning and must not start a room's 60-minute timer or consume credits.
6. **Review and execute networking as a separate gate.** First test loopback; then obtain approval for the exact LAN listener/origin/HTTPS/certificate/firewall plan and two real devices. Different-network testing needs an explicit signaling/NAT/ICE plan and $0 ongoing-cost evidence. Do not add public signaling or STUN/TURN opportunistically.
7. **Freeze a combined successor and rerun every affected gate.** Inventory committed source bytes/modes, exact tooling/head, migrations on a new isolated PostgreSQL 17 database, full unit/type/lint/build, native database concurrency/financial acceptance, Chrome, rollback/restart and privacy. Attach sanitized evidence tied to that combined head; keep PRs Draft and unmerged for owner review.

The target of 14 days is a conditional scheduling target, not an engineering guarantee. Existing host-led Night plus invitations/Shillatak can be evaluated now in the isolated sprint environment. Nine-player cross-network integration cannot be promised within that window while its participant authority, room lifecycle and networking decisions remain unapproved.

## Required verification matrix after any approved combination

All rows below are **NOT RUN on a combined source**, because no such source was created. Current-sprint tests on the separate Night/Shillatak stack must be listed separately in the Beta report.

| Gate | Reproducible acceptance criteria | Network/evidence scope |
| --- | --- | --- |
| Clean combined candidate | Exact commit and tooling IDs; committed byte/mode inventory before/after; `npm ci`, Prisma generate, isolated fresh PG17 migrations, full Vitest, typecheck, lint and production build | Build success is separate from successful server execution |
| Nine real RTC participants | Actual Chrome, host A + B–I in independent contexts, eight native host RTC connections; link and code joins; extra guest rejected without disturbing the nine | Same-device loopback only first; no simulated RTC PASS |
| Host participation and ordering | A buzzes, wins and receives one point; accepted guest buzz remains first even if host subsequently buzzes; duplicate buzz/award cannot change version/score | Transport lab evidence remains separate from canonical engine scoring |
| State integrity | Nine score slots and monotonic version/round/score snapshots; stale/malformed/oversized/spoofed intents rejected; same seat after guest I reload; no guest admin/host capability | Never publish raw invite code, capability, SDP, ICE, cookie, answer or private controller state |
| Fixed expiry and cleanup | 59:59.999 still eligible, 60:00 closed using injected test clock; delayed async continuations cannot revive authority; timer/channel/request cleanup; fresh room starts at zeros | Synthetic clock result is separate from a real-hour run; report actual elapsed time and setup time for an optional soak |
| Disconnect/restart | One guest leaves without ending other links; host closure during open round disables all guests; restart closes ephemeral lab room while persisted Night results/credits survive; no automatic authority transfer | Current lab does not promise host recovery; test and communicate that behavior |
| Original three games | Full 5 Ranked + 7 Ordering + 5 Survey rounds through their real controls; two fixed team identities; private Ordering data separated; normal final/tied/early-end handling | A generic BUZZ demo is insufficient |
| Night→share→Shillatak | Only canonical completed receipts imported once; originals unaffected; correct totals/ties/highlights/PNG; one immutable group attachment; no invented guest/client scores | PG17 assertions and real HTTP/Chrome evidence |
| Financial safety | Original START charge once per child; duplicate START/network retries not charged twice; planning, join, RSVP, sharing, group operations and result imports add no debit | Synthetic wallet and ledger deltas; scoped evidence is not live merchant approval |
| Flags/authorization/privacy | Default-off pages and APIs unavailable; stranger/other owner/RSVP cookie/RTC capability cannot manage Night or Shillatak; same-origin/size/rate rules persist | Public pages, APIs and browser caching/referrer behavior checked separately |
| Two-device LAN | Two real browser devices, mobile/desktop inventory, approved secure context and local origin, host eight connections if equipment permits | **NOT RUN**; no listener/firewall/certificate change authorized here |
| Different networks/NAT | Real distinct networks including restrictive/mobile NAT; defined failures/rejoin; chosen relay/signaling capacity/cost/security review | **NOT RUN**; no public signaling/STUN/TURN/resources approved |
| Host performance | Actual host-page CPU delta and heap samples under eight links; label renderer/page versus total machine; count runtime errors, do not invent numbers | Fresh measurements required; historical measurements cannot be copied as current results |

## Current-sprint standalone PR #9 execution — separate source

To check what already works without combining branches, the sprint also executed a new normal clone of exact PR #9 head `ca25d2e9dd51dc806f0591ff199aeb711b694806`, in a private temporary directory. The existing PR #9 checkout remained clean and unchanged. Dependencies were copied into the new clone only after both `package.json` and the lockfile were verified byte-identical; this was dependency reuse, **not a new `npm ci` execution for PR #9**. No production dotenv files or real data were loaded. `DATABASE_URL` named an intentionally unreachable synthetic loopback database on port 1; no database migration was run for the laboratory.

Executed in that separate clone:

```sh
npm run db:generate
node node_modules/vitest/vitest.mjs run src/lib/player-hosted --reporter=verbose --reporter=json --outputFile=/absolute/private/unit.json --maxWorkers=1 --retry=0
npm run build
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3010
```

The built local server used `ENABLE_PLAYER_HOSTED_ROOMS=true` and exact `PLAYER_HOSTED_SIGNALING_ORIGIN=http://localhost:3010`. Its page returned HTTP 200. This was successful local execution of `next start`, separate from build success and from any production launcher, HTTPS or deployment validation.

The committed browser runner hardcodes port 3000. An **external** copy adapted only its exact loopback-port assertion to 3010, module/app-root resolution and the external-harness identity label. Its gameplay, security, clock and native-RTC assertions were unchanged. Runner SHA-256: `c0b501dc3c282846c61347e25bbecaf776ccf847cbd9058cf240c4a19e24b2ca`. Application files and the committed runner were not edited. With actual Google Chrome for Testing **155.0.8059.79** / Playwright **1.56.1**, `BASE_URL=http://localhost:3010`, that copy was run with `--clock-boundary` and an external private evidence directory.

| Newly executed standalone gate | Actual result |
| --- | --- |
| Prisma generate | PASS, exit 0 |
| Player-Hosted unit inventory | **75 passed / 0 failed / 0 skipped, 5 files** |
| Fresh production build | PASS, exit 0; 33.220 s |
| Actual built local Next server | PASS, loopback page HTTP 200; no execution-policy refusal |
| Real Chrome/native RTC | **56 successful assertions / 43 state checkpoints**, exit 0; 35.776 s |
| Nine players and original lab behavior | Host A + eight guests connected; link/code admission; excess guest rejected 409; A earned a point; accepted guest remained first; duplicate awards/buzzes ignored; all nine scores became one at version 27; I reloaded into its same seat without admin; guest departure, host closure, fresh-room zeros and same-page reset passed |
| Synthetic browser clock | PASS: eligible at creation+59:59.999, closed at 60:00 with native links; server clock unchanged |
| Real 60-minute soak | **NOT RUN** in this sprint |
| Flag-off restart | API denied creation with **404**, page rendered the not-found boundary with no lab heading/create control. The streamed document's status was **200**, with a `NEXT_HTTP_ERROR_FALLBACK;404` digest. A prior probe demanding HTTP 404 for both failed; it is not presented as a strict-404 PASS. Functional unavailability passed; document status remains a soft-404 limitation. |
| Literal committed source before/after | PASS, direct Git-object byte/mode/inventory comparison; source fingerprint `c75d2bd8e4b52ee0d9139d9687e3219932c90b67d32fc761c1e75ed15d616b48`; only a verified Next-generated import-path difference was restored in the temporary clone |
| LAN / distinct NAT / combined Night play | **NOT RUN**; no listener/trust/firewall/ICE policy was relaxed |

Measured host CDP samples are **page/renderer scope**, not machine CPU/RSS. Across an idle 3.002-second interval with eight connections, ProcessTime delta was 0.030 s (**0.999% of one core**) and ThreadTime delta 0.009262 s (**0.308%**); JS heap used was **5,395,552 bytes**. Across 6.214 seconds of nine-round gameplay and I's reconnection, the corresponding values were 0.800 s (**12.874%**) and 0.430565 s (**6.929%**); JS heap used was **6,820,948 bytes**. These short observations are not a load/capacity guarantee.

The runner recorded **0 page JavaScript exceptions**, **7 console-error counts** alongside one expected overflow 409 and six terminal 410 responses, and **98 `net::ERR_ABORTED` request failures**. Only safe categories/stages were retained; raw request URLs/messages were intentionally not saved. Do not describe this as zero network/console errors or infer that every aborted request was individually diagnosed. The screenshots mask invitation fields; the nine-score screenshot was visually inspected and showed A–I each on one point with 8/8 guest links. All owned port-3010 server processes were stopped afterward. External-service cost was **$0**.

This fresh standalone result confirms the present laboratory on one machine. It does **not** change the combined-source matrix above, verify the current PR #13 head, or supply the missing original-game adapter/networking contract.

## Decision

**NO-GO for an integrated nine-player remote Beta on the present branches.** They implement distinct participation models; neither a textual patch comparison nor prior local evidence supplies the missing adapter, lifecycle policy or remote-network validation. **PARTIAL** is the appropriate integration status for this sprint's read-only comparison and safe plan. A decision about a narrower host-led private Beta must use the separately executed PR #13 gates and the owner's accepted Beta scope. No production-readiness or merge approval is implied.
