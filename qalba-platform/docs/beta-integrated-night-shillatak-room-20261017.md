# Beta integrated acceptance — Night + Shillatak + existing HTTP/SSE Room

This candidate starts from **Draft PR #23** (and therefore inherits the explicitly
reviewed PR #21 / PR #13 / PR #12 / PR #10 stack), without modifying main, merging
PRs, seeding production, altering checkout history or opening public ingress.
The ticket asks for a **fresh combined exact-head proof**; older PASS evidence
from separate branch heads does not satisfy it.

In one fresh native PostgreSQL 17 fixture and one exact checkout, run:
1. Clean lockfile install; full Vitest; TypeScript, ESLint and Next build;
   apply original migrations to a brand-new, checked-empty DB, then create
   only synthetic Night/Beta accounts and the existing legacy Room question bank.
2. Full Shillatak native service acceptance (real 5/7/5 game engines, immutable
   leaderboard, member permissions, rate/capacity and concurrent invitations).
3. Full Night native acceptance and both actual Night revocation-vs-two-RSVP
   queue orders, using separate native DB backends.
4. Built Next on loopback with real Google Chrome: full Night journey (all three
   canonical games and result provenance) -> Shillatak owner/member invitation,
   lost-response recovery, explicit attachment of the exact Night, immutable
   standings and archive -> existing category-board/HTTP-SSE Room (eight distinct
   guest contexts, readiness, answers, guest refresh, full match, final scores
   and one canonical START debit).
5. Shut down the owned listener; run built-process restart / feature-toggle
   regression with the same source and DB. Only then independently test a
   revoked Night link in three real Chrome browser contexts; original RSVPs
   persist and future RSVPs fail.
6. Read-only crosscheck of the three private journey records and database rows:
   same owner for Night/Shillatak, Night completed with 3 accepted source-game
   receipts, one unique immutable Shillatak linkage, Room belonging to another
   browser-created synthetic owner and completed with eight guests, no reuse of
   a Night child game, only the canonical START debits. Each test receipt
   must be PASSED and bear the exact current source head. Save only sanitized
   counts and explicit limitations as an artifact; never publish raw links,
   cookies, connection strings, screenshots or the private fixture.

**Scope boundary:** this proves the *existing* HTTP/SSE Room with the prior
18-cell synthetic board. PR #9's alternative WebRTC room and PR #20's new
36-cell Challenge Board remain **separate**, unmerged and **NOT validated by
this particular branch**. This run is loopback-only, not independent LAN or
NAT, a public HTTPS deployment, financial/security release approval, or
proof of all additional games. PR #16 security/remediation gates remain
independent. Keep all stacked PRs Draft and unmerged pending owner review.
