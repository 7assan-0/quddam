# ليلة قدّام — approved feature programme (experimental)

**Product decision:** Build the following as a coherent experience, in small reviewed changes:
1. **ليلة قدّام**: a night of at least three selected launch games, one stable participant/team roster, normalized cumulative points and a final "بطل الليلة" screen.
2. **وضع الجمهور**: non-player attendees can spectate, make controlled predictions/votes, and (only in explicitly supported games and modes) influence a displayed audience result.
3. **شلّتك ولوحة الشرف**: an opt-in recurring friend group, night history and aggregate trophies.
4. **دعوة السهرة**: a planned event link (date/time, RSVP "جاي", game nominations/vote) shared manually via e.g. WhatsApp.
5. **هايلايتس السهرة**: derived from *actual* game events and timings (never invented metrics); a readable end-of-night recap.
6. **بطاقة مشاركة السهرة**: a sanitized generated image with champion/points/awards, without invite tokens or private answers.
7. **أسئلة جماعتك**: host-supplied questions isolated to the night, initially opt-in for `survey-show` and `bluff`; no silent publication to the global bank.

**Explicit exclusions — do not implement:** seasonal/occasion packs; the Gulf announcer/TTS/AI announcer; session mode presets such as family/friends/school. No pricing, new paid night pass, real payment, promotional credits, hosted deployment or new paid service is authorized by this programme.

## Reality check and dependencies

- The ten *official* games are enumerated in `src/lib/games/launch-policy.ts`. They do not share one generic creation/finish adapter; the three legacy generic games are blocked for new sessions. Never route a Night through the retired generic party APIs.
- The existing Prisma schema has independent `GameSession`, `Team`, `ScoreEvent`, `Room`, `RoomParticipant`, and `ParticipantRole.SPECTATOR`. The existence of the spectator enum does **not** establish a completed audience product; a new permission and delivery contract is required.
- PR #8 and PR #9 are **experimental and unmerged**. Current PR #9 targets **playing host A + eight guests (nine players)**, with a **60-minute absolute room lifetime**. The larger variant requires actual fresh TypeScript/Vitest/Chrome, two-device LAN and separate different-network review before release. This programme is branched from `main` so it does not accidentally merge or activate either experiment. Integration with approved room transport must be performed explicitly after its own gate.
- Keep the original live game engines authoritative as currently designed. A browser-owned P2P host can cheat when host A also plays: do not promote it to a trustworthy adjudicator of secret answers or premium/competitive score history. Decide which outcomes need independently verified server authority and only persist verified results.
- The pure `src/lib/night/core.ts` and `core.test.ts` added here are an **implementation foundation, not a working Night UI**, database migration, endpoint or verified game adapter. Scoped and full tests still need to run.

## Shared product rules

**Identity and game roster.** One night has a stable night ID, organizer, selected *distinct* official game slugs (3–10), ordered slots and two or three teams in this initial team-based MVP. The organizer/host can also be a player, and uses one of the nine player slots, not a tenth. Player-to-team mapping and game-specific team compatibility must be checked before each launch; do not silently reshuffle teams or mix individual and team score semantics. The Night's room time limit does not replace the existing game's duration/deadline rules; if time expires before the whole series completes, present an **incomplete** recap rather than an invented champion.

**Score normalization.** Each verified game produces an ordered placement of *all* eligible Night teams, with optional tie groups. The series assigns first place 3 Night points, second place 2, third place 1. Ties use competition ranks (e.g. two tied first teams get 3 each, the third team gets 1). The raw scores stay inside their original games; the Night never sums incomparable score scales. At completion, a final tie yields co-champions. A result is accepted only for the expected official game, after authoritative source-session ownership/completion/eligible roster/result checks; all points are derived, never client submitted. The same source session + same result replays idempotently; a changed replay or duplicate source with conflicting result must fail.

**Roles.** Organizer controls the schedule/invite and night configuration. Host A can play, buzz and score in their own slot; only permitted organizer/host operations administer the game. Guests cannot change rosters, access private content, award themselves points, issue host commands, or impersonate a judge. The actual source game, not the public Night snapshot, authorizes release of answers and verifies outcomes. A standalone TV projection is read-only, bounded and redacted.

**Privacy and retention.** Private invites are bearer links with scoped, expiring, separately revocable join/RSVP capability where applicable. Avoid embedding live host capabilities, SDP, ICE/private candidate data, passwords, raw participant history, telephone numbers, answer keys or private question content in screenshots, share cards, logs or analytics. Opt-in friends groups require membership controls, view/delete/export and clear retention rules. No contacts scraping, unsolicited WhatsApp messages, hidden tracking or automatic social publication.

## Small, reviewable delivery slices

### Gate 0 — prove the foundation (must not be bypassed)
- Finish PR #9 scoped checks and a **real host + eight guest** browser run in which host A is also an active participant, with first-buzz and host-referee separation. Recheck 60-minute fake-clock expiry and, separately, a real-hour stability trial if feasible. LAN, internet, NAT/STUN/TURN and costs remain separate gates.
- No merge or public deployment based merely on documentation, static builds, browser mocks, or earlier three-guest evidence.

