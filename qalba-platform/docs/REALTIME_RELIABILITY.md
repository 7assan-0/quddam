# Quddam realtime reliability — Phase 5.0D-1

Scope is M06/M07 only. Game modules, scoring, persisted deadlines, command
transactions, START debits, billing/refunds, token formats, prior migrations,
privacy projection functions and existing test identities are preserved.

## Reads and deadlines

Lightning, Ordering and Court views now read a consistent PostgreSQL
REPEATABLE READ snapshot without GameSession FOR UPDATE. The read callback
has no mutation when `resolveDue=false`. An observed expired authoritative
deadline exits that snapshot and opens the existing READ COMMITTED locked
path. Ownership/token authorization and expiry are rechecked after locking;
the existing deadline resolver re-reads current state and remains the sole
writer. A command, pause or another timeout can win before the lock. Commands
and all their GameCommand/stateVersion/ScoreEvent semantics remain unchanged.

Every SSE connection keeps only its own latest projected version/deadline.
There is no shared projection or secret cache. A lightweight stateVersion
query runs every 250ms for Lightning/Ordering and 1000ms for the other dedicated
games. Full projections run on version change, on a due server-resolved
deadline, or at most every 1000ms for non-host credential revalidation / every
10 seconds for an idle host. Every emitted projection reauthorizes its own
audience. Unchanged refreshes are not emitted, as before.

The Social DISCUSSION timer is still a host-authorized progression; it is not
converted to automatic timeout. Social only auto-resolves OUTSIDER_GUESS;
Letter QUESTION_ACTIVE/STEAL; Forbidden CARD_ACTIVE; Ranked GUESS_ACTIVE;
Lightning TEAM_ANSWERING/STEAL; Ordering ORDERING; Court its existing timed
phases. Survey and Category Board retain their existing host-command timer
behavior. No client owns authoritative deadlines. As before, an authorized
view/command resolves a due automatic deadline; with every client offline,
resolution occurs on the next authorized request, not a new background worker.

## H01 and access

The existing exact AuthSession helper and 20-second revalidation cadence are
unchanged (approximately three auth lookups per minute per open host stream).
Captured expiry can terminate sooner. Guards run before and after a projection
and before emitting; detected revocation never emits the computed private
payload. The Category Board room stream already revalidated currentUser on
every read; it additionally binds its original host session in the same guard.
Display/participant/buzzer/controller projection authorization is unchanged.

Confirmed typed 401/403/404/410 access errors and HostAuthInvalidError are
terminal. Unknown errors, database/pool/serialization failures, domain 409/500
and HostAuthTransientError are transient. Missing GameSession observed by a
successful marker read is terminal; a failed query is not “missing.” Terminal
streams emit `access-ended`, then close. Transient failures emit
`connection-error` with only `{retryable:true}`, an SSE 5000ms retry hint, then
close. No error details, tokens, private state or provider data are in error
events. Existing initial HTTP error status conventions remain.

## Fan-out and slow clients

At most two active streams per game session / audience / exact credential
are admitted in one server process. Host keys use the exact AuthSession ID;
dedicated token audiences use their credential; shared-room participant keys
use their already-authorized participant ID. Registry keys are SHA-256 of
the tuple; no plaintext tokens or projections are retained in the registry.
Host, TV and different participants have separate slots. Excess requests
return 429, Retry-After:5 and no-store after normal authorization.

This is process-local protection, **not distributed enforcement**. Multiple
server processes each have their own cap. No Redis, shared event bus or database
lease table was introduced. Many distinct credentials/rooms still create
aggregate database work; deployment capacity remains a separate release gate.

Each stream has one serial asynchronous read loop, one wakeable timer and a
bounded three-chunk queue. A full queue closes the slow transport before more
DB work. Abort/cancel clears the timer, wakes waits, detaches the abort handler,
closes the stream and releases its slot idempotently. A DB query already in
flight can finish; its result is discarded and no subsequent query is started.
Dedicated/public display heartbeat remains 10s. Shared room streams retain
their 1500ms read cadence and 25s lifetime; heartbeat is bounded to 10s instead
of every unchanged 1500ms read. Completed Board display access still ends the
stream under the original completed-session policy.

## Clients and recovery

The focused client transport owns one EventSource and one serialized fallback
loop. After a transient failure it closes the broken EventSource and retries
at 3, 6, 12, 24, then 30 seconds maximum. Fallback uses the same bounded delay,
resets after successful reads, and stops immediately on healthy SSE. It aborts
in-flight fallback fetches, ignores stale transport responses and cleans all
timers on unmount. Healthy SSE no longer starts a redundant REST refresh on
open. A new connection always receives a normally-authorized initial state.

Terminal HTTP 401/403/404/410 or access-ended stops all retry/poll work and
clears the relevant private answer/card/order/vote/role fields in the client.
429/500/503 and transport failures remain retryable; they never display access
ended. Command send functions and their pending-key behavior are unchanged;
M08 is explicitly outside this phase. Category Board's authenticated REST-only
display path retains polling, now serialized and backed off on transient errors.

## Verification and limitations

`scripts/realtime-postgres.ts` measures actual emitted Prisma SQL statements,
GameSession FOR UPDATE queries, projection calls, command latencies and native
connections in modest isolated PostgreSQL scenarios. It compares the unmodified
C4 services with the new per-viewer production poller. It is not a network,
proxy or production capacity benchmark. Prisma query events do not expose all
transaction protocol messages: reported observed BEGIN=0 does not mean zero
transactions. Native held-lock tests prove pure reads progress while commands
wait; twelve concurrent expired readers resolve once for each changed game.

Browser tests exercise real DB read failure/recovery, bounded fallback,
same-credential caps, separate audiences, abort/reconnect, missing-session and
Social-secret clearing. Existing gameplay/security assertions remain intact.
The H01 structural/performance fixture now asserts lightweight marker polling
and bounded full projections, while retaining all revocation/no-leak checks.
Court's create-button expectation is updated only to the existing Quddam
branding copy; its case identities and gameplay/privacy assertions are intact.
Other existing tests are byte-identical. The full consolidated 202-case
regression is not run here.

Remaining findings include M08 onward and the retained legacy command-key risk;
this phase does not claim production load capacity, cross-instance stream caps,
automatic resolution with all clients offline, or a distributed realtime stack.
