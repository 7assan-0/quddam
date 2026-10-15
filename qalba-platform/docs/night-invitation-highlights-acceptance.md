# ليلة قدّام — planning invitation, RSVP, highlights and share card

**State: implementation submitted for review, NEW HEAD NOT RUN.** This is a draft change stacked on unmerged PR #10, not a release/merge/deployment approval. Earlier Night MVP PASS at `90c98d376d9b727ca704c3e7da91b96e600f2de1` does **not** verify any code in this new branch.

## Scope implemented in this draft

- Organizer-only `/api/night/[id]/invitation` GET/POST and setup section within a **preparing** Night. An invite specifies a local user's chosen time (sent as an offset-aware ISO string) and a validated IANA zone; it must be 15 minutes–90 days away. Creating an invite does not create/start a game, room, credit debit or one-hour Player-Hosted TTL.
- A 256-bit random bearer invitation link is shown **only in its creation response** and stored as SHA-256 token hash, not plaintext. The organizer must copy/save it immediately; this version has no recovery or rotation. The server returns private aggregate attendance counts and per-game vote totals on organizer refresh (also via the dashboard refresh button).
- `/night/invite/[code]` and `/api/night/invite/[code]`: an attendee opens the planning link, enters a pseudonym (2–60 characters), chooses YES/NO, and optionally votes for one of the three Night MVP games. A random separate attendee capability is stored only as hash server-side and delivered as HttpOnly/SameSite=Lax cookie; the same browser updates its own response without multiplying counts. Duplicate normalized names, unsupported votes, extra schema fields, changed aliases, full invitation and rate excess are rejected. Guest list is **not published**; public projection includes only totals, votes and the caller's own response. The vote is **advisory**: the current three-game Night MVP has already fixed its chosen game order when the Night was created; this feature does not silently reorder or change game engines. The link is a bearer invitation: anyone who receives it can respond and clearing cookies permits a different pseudonym. **It is not verified personal identity or an anti-Sybil guarantee.**
- At most **32 unique responses** per invite (not 32 players). Maximum 60 accepted mutations per invite per minute, serialized through a PostgreSQL invitation row lock. Night START and RSVP follow a common NightSession-before-invitation lock order; once play starts, RSVP closes. An expiry check is made after lock acquisition. No social/WhatsApp API calls or unsolicited notifications; organizer manually shares the link.
- A private `GET /api/night/[id]/highlights` derives a truthful recap only after a completed/early-ended Night, using the existing owner-scoped trusted Night view and accepted original-game results. It shows completed-game count, actual top placings, leaders by count and completed champion(s). It makes **no fastest-buzz, AI-generated, demographic or fabricated-event claims**.
- Owner-only `GET /api/night/[id]/share-card` emits an on-demand **1200×630 PNG** after completed Night, with local Noto Sans Arabic font, final champions and normalized scoreboard. No secret answers, room token, RSVP capability, invite code, source session IDs, contact details, external fonts or third-party image service. The organizer downloads and chooses whether/where to share; there is no public card URL or automatic posting.
- The new invitation, recap and card are nested within the existing default-off `ENABLE_NIGHT_OF_QUDDAM` flag. No player-hosted PR #8/#9 code is merged. Nine-player direct gameplay and its one-hour TTL remain a separately reviewed/unmerged transport experiment.

## DB migration

`prisma/migrations/20261016010000_night_invites/migration.sql` is additive. `NightInvitation` stores only invite hash, Night relation, date/zone, limited rate state; `NightInviteGuest` stores hashed browser capability, normalized alias, RSVP and one optional ballot. Night MVP game receipts, payment/credit ledger and historical migrations are untouched.

**Retention not approved/implemented:** before release define purge/export/erasure and link revocation/rotation rules. This iteration is local-only and should not accumulate real personal data. Aliases should be fictitious in tests. Anonymous bearer invitation admits spoofed attendees with distinct aliases even with cookie and bounded capacity; production abuse protection needs a separate approval/gate.

## Routes and privacy

