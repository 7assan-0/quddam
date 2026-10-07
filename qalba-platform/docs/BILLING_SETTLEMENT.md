# Purchase terminal settlement (Phase 5.0B-1 / B01)

`settleInvoice` validates the provider reference, provider, amount and currency after acquiring a PostgreSQL `Purchase FOR UPDATE` row lock. At the default PostgreSQL READ COMMITTED isolation level, the subsequent read sees a previous lock holder's committed terminal status. Only PENDING may transition. PAID, FAILED, CANCELED, EXPIRED and VOIDED are terminal; historical REFUNDED is also preserved as terminal. The first terminal result wins; later conflicting results return the saved purchase without new financial side effects. An identity mismatch is rejected even after settlement.

The conditional PENDING update claims the transition inside the same transaction as coupon reservation release, coupon usage conversion, the existing unique `purchase:<id>` ledger grant, wallet increment and one terminal analytics event. Any failure rolls everything back. Unknown/nonterminal provider statuses leave the purchase pending. Callback, polling and reconciliation all reach this primitive; local uninvoiced expiry uses the locked helper and retains its historical FAILED result.

For a legitimately reserved purchase: PAID changes `(reserved, used)` by `(-1, +1)`; other terminal statuses change it by `(-1, 0)`. A reservation flag without an available reservation fails closed rather than decrementing below zero. This phase does not infer or repair historical corrupt counters.

## Forward migration and deployment preflight

The new migration adds three enum values and validates nonnegative coupon counters. Existing migrations are unchanged. Before deploying, run this read-only query against the target database:

```sql
SELECT id, "usedCount", "reservedCount", "maxUses"
FROM "Coupon" WHERE "usedCount" < 0 OR "reservedCount" < 0;
```

If rows exist, stop deployment and reconcile them against authoritative purchase/payment records separately. Do not clamp counters. Target production data was unavailable during this phase; empty and seeded databases were tested.

No `usedCount + reservedCount <= maxUses` constraint is added: null means unlimited, admin PATCH permits lowering limits below existing usage/reservations, and the existing checkout probe constructs an over-limit historical fixture. Admission remains serialized by the existing coupon row lock; paid settlement converts an already counted reservation into usage and does not increase the sum. Lowered limits block new admission but do not invalidate already reserved purchases. Seeds create no coupons with negative counters.

## Native PostgreSQL regression test

Use a dedicated disposable database, migrate it first, then:

```sh
DATABASE_URL='<dedicated PostgreSQL URL>' DATABASE_POOL_MAX=10 BILLING_TEST_DATABASE=1 \
  BILLING_EVIDENCE_FILE='/absolute/path/billing-settlement-postgres.json' npm run test:billing:postgres
```

The test refuses a missing explicit test flag, pools smaller than four and PGlite. It creates fixtures and disables welcome credits in that disposable database. A separate gate connection holds a row lock; `pg_stat_activity` verifies each contender waits on a distinct native backend before releasing the gate. The tests cover concurrent paid/failed, both conflict winners, the actual callback handler versus reconciliation (mock provider transport only), retries of all five terminal statuses, coupon admission/maxUses, nonnegative constraints, unlimited coupons, atomic rollback and concurrent local expiry. These new tests are separate from the original 156 browser test identities.

The provider invoice-creation crash window M01, reconciliation scheduling M02, and other Phase 5.0A findings remain open. No game credit debits, game engines, auth or SSE policies change.