### Slice A — Night domain MVP (this draft starts here)
- Pure contract `src/lib/night/core.ts`, including official-game roster, immutable cumulative result, normalized points, replay protection and tie-aware champion.
- Add tests in `src/lib/night/core.test.ts` for malformed selections/team identities, ordering, all placements, idempotent/altered replay, normal scores, ties, and terminal behavior.
- Follow with a separately reviewed Prisma Night/NightGame/roster/result migration and authenticated service. Use read-only adapters for **three initially chosen compatible official games**; only allow games with verified adapters in the running Night selection UI. The core's generic official-slug validation is not proof that all ten have adapters. Never consume extra credits or alter existing paid eligibility unless separately designed and approved.
- UX: create a night, choose at least three eligible games, same identity/teams and share room, advance only after verified game completion, display cumulative scoreboard and final champion (or incomplete status). Feature off by default; original individual game flows unaffected.

### Slice B — invitation
- An organizer can choose date/time (with a stored timezone), suggest eligible games, send a manually copied RSVP link, receive one yes/no response per invitee, and open a bounded vote on game nominations. Explicitly separate **planning invitation** from the live 60-minute game room; scheduling a night must not prematurely start the gameplay TTL.
- Distinct invite and host capabilities, expiry/revocation, same-origin/CSRF/rate/body protections, optional pseudonyms and no SMS/WhatsApp API integration. Guest cannot change event date, read uninvited private rosters or vote repeatedly.

### Slice C — highlights and share card
- Track only allowlisted, finalized game events: actual game winners, accepted buzz timestamps if present and trustworthy, comeback/tie events and other game-specific facts. No fabricated speed (e.g. "0.32 seconds" unless recorded), no private answers or raw user input leak, and no profiling without consent.
- Final recap works without a public share image. Generate a bounded, sanitized image server-side on demand (e.g. Next.js ImageResponse) that shows the team names, final normalized scoreboard and supported funny awards. Avoid network font fetching/dependencies and never include live invite codes, host tokens or hidden game state. A share link must not make a private night publicly browsable by default.

### Slice D — opt-in "شلّتك"
- Invite-only friend group with explicit approval/membership and an owner/admin permissions model; public aliases optional. Link completed nights to a group only with the organizer's authorization and appropriate participant consent. Keep a separate persistent projection of verified Night outcomes, not P2P host claims.
- Recurring leaderboard: wins, played nights and selected safe awards with transparent tie rules. No background friend discovery, cross-group leakage, full name/contact upload or unlimited data retention. Export/leave/delete and member removal behavior must have tests.

### Slice E — spectator mode
- Audience **does not consume the eight guest seats**. Start with a small bounded, read-only audience endpoint for at least a council-sized pilot (15–30 as a load-test *target*, not promised capacity). Use a server fan-out or bounded aggregate/ballot transport, **not eight extra RTC links per spectator**.
- Spectators get only the current public/sanitized state; unique ballot scoped to active audience vote, rate limits, no admin commands, no direct scoring and no private answers. Distinguish a fun audience prediction from an officially scored juror vote in `the-court` / supported modes of `bluff` / `survey-show`. A game-specific contract specifies if/when audience voting may impact its own displayed outcome; never silently mutate historical or billing scores.
- Test 30 audience connections separately for load, privacy, expiry and host departure; cross-network delivery/pricing need their own authorization.

### Slice F — private "أسئلة جماعتك"
- Host can author a limited number of questions in a Night-scoped private draft store, initially for `survey-show` and `bluff`. Validate text length/types, prohibit HTML execution, make answer/hidden-role access phase/role dependent, provide deletion/reporting controls and a private round snapshot. Never copy entries to the published bank, training data or global discoverability by default.
- When organizer also plays, they already know authored answers. Provide a clear fairness notice or a distinct game-specific blind moderation flow; do not market these private questions as a fair competitive challenge without independent review.

## Release conditions and financial policy

For *each* slice: source-level contract review; scoped Vitest plus relevant PostgreSQL migration/integration tests; full TypeScript/lint/build; real browser roles and hostile payload scenarios; privacy/access-control review; rollback and documented PASS / PARTIAL / FAIL. Any new resource, hosted signaling, TURN, outbound messages, paid media generation, real payment or subscription has a separate per-resource exact-cost approval gate. New external spend **must remain $0** and no Free Trial credits count as Always Free. Work must stay in draft PRs, with no automatic merges or public launch.

## Excluded features — explicit non-goals

- Seasonal or occasion content packs (Ramadan, Foundation Day, National Day, Eid).
- Gulf announcer voice, AI narration, or scripted announcer interjections.
- Session presets such as friends/family/school and automatic content-mode switching.
These are not dependencies for Night MVP and must not be slipped into implementation or design scope.
