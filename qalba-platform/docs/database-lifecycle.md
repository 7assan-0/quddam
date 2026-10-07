# PostgreSQL deployment, upgrade, restart and recovery

Phase 5.0F-1 / M13 is a technical lifecycle proof. It does not change Quddam's game, financial, authentication, realtime or retention policy. It does not establish legal compliance, production capacity, a major-version PostgreSQL upgrade, or a production recovery-time guarantee. Actual acceptance counts are in the phase report.

## Critical database assumptions

| Boundary | Persisted authority and inspected mechanism | Exact source | Recovery contract |
|---|---|---|---|
| B01 settlement | Purchase FOR UPDATE, locked reread, PENDING-only claim; coupon, grant, wallet and terminal marker atomic | `src/lib/billing/checkout.ts: settleInvoice, settleLockedPurchase` | First terminal result wins. Retry same verified invoice/Purchase; no competing settlement primitive. |
| Financial grant | Unique GameCredit.idempotencyKey `purchase:<id>` | `prisma/schema.prisma: GameCredit`; checkout | Ambiguous commit can be reread/retried without another grant. |
| M01 invoice creation | UNKNOWN_OUTCOME and timestamp commit BEFORE external POST; second locked transaction links strongly matched invoice | `src/lib/billing/invoice-creation.ts: ensureInvoice` | Recover by merchant identity or remain pending/support. Never blindly POST again. External HTTP never holds a transaction. |
| M02 reconciliation | Ordered PENDING eligibility; LIMIT 50 FOR UPDATE SKIP LOCKED; persisted lease UUID/attempt/ten-minute lease; three provider workers | `src/lib/billing/reconciliation.ts: reconcileBatch` | Killed worker's lease remains until eligibility; matching lease only updates schedule. Pending 30s doubling to 15m, errors 60s doubling to 1h. |
| M03 refund | Authoritative invoice AND payment verification; Purchase then CreditWallet locks; unique PurchaseRefund and separate compensation ledger | `src/lib/billing/refunds.ts: processObservedRefund, confirmSupportRefund` | Original PAID purchase/grant preserved. Same full refund retries once. Available balance caps deduction; consumed remainder is SUPPORT_REQUIRED, never negative/clawed back. |
| Paid-refund queue | Separate LIMIT 10 SKIP LOCKED; same lease/concurrency, one-hour normal interval | reconciliation: `reconcilePaidRefundBatch` | Does not monopolize pending queue; confirmed refunds leave it. |
| Auth/H01 | Exact original AuthSession, hash, expiry/revocation and suspended User; guard every **20 seconds** | `src/lib/auth/session.ts`; `src/lib/auth/host-stream.ts` | Deleted invalid session stays invalid. Infrastructure failure is transient, not revocation. Restart requires normal reconnect/auth. |
| Welcome/START | Unique welcome entitlement; conditional wallet decrement balance >=1; unique `game-start:<session>` and creditConsumedAt | `src/lib/billing/credits.ts` | One debit; same-session rematch stays free. Wallet CHECK >=0 is final defense. |
| Category Board command | Unique session/key receipt inserted transactionally; version CAS; duplicate catch rereads receipt | `src/lib/games/category-board/service.ts: applyBoardCommand` | Board uses CAS/unique-receipt serialization, not a falsely claimed GameSession row lock. Same unresolved key recovers lost response. |
| Dedicated commands | GameSession FOR UPDATE, ownership/access validation, receipt/payload hash, version, state/score/event commit | Each dedicated game `service.ts: apply*Command`; GameCommand unique index | Changed payload/key fails; no global strict-CAS change. Social within-round vote rebasing remains. |
| M08/M09 | Ranked pending intent tied to authoritative round/attempt; Social vote roundId validated before rebasing | `src/lib/games/ranked/client-intent.ts`; Social `applySocialCommand` | Later new intent gets fresh key. An old-round vote cannot become a rematch vote. |
| Deadlines | Persisted numeric/ISO deadline and locked expiration path | Lightning/Ordering/Court/Ranked/Letter/Social/Forbidden/Bluff services | Later authorized request resolves due work if everyone was offline. There is no claim of an autonomous offline scheduler. |
| D-1 projections | Pure multi-query views explicitly REPEATABLE READ; due deadline starts fresh READ COMMITTED, original lock and reread | `src/lib/realtime/read-view.ts: readDeadlineView` and callers | Coherent old snapshot is valid while a command commits. Due transition rechecks under lock. Command locks stay unchanged. |
| Realtime operations | Lightweight markers, audience-specific projections, no shared secret cache; two streams per credential/audience/session/process | `src/lib/realtime/{stream,view-poll,errors,client}.ts` | Registry loss is operational only. Reconnect reauthenticates; pool/DB/serialization errors are transient. Cap is not cross-instance. |
| M11 selection | Active category + original publication/language rules; ordered Category FOR SHARE, content row lock/reread | `src/lib/games/content-category.ts`; Social/Letter/Survey selectors | Deactivation serializes with new selection; exhaustion rolls back initialization/debit. Existing snapshots survive. |
| H03 snapshot | Non-null Social word/aliases; immutable trigger | `20261005190000_social_round_snapshot`; Social service | Legacy bank is captured once as LEGACY_BANK_CAPTURE, not claimed reconstructed history. New rounds use ROUND_CREATION. |
| M12 cleanup | Indexed stable eligibility; small candidate transactions; GameSession -> Room -> target SKIP LOCKED/recheck | `src/lib/retention/{policy,service}.ts`; `scripts/data-retention.ts` | Default100/max500 targets; earlier commits survive failure. Active/ineligible skipped. Financial/history/command receipts retained. |
| Pool | One process-global Prisma client, pg adapter default max10; configured integer1..20 | `src/lib/db.ts` | Restart creates pool; sum all instance/worker/migration/support pools within DB capacity. No tested production-capacity claim. |
| Startup | Explicit migrate deploy; build/start do not seed/reset/clean/migrate automatically | `package.json`; `prisma.config.ts` | Generate client separately, then build. One coordinated migration operator. No schema reset. |