| Route | Authority | Shape |
| --- | --- | --- |
| `POST /api/night/[id]/invitation` | Logged-in Night organizer, preparing only, same-origin | Create one invite, reveal secret once |
| `GET /api/night/[id]/invitation` | Logged-in Night organizer | Schedule, anonymous RSVP counts, never reveal token |
| `GET /night/invite/[code]` | Possession of invite bearer | Noindex, no-referrer, private/no-store page |
| `GET /api/night/invite/[code]` | Possession of invite bearer | Schedule and aggregate votes/counts, own reply via cookie |
| `POST /api/night/invite/[code]` | Possession + exact origin + attendee cookie if resuming | Bound name, YES/NO, one optional game vote |
| `GET /api/night/[id]/highlights` | Logged-in Night organizer | Verified game-derived recap |
| `GET /api/night/[id]/share-card` | Logged-in Night organizer, completed only | Private downloadable PNG |

New HTTP schemas are strict and use the existing bounded 4096-byte Night parser. Different-origin POST is refused before payload handling. Cookie/headers remain secure-in-production and no-referrer; HTTPS/public access has not been tested or enabled. A static bearer invitation URL can still be forwarded by a recipient; sharing is a deliberate user action.

## Required acceptance — DO NOT claim PASS from writing the tests

Run on a clean copy of the **exact new branch SHA** with synthetic accounts and a freshly created loopback PostgreSQL 17 database only; never migrate an existing production DB.

```sh
cd qalba-platform
npm ci
npm run db:generate
npm run db:migrate
npx vitest run src/lib/night/invitation.test.ts src/lib/night/highlights.test.ts src/app/api/night/invitation.route.test.ts src/proxy.test.ts src/components/night-of-quddam.test.tsx --reporter=verbose
npm run test
npm run typecheck
npm run lint
npm run build
```

The migration command above is permitted **only when DATABASE_URL points at a new isolated test database**. Read the prior Night MVP report for synthetic PostgreSQL fixture conventions. Extend and rerun its integration harness with:
1. Authenticated organizer creates one invite while Night is preparing; non-owner and missing login see no event info; cross-origin/oversized/unknown fields are rejected. Distinct requests cannot create two invites for one Night. Saving the secret link once and refreshing organizer must not re-expose it.
2. Visit actual link from a separate anonymous Chrome context: submit first YES + `top-list` vote, refresh (same cookie), switch ballot to `survey-show` and then NO (clears its vote); aggregates and `mine` update once, without duplicating an attendee. Another Chrome context cannot see their alias.
3. Fill all 32 RSVP slots with distinct synthetic browsers/aliases and verify the 33rd is rejected. Test normalized duplicate names, malformed/bidi inputs, irrelevant slugs, an extra `host`/points field and the 60-per-minute server mutation bound.
4. Race an RSVP transaction against Night START using independent PostgreSQL connections. Once START commits, no new ballot is accepted. Test the invitation expiry at the boundary under a controlled clock *after lock acquisition*. Invitation scheduling must **not** allocate a live game room, debit credits or begin the P2P TTL.
5. Complete the original three Night MVP games through their existing engines and UI. Observe recap of the **real** score, actual game champions and owner-only PNG rendering in a real browser. Verify the PNG's Arabic glyphs, size, private cache headers, no private answers/IDs/invite tokens, browser download and no auto-publication.
6. Test tied champions and early-ended Night: no fabricated sole champion, no share card for early-ended Night. Unrelated accounts see 404 (or applicable owner-scoped denial) for recap/image; unauthenticated users see 401.
7. Test reload, process restart and default-off 404 for invitation pages/APIs. Check standalone game pages, original START-only credit debits, legacy room and P2P isolation, source binding, and full Vitest regression.
8. Record actual Chrome/version, migration and PostgreSQL counts, JS/HTTP failures, financial scope and source SHA. Never commit real invite code, attendee cookies, capability, answers, HAR or raw browser trace into evidence.

**Current verification at authoring:** code and scoped test files added; **TypeScript/Vitest/PostgreSQL/Chrome/Lint/Build on the new head: NOT RUN** because a connected source checkout with installed dependencies is unavailable in this tool environment. A hosted *financial-only* success does not replace them. If a check fails, fix the draft branch and rerun exact-head acceptance. PR must remain Draft.

## Remaining before launch

- Implementation and evidence of retention/deletion, organizer invite revocation/rotation, real abuse handling and optional notifications (none is enabled here).
- Separate production runtime/security, LAN and cross-network/NAT and authorized cost reviews, compatibility with approved transport, and existing finance/release gates.
- No AI/media generation service, video highlight, automatic WhatsApp sending, new pricing, real payment/email, OCI or TURN. Incremental external-service spend **$0**.
