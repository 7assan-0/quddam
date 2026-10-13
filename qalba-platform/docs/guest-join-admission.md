# Guest-join admission — scoped P0 remediation

This change applies one shared admission service to Board, Social, Court and Bluff guest-join POST routes. It does not alter gameplay engines, room roster caps, participant authentication, START/debit, payments, approved historical RC evidence or database schema.

## Trusted identity and target

Use the existing `authClientIdentity` function: with `AUTH_TRUST_PROXY=false` all requests share the conservative `unknown` client bucket. With `true`, only `AUTH_CLIENT_IP_HEADER` is read; it must be one IP unconditionally overwritten by the trusted ingress. Never accept arbitrary `X-Forwarded-For`, a comma-separated chain, a port, or client-supplied duplicates. Mapped IPv4 is normalized to IPv4 and IPv6 temporary addresses share /64. IP addresses are HMAC inputs only, not stored in AuthAttempt.

For public staging, **block direct Next ingress**, strip incoming client-IP copies and overwrite `x-quddam-client-ip` from the actual trusted socket peer at the last controlled proxy. Verify malformed/missing chains become `unknown`; verify ordinary independent clients and public NAT behavior. This code does not prove proxy deployment.

Board room codes are normalized by `normalizeCode` before both admission and `joinRoom`: lowercase and permitted whitespace aliases share a budget. Social and Bluff use lowercased UUID route IDs. Court uses the actual Prisma-generated 25-character lowercase CUID session ID (`GameSession.id @default(cuid())`), retaining independent room budgets. Invalid route targets collapse to a single `invalid` subject per game (never create attacker-chosen cardinality); invalid requests still pass the shared rate gate before parsing/DB work.

## Shared PostgreSQL budgets

| Scope | Attempts/window | Notes |
|---|---:|---|
| Room and client | 12 / minute | Per canonical room and trusted identity |
| Room | 60 / minute | Across clients for one room |
| Client | 30 / minute and 150 / hour | Shared across all four games and rooms |
| Global | 300 / minute and 3,000 / hour | Shared across all four games |

Every attempt admitted before reading/parsing the body or invoking a guest-join service consumes all six layers. Reconnects and malformed bodies count too. An exhaustion responds HTTP 429 with non-cacheable headers and performs no join-service/database session work. Key construction is secret-HMAC namespaced with scope and duration, never a raw room, name or client IP. The same stable `AUTH_RATE_LIMIT_SECRET` and database must be shared across instances; all windows begin at first admitted attempt. One short transaction increments the six counters in sorted key order or rolls back the entire admission. It uses the existing `AuthAttempt` table and bounded retention helper; no Redis, new table or migration.

Limits are deliberately conservative defaults for a small controlled beta. Carrier NATs, absent trusted ingress, and larger legitimate events may encounter shared limits. Do not loosen or enable public access without reviewing measured 429s, PostgreSQL/pool and lock pressure, abuse patterns and incident ownership. Deploy independent ingress per-IP, request-size, header, concurrency and timeout limits as defense in depth.

The existing auth-attempt retention also covers these keys. Coordinate its daily bounded schedule as documented in `PUBLIC_INGRESS_SIGNUP.md` and `data-retention.md`; no job has been deployed by this PR.

## Verification and launch boundary

`src/lib/rooms/admission.test.ts` checks distinct Court CUID room buckets, canonical keys, spoof resistance, mapped IPv4, IPv6 /64, unknown clients, HMAC privacy and transaction failure handling. A disposable PostgreSQL 16 service can run the guarded `scripts/guest-join-postgres.ts`: it requires `JOIN_TEST_DATABASE=1`, loopback port 55466, exact `join_admission_test` DB/user, fresh AuthAttempt inventory and synthetic config. It retains records and performs no reset, drops, customer-data access, or live provider requests.

Hosted `.github/workflows/guest-join-review.yml` runs unit, lint, typecheck, build and native admission checks against its checked-out PR head. Local/hosted outcomes must be reported separately. Test success is **not** evidence of real ingress header overwrite, direct-port isolation, public load capacity or complete successor release approval. Run a real staging ingress test before public exposure.
