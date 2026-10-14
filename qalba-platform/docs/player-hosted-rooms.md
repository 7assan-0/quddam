# Automatic player-hosted rooms — Phase 2

Experimental, local-only lab at `/labs/player-hosted-rooms`, stacked on PR #8 commit `1a944902b9b11846e69667a2a1f6d9a8166d3204`. The manual lab, original games, database, billing and production startup validation are unchanged. This is not a launch or a deployment.

## Run locally

Use Node 24 and the existing lockfile. Dependencies and the generated Prisma client can be reused from the verified PoC checkout. On a fresh checkout run `npm ci` and `npm run db:generate` with a **local dummy** `DATABASE_URL`; neither lab needs a database. Never load a production `.env` for this experiment.

```powershell
cd qalba-platform
$env:ENABLE_PLAYER_HOSTED_ROOMS = 'true'
$env:PLAYER_HOSTED_SIGNALING_ORIGIN = 'http://localhost:3000'
$env:NEXT_TELEMETRY_DISABLED = '1'
# No real payment, mail, cron credentials or production data.
npx.cmd next dev --hostname 127.0.0.1 --port 3000
```

Open `http://localhost:3000/labs/player-hosted-rooms`. Create a room and share the generated link with another local browser tab. A link joins automatically; entering the full room code and selecting Join also works. No Offer/Answer fields are shown. Collapse “دعوة اللاعبين” before taking screenshots. The localhost link is valid only on this computer; sending it to another device does not reach this server.

The feature is OFF by default. Both the flag and an exact configured loopback HTTP origin are required for signaling. The API additionally checks the request URL, Host, Origin and JSON Content-Type. It rejects absent/foreign origins, has no CORS grants, uses no account cookies, and accepts no credential query parameters. Setting a public origin does **not** enable this implementation. The listener must remain `127.0.0.1`; do not use the repository's default wildcard `npm run dev` command for this lab.

```powershell
npm.cmd run typecheck
npx.cmd vitest run src/lib/player-hosted
npm.cmd run lint
npm.cmd run build
```

## Architecture and trust

| Layer | Responsibility |
| --- | --- |
| `rooms/protocol.ts` | Pure four-slot buzzer rules, versioned snapshots, strict BUZZ parser; no React, HTTP or RTC dependencies |
| `rooms/signaling.ts` + isolated API route | Ephemeral rendezvous and leases; exchanges offers/answers only, never scores or game commands |
| `rooms/client.ts` | Abortable same-origin HTTP client; guest-only optional sessionStorage |
| `rooms/controller.ts` | One host-to-each-guest RTC star, explicit lifecycle, game authority at host, state broadcast |
| Separate lab page/component | Create/join/share/connection UX; no change to existing game routes |

The server generates a cryptographically random 128-bit room invite (32 hex characters) and separate 256-bit host/guest capabilities. A room invite admits guests and is a bearer invitation: share it only with trusted participants. It cannot authorize host operations. Capabilities go in bounded POST bodies, never links, cookies, screenshots, console logs or checked-in evidence. Host capability is memory-only and never persisted. Guest-only sessionStorage permits a refreshed tab to resume its assigned slot. Deleting/denying storage loses that continuity; it never promotes a guest. This is capability authorization, not verified user identity or end-to-end authentication against a compromised signaling server.

There are four fixed slots: host A and guests B/C/D. Slots are not recycled during a room, preserving score identity. Leaving does not free a new guest slot; the existing guest can resume with its private capability. There is no host migration, late host takeover, persistence or fairness guarantee against a dishonest host. First arrival at the host wins; network latency affects buzzer fairness. All guests can see all four scores.

Every guest channel is mapped to a slot by the host's authenticated roster. Incoming guest data can only be an exact current-round BUZZ, with no claimed identity, score or host action. The host's local controller is the sole authority for open/award/skip. One winner/award is enforced in pure rules. Snapshots reject malformed values, impossible state ranges, equal/old versions, decreasing rounds and decreasing scores. A new RTC generation cannot roll state back. Existing PoC safeguards remain in place.

## Bounds and cleanup

