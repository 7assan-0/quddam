# Quddam Player-Hosted WebRTC laboratory (not production)

This is a **separate, opt-in proof of concept**. It does **not** migrate the existing Lightning, room, billing, identity, SSE or PostgreSQL services to P2P. Do not equate this with commercial launch readiness. No OCI resources, TURN service, hosted signaling, database migration, new paid resources or real payment flows are involved.

## Enable locally

1. Install project dependencies with the existing lockfile and run the platform as usual, on `http://localhost:3000` (or a locally trusted HTTPS origin). In `qalba-platform/.env.local` set `ENABLE_PLAYER_HOSTED_LAB=true` for local testing only. Never commit .env files.
2. Visit `/labs/player-hosted` in two separate tabs or two trusted browsers on the same device (loopback), or try two machines on the same local network with a secure browser origin.
3. In tab A, select **Host**. Wait for ICE gathering to finish, copy the complete JSON Offer. In tab B, select **Guest**, paste the offer, select **Create answer**, and copy the complete JSON Answer back to tab A. In tab A, paste Answer and select **Confirm**. Both pages should show Connected; if not, stop and record the browser/network conditions rather than retrying indefinitely.
4. On the host, open a round. Press Guest buzzer in B and Host buzzer in A: the **first message processed by the host** wins. Only the host can award one point or skip the round. Open a new round and verify stale and duplicate buzzes are ignored.
5. Close/refresh the host. The session intentionally ends; no migration, persistence or host election exists. Reset both pages to start again.

## Privacy/security boundaries

- No signaling backend: SDP is transferred **manually**. Treat SDP as private connection metadata (ICE addresses/credentials). Share only with the intended trusted peer, not through public chats, logs, screenshots, URL parameters or GitHub.
- `iceServers: []` means **no third-party STUN or paid TURN**. Loopback and some local networks may work; connecting across NATs, mobile networks or different ISPs is **not guaranteed**. No zero-cost internet-wide connectivity is claimed.
- Only one trusted guest is accepted. Host state is exclusively computed in host browser; guest messages are restricted to `{type:"BUZZ",round:n}`. The host validates round, phase, duplicate locks and packet size. Guest snapshots are checked and older versions are ignored. WebRTC DataChannel encrypts transport, but this PoC has **no independent player identity** or anti-cheat against a dishonest host, and manual SDP does not authenticate peer identity.
- Host browser remains authoritative for the PoC but is **not** trusted like a production server. No real credits, questions with paid access, personal records, payments, ranking or persistent scores may be passed over this channel.
- Feature flag is opt-in and the route is `noindex`. Do not enable it in a public/production deployment or add it to regular navigation.
- No question content or production APIs are invoked by this lab. Real game engines remain untouched. Closing the host closes the game.
- No relay, reconnect recovery, backgrounding guarantees, fairness/latency equivalence, abuse protection or multiple guests are implemented.

## Local checks / acceptance

- `npm run typecheck`
- `npx vitest run src/lib/player-hosted/lab.test.ts`
- `npm run lint`
- Manual: secure-origin access, Offer/Answer exchange, initial state sync, valid guest buzz, duplicate/stale rejection, host-only score, connection loss/close, no writes to PostgreSQL and no activation without feature flag.
- Cross-network connectivity requires a separately reviewed signaling/STUN/TURN design, security review, bandwidth and cost proof, and explicit approval. This PoC does **not** unblock the OCI staging NO-GO.