The native harness executes SHOW transaction_isolation. READ COMMITTED is observed, not assumed from Prisma defaults. The view's explicit REPEATABLE READ is exercised against an independent committed writer.

## Migration and fixture design

All **24 original migrations** remain byte-identical and ordered. Prefixes **1,7,18,20,23,24** are deployed with Prisma using untouched SQL. Users/auth/history are inserted after1; wallet/ledger/coupon/Purchase/legacy PaymentEvent after7; an unsnapshotted legacy SocialRound after18; its explicit H03 capture is checked after20. After23, a generated pre-E1 client and real game/billing services populate **ten active plus ten COMPLETED official games**, financial grant/refund/support, PENDING/UNKNOWN invoice work and cleanup candidates. E-1 migration24 applies only after that populated predecessor exists. A deploy rerun is a no-op.

The pre-E1 generated client omits only the two not-yet-existing retained-vote count columns. This is isolated generated testing output, never an edited application schema/migration. Letter's active and completed fixtures each serve, reveal and correctly resolve one actual question before migration24, so both already contain an answer snapshot. Fingerprints contain explicit identities/counts/balances/status/version/deadline/score/receipt keys/snapshot IDs plus SHA256 digests of synthetic authoritative state and nine snapshot models. They never emit plaintext credentials, credential hashes or authored secret content. Raw fixture cookies/participant tokens are excluded from delivered evidence.

The pre-H03 legacy migration cannot reconstruct bank edits already made before snapshot capture. `LEGACY_BANK_CAPTURE` is tested and reported honestly. Valid populated coupon/wallet invariants are tested; a real database containing invalid negative counters must stop for audited data/support investigation, not delete/rewrite money to make a constraint pass.

## Deployment sequence

1. Verify source fingerprint, original SQL checksums, target DB identity and maintenance owner. Back up sensitive data and prove restore into a separate database. Confirm business recovery-point expectations.
2. Inspect migration status and invariants read-only: non-negative wallets/coupons, nullable maxUses arithmetic, required snapshot references/FKs and no unresolved failed migration. Investigate inconsistencies; never reset.
3. Install lockfile dependencies, generate the matching client, build the release. Local verification sets CHECKPOINT_DISABLE=1 and NEXT_TELEMETRY_DISABLED=1; the installed Prisma CLI disable branch is inspected. Keep DATABASE_URL/secrets out of logs.
4. Drain old app/cron workers where compatibility requires it. Run `npm run db:migrate` once. Prisma's advisory lock does not replace deployment coordination. No migrate reset/schema drop/squash/routine reseed.
5. Stop on migration failure. Some older DDL files are not explicitly one SQL transaction. Inspect actual objects and _prisma_migrations. `migrate resolve --applied` is appropriate only after proving all intended operations exist; never delete tracking rows/edit SQL to hide failure.
6. Start `npm run start` against the upgraded DB; check authenticated views, profile results, wallet/purchase/support history and availability. Continue a controlled synthetic/canary active match with its next valid command; verify one START debit.
7. Resume bounded reconciliation and M12's dry-run/small-batch procedure. Do not drain retention at startup. Check leases/backoff, aggregate cleanup failures, financial markers and support remainder.
8. Observe connection count, waiting locks, SQLSTATE errors, SSE recovery and job aggregates. Budget all replicas/jobs with headroom. Do not run seed as routine production upgrade; L05 seed/runbook concerns are not fixed here.

No migration or startup executes mass cleanup. Existing M12 windows/cadence remain unchanged: daily bounded100, max500, no schedule-drain loop.