| Limit | Value / behavior |
| --- | --- |
| Room lifetime | 30 minutes absolute, not extended by activity |
| Host/guest lease | 45 seconds without authenticated activity; host loss deletes room, guest loss marks its slot inactive |
| Expiry sweep | Every 5 seconds per Node process, plus before requests; interval is unref'd |
| Storage | At most 16 rooms × 3 guests; bounded rate table (256 entries); no disk/DB SDP |
| Global requests | 900/minute; create 12/minute; anonymous join 60/minute |
| Capability requests | 180/minute, including polls; signaling writes 24/minute per capability |
| Body / SDP | Actual streamed bytes ≤100,000; SDP string ≤95,000 characters; strict schemas reject extra fields |
| RTC | One ordered reliable channel per host/guest pair; no media permissions; `iceServers: []` |
| RTC setup | ICE gather ≤15s; per-link connection deadline 30s |
| Data channel | String packets ≤1,024 characters; guest intent ≤128; ≤30 received packets/second/link; 64KiB outgoing buffer ceiling |
| Poll / HTTP | One poll in flight, normally every 1s; request timeout 8s; stop after 3 consecutive errors (1s/2s backoff), immediately on 403/410 |
| Retry | Explicit guest retry only, 3 retries/resumes per room slot after initial pairing; fresh generation/epoch, same slot and score; no hidden reconnection loop |

Full ICE is gathered before sending one offer/answer, rather than trickling candidates. Duplicate identical SDP is idempotent; replacement and stale generations are rejected. Host connected acknowledgement removes SDP on both sides of the server's record. Expiry, departure, retry and process exit also clear it. Epoch fencing prevents a delayed old pagehide/leave or old poll from affecting a resumed guest. A guest cannot send offers, target another slot, acknowledge host readiness or delete the host's room.

UI states are idle, creating, joining, waiting, connecting, connected, failed and closed. Disconnect is terminal for that RTC link; other guest links survive. A failed guest gets an explicit bounded retry. Host departure makes all guests unplayable; best-effort keepalive leave deletes the room, with the lease as crash fallback. Server restart loses all rooms. Reset/unmount/pagehide abort pending work, clear timers/listeners, close channels/peers, and prevent stale promises publishing into another session. Reset clears the invite fragment so refresh cannot silently rejoin. Room expiry and signaling failure also freeze gameplay. Keep the host tab/device awake: background throttling, sleep and network loss can expire leases.

## LAN, different networks and cost gate

| Component | Implemented deployment / expected new service spend |
| --- | --- |
| Browser host + guests / RTC | Existing computer, local Chrome, no relay: **$0 service spend** |
| Next HTTP signaling | Existing local Node process, bounded memory, no persistence: **$0 service spend** |
| DB, OCI, signaling hosting, public DNS/TLS | None provisioned or required for the local test: **$0** |
| STUN / TURN / network egress | No configured servers, subscriptions or cloud traffic: **$0** |
| Electricity / owner's existing network | Uses existing hardware/network; this is not a claim of zero physical operating cost |
| Future hosted signaling, TLS, STUN/TURN bandwidth | **UNPRICED / NOT AUTHORIZED**; no Free Trial credit assumption |

Two physical LAN devices were not available in the controllable environment. The shipped API deliberately refuses non-loopback origins. A later LAN test therefore needs a separately reviewed opt-in private-network mode, a shared reachable local HTTPS origin trusted on both devices, and narrow owner-approved listener/firewall access. Do not disable TLS verification, expose the wildcard listener, or edit trust/firewall/hosts automatically. No LAN success is claimed.

For different networks, all clients need a common reachable authenticated signaling endpoint. A future design could run a single small Node process with TLS, exact origins, secure credential delivery, per-client abuse controls and bounded TTL storage; multiple processes would require coordinated state/rate limits. Hosting location, actual ongoing price, egress caps and shutdown behavior must be presented and separately approved before provisioning. No external service or provider is selected here, so its cost is unresolved under the $0 constraint.

STUN can discover candidates and TURN can relay where a direct path fails; STUN alone does not guarantee connectivity. This build does not contact either. The official [WebRTC peer connection guide](https://webrtc.org/getting-started/peer-connections) describes signaling separately from RTC, and the [TURN guide](https://webrtc.org/getting-started/turn-server) explains why many network pairs need relaying. These are design references, not evidence that any remote network was tested.

## Rollback

Stop the local process and close the lab tabs. Its signaling state disappears; no database cleanup or cloud deletion is needed. Clear only the `quddam-guest-room-v2:` keys from that test origin's sessionStorage if desired (no host key exists). Unset the two feature environment variables. Keep the experimental branch/PR draft and unmerged. No certificate, hosts, billing, IAM or firewall settings were changed by this work. To discard code later, switch to the preserved PR #8 branch after preserving any new edits; do not reset unrelated work.

See [actual verification results](player-hosted-rooms-results.md) for the evidence and remaining gates.
