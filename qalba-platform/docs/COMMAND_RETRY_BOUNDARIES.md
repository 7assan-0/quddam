# Command retry and match boundaries — Phase 5.0D-2

This change closes M08/M09 only. No game rules, timer, scoring, credit, billing,
authentication, token or realtime transport behavior changes.

## Ranked List

The client retains one unresolved intent, its serialized action, command key and
original expected version. The scope is the existing session ID, match number,
round number, phase/paused phase, active team, attempts and authoritative version.
Every Ranked stateVersion increment comes from a committed game command or
authoritative timeout. SSE heartbeats, display-link changes and admin edits do
not increment it. Thus a newer version proves the old command committed or its
original context is obsolete. This is not a new global CAS requirement.

An unknown network outcome preserves the key while that scope is unchanged.
An ambiguous 429/5xx response also preserves it until a successful authoritative
refresh proves progress. Confirmed command rejection (other 4xx) discards it.
An authoritative accepted view clears obsolete pending intent; a later identical
action receives a fresh key. Older views are ignored. A synchronous in-flight
ref prevents two clicks before React renders from starting competing intents.
Command responses, SSE, fallback and explicit conflict refresh all use the same
monotonic observation. Terminal access clears pending intent. The Ranked server
receipt, ownership, payload hash, locking and scoring code remains unchanged.

## Out of the Loop

SocialRound already has an immutable database ID; no migration is necessary.
Views now expose that non-secret ID (null before the first round). SUBMIT_VOTE
requires `roundId`, `ballot`, `targetId`, plus the existing key/expectedVersion.
Missing or malformed identity returns the existing validation error (400).

Inside the existing GameSession row lock, after the H02 credential/room expiry
checks and before any receipt recovery/insertion, the service verifies roundId
against the latest actual SocialRound. A mismatch returns `409 STALE_ROUND`
without a receipt, vote, version, result or score write, even for an old previously
committed key. A new intent must also match the current ballot (`409
STALE_VOTE_INTENT`). A committed same-round key remains a duplicate no-op even
if its vote resolved that ballot. Existing payload hash checks remain required.

The existing server version-conflict rule is retained. On STALE_GAME_STATE the
client refreshes, then retries with its original key/action only if roundId,
phase and ballot still match. It updates only expectedVersion, allowing other
participants' same-round votes to serialize. On STALE_ROUND/STALE_VOTE_INTENT it
refreshes but does not retry or translate the old vote. A fresh user selection
can submit in the new round without reload. Selection is cleared on round or
ballot change. Retries remain bounded at the existing five attempts.

All other Social actions retain their envelope and rules. Old clients that omit
vote identity fail closed and need the current client. Existing sessions/history
are preserved. Previously stored command hashes are not rewritten.

## Privacy and realtime

Only the round ID is added to projections. Role/word/aliases, partial tallies,
outsider and other players' private ballots retain their existing restrictions.
There is no projection cache or cross-audience key reuse. D-1 transport,
classification, reconnect/backoff, caps, marker polling and H01 guard are unchanged.

The focused native harness runs only against isolated loopback PostgreSQL. It
uses independent connections for a round-N captured request and real host
completion/rematch transitions before resuming that request. Browser tests use
the real signup/join/command endpoints, deliberately lose committed responses,
delay requests and exercise fallback without changing production transport.
