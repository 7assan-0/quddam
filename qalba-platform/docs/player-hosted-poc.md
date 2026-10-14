# Quddam Player-Hosted WebRTC laboratory (not production)

This is a **separate, opt-in proof of concept**. It does **not** migrate the existing Lightning, room, billing, identity, SSE or PostgreSQL services to P2P. Do not equate this with commercial launch readiness. No OCI resources, TURN service, hosted signaling, database migration, new paid resources or real payment flows are involved.

## Enable locally

1. Install dependencies with `npm ci` and generate the existing Prisma client with `npm run db:generate`. Generation needs a syntactically valid `DATABASE_URL`, but does not connect to PostgreSQL; a disposable local placeholder suffices. No database migration, seed or database server is required for this lab. Do not load production environment files or credentials.
2. Set `ENABLE_PLAYER_HOSTED_LAB=true` in the local process environment, then run `npx next dev --hostname 127.0.0.1 --port 3000`. Visit `http://localhost:3000/labs/player-hosted` in two independent browser windows, Host/Team A and Guest/Team B. Do not use the ordinary development command's wildcard listener for this loopback acceptance test. Never commit `.env` files. Two-device LAN testing requires a separately prepared trusted secure origin and device access; it is a distinct test, not implied by two windows on one computer.
3. In tab A, select **Host**. Wait for ICE gathering to finish, copy the complete JSON Offer. In tab B, select **Guest**, paste the offer, select **Create answer**, and copy the complete JSON Answer back to tab A. In tab A, paste Answer and select **Confirm**. Both pages should show Connected; if not, stop and record the browser/network conditions rather than retrying indefinitely.
4. On the host, open a round. Press Guest buzzer in B and Host buzzer in A: the **first message processed by the host** wins. Only the host can award one point or skip the round. Open a new round and verify stale and duplicate buzzes are ignored.
5. Close/refresh the host. The session intentionally ends; no migration, persistence or host election exists. Reset both pages to start again. Also reset while ICE is gathering, then start another session: old callbacks must never restore old SDP, connection status or scores. Malformed JSON can be corrected before a peer is created; a browser SDP failure or connection/ICE timeout ends that session and requires reset.

## Lifecycle and authority

- A disposable `LabSession` owns exactly one peer, one reliable ordered DataChannel, an abortable 15-second ICE wait and a 120-second post-answer connection deadline that leaves time for manual copy/paste. Reset, unmount, pagehide, disconnect, channel error and terminal setup failure close resources, detach handlers and clear timers. An old controller cannot publish into a new React session.
- Both incoming guest intents and local host actions require a live connected peer/channel. The guest controller cannot execute host actions, and guest wire packets can only be bounded `BUZZ` intents for the current round. One host lock and one award are allowed per round; the next round keeps scores and clears the winner.
- Snapshot parsing rejects coerced phases, impossible score/round/version combinations and excessive versions. The guest accepts the initial version once, then strictly newer versions without score or round rollback. Equal-version replacements and older packets are ignored.
- Connection descriptions are cleared from application state after connection or session end. Do not save/capture SDP before then; it contains private ICE metadata. The interface displays the accepted state version for comparing host/guest synchronization.
- Limits remain 100 rounds, one guest, no automatic reconnect, no host migration, no persistence and no protection against a dishonest host. Disconnect ends the experiment conservatively rather than attempting to recover scores.

## Privacy/security boundaries

- No signaling backend: SDP is transferred **manually**. Treat SDP as private connection metadata (ICE addresses/credentials). Share only with the intended trusted peer, not through public chats, logs, screenshots, URL parameters or GitHub.
- `iceServers: []` means **no third-party STUN or paid TURN**. Loopback and some local networks may work; connecting across NATs, mobile networks or different ISPs is **not guaranteed**. No zero-cost internet-wide connectivity is claimed.
- Only one trusted guest is accepted. Host state is exclusively computed in host browser; guest messages are restricted to `{type:"BUZZ",round:n}`. The host validates round, phase, duplicate locks and packet size. Guest snapshots are checked and older versions are ignored. WebRTC DataChannel encrypts transport, but this PoC has **no independent player identity** or anti-cheat against a dishonest host, and manual SDP does not authenticate peer identity.
- Host browser remains authoritative for the PoC but is **not** trusted like a production server. No real credits, questions with paid access, personal records, payments, ranking or persistent scores may be passed over this channel.
- Feature flag is opt-in and the route is `noindex`. Do not enable it in a public/production deployment or add it to regular navigation.
- No question content or production APIs are invoked by this lab. Real game engines remain untouched. Closing the host closes the game.
- No relay, reconnect recovery, backgrounding guarantees, fairness/latency equivalence, abuse protection or multiple guests are implemented.

## Local checks / acceptance

- `npm ci`
- `npm run typecheck`
- `npx vitest run src/lib/player-hosted/lab.test.ts src/lib/player-hosted/session.test.ts`
- `npm run lint`
- `npm run build`
- Manual: secure-origin access, Offer/Answer exchange, initial state sync, valid guest buzz, duplicate/stale rejection, host-only score, connection loss/close, no writes to PostgreSQL and no activation without feature flag.
- Cross-network connectivity requires a separately reviewed signaling/STUN/TURN design, security review, bandwidth and cost proof, and explicit approval. This PoC does **not** unblock the OCI staging NO-GO.

The session tests use lifecycle doubles; passing them does not demonstrate native ICE/DTLS/SCTP connectivity. Record real-browser, two-device LAN and cross-network results separately, including untested environments.