## Lock order and retry policy

Settlement locks Purchase before Coupon and wallet/grant side effects. Refund locks Purchase before CreditWallet. Dedicated START holds GameSession before wallet operations; Board holds its intent/CAS boundary. Financial paths do not then acquire GameSession. Social/Letter single-question and Survey selectors lock the selected content row, then its Category FOR SHARE; Letter board generation locks a sorted set of categories before reading eligible questions. Category deactivation locks its Category row and does not then acquire GameSession/content rows. Cleanup locks GameSession -> Room -> candidate and no financial rows. These are inspected paths, not a guarantee about future code.

| Failure | Safe handling |
|---|---|
| 40P01 deadlock victim | Whole transaction aborts. Retry only from the beginning with SAME verified Purchase/refund identity or same unresolved GameCommand intent/key. No last-statement retry. |
| 40001 serialization failure | Discard snapshot/transaction; safe read can repeat. Financial/command intent can repeat only under existing unique/receipt semantics. No blind generic retry helper. |
| Connection lost before commit | Unfinished transaction rolls back. Reread durable state before protected-intent retry. |
| Response lost after commit | Outcome ambiguous; reread/retry SAME receipt/financial identity. A fresh key creates a new intent, not recovery. |
| Reconcile process killed | Lease persists until stored ten-minute eligibility. Terminal rows leave queue; same B01 primitive settles remaining rows; stale worker cannot overwrite later lease. |
| Invoice process killed | UNKNOWN remains. Recover strongly matched invoice or keep pending/support. Even a crash before POST can conservatively leave UNKNOWN; restart cannot infer remote absence. |
| Refund killed | Before compensation: zero effect. After commit/before response: stable duplicate, original grant/support remainder preserved. |
| Cleanup killed | Committed targets remain complete; incomplete target rolls back. Next bounded run resumes eligibility, rereads active lifecycle. Scheduled runs omit cursor to retry skips/failures. |
| DB/pool unavailable | M07 transient reconnect/fallback. Never mark game/payment FAILED or revoke credential on infrastructure failure alone. |

One deliberate reversed-wallet lock-only probe creates a 40P01 and one isolated configuration-row SERIALIZABLE probe creates a 40001. They test rollback/classification, not an observed application bug. Real repeated START/refund races test application lock order without huge timeouts or a correction to gameplay.

## Backup, restore and rollback limits

Use restricted, protected-at-rest `pg_dump -Fc` backups. Actual backups contain credential hashes/private snapshots even when fingerprints/logs do not; they are sensitive. Restore to a **NEW** isolated DB with `pg_restore --exit-on-error --no-owner --no-privileges`. This phase tests the populated pre-E1 synthetic backup, forward migration of the restored clone, matching fingerprints and all ten history reads. It never drops/resets/restores over the original DB.

A restore returns to capture time. Later writes require verified recovery/financial reconciliation; do not silently lose settled payments or revive revoked sessions. There are no tested down migrations. Older code can be incompatible with H03 snapshots or M12 redacted vote counts. Code rollback cannot recreate deleted credential hashes/private links; restore only under authorized backup policy and do not restore access.

This proves PostgreSQL **16.15** application/schema lifecycle, not PostgreSQL major-version pg_upgrade, PITR, multi-region failover, production-sized backups, production TLS infrastructure, or production RTO/RPO/capacity. Deterministic provider contract fixtures are used; no live refund/invoice API is exercised. HTTPS and database transport settings still require deployment validation.

## Safe reproduction and monitoring

`scripts/database-lifecycle-fixtures.ts` / `database-lifecycle-postgres.ts` are test-only; they require LIFECYCLE_TEST_DATABASE=1 and a localhost `f1_lifecycle` database. The evidence orchestration tool creates disposable native PostgreSQL databases, stages migrations, starts **production Next start**, kills/restarts application/workers and archives completed reports. It does not use PGlite or irreplaceable data. Use the pinned installed toolchain, synthetic data and native PostgreSQL only.

The isolated runtime's native-binary/ownership adapter is outside application source; production uses normal PostgreSQL ownership. Short future test deadlines and an advanced reconciliation test clock avoid long waits; production constants are unchanged. Monitor unexpected deadlocks/serialization errors, failed migrations, lease/backoff backlog, pool saturation, realtime transient rate and cleanup failed/skipped counts.

Primary semantics references: [PostgreSQL16 isolation](https://www.postgresql.org/docs/16/transaction-iso.html), [locks/deadlocks](https://www.postgresql.org/docs/16/explicit-locking.html), [SQL backups](https://www.postgresql.org/docs/16/backup-dump.html), [pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html), [Prisma7 migrate deploy](https://www.prisma.io/docs/cli/v7/migrate/deploy). Installed-version source/documentation remains authoritative for this application.
