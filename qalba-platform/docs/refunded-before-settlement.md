# Refunded-before-settlement integrity

This correction preserves the full-refund and consumed-credit policy in
[PAYMENT_REFUNDS.md](PAYMENT_REFUNDS.md). It changes neither provider money
movement nor the immutable original PAID purchase/grant and compensation model.

## Trigger and correction

An invoice may remain `paid` after its payment has been refunded. Previously,
a local PENDING purchase bypassed refund handling and received a purchase grant.
The existing refund-before-PAID native case used invoice status `refunded`,
so it did not exercise this shape.

`settleInvoice` now checks reversal evidence and existing review markers after
locking/re-reading Purchase and validating invoice identity. Full, partial,
voided, reversed, and mixed-payment observations cannot authorize a fresh grant.
The purchase remains PENDING and the transaction commits a deduplicated
`REFUND_REVIEW / REVIEW_REQUIRED` event. Purchase facts, wallet, purchase grant,
coupon reservation/usage, refund rows and terminal analytics remain unchanged.

The marker persists across later stale paid/failed/canceled/expired/voided
observations. Existing `INVOICE_OBSERVATION / REVIEW_REQUIRED` markers also
retain the hold. Repeated observations cannot erase it or create another grant.
An ordinary pre-payment void remains VOIDED without credits. Contradictory
refund/capture evidence or multiple voided payments in a voided invoice retain
review instead of releasing its reservation.

`reconcilePurchase` uses the locked result when its initial PENDING read races
with a legitimate PAID settlement. If PAID wins first, the reversal observer
uses the existing authoritative invoice/payment verification and exactly-once
compensation outside the settlement transaction. It preserves the original
grant, caps recovery at available balance, and retains SUPPORT_REQUIRED when
credits have been consumed. Direct settlement gains no provider networking.

Callbacks acknowledge a persisted hold; owned-purchase polling returns PENDING;
scheduled reconciliation retains its existing pending backoff. A callback's
status/amount remains an untrusted hint. The `reversed` spelling denies grants
but does not extend the approved compensation allowlist.

## Review and limits

Held purchases require operator investigation. This PR adds no automatic hold
release, partial-refund conversion, override API, refund initiation or cleanup
of financial audit rows. Ordinary retries cannot clear the hold. Do not delete
review events to force settlement; any resolution mechanism requires separate
owner-approved policy and implementation.

The server cannot know about a reversal it has not yet observed. If a valid
paid observation wins before the first reversal, the established compensation
policy applies. This is not a claim that provider refunds or live merchant
configuration have been verified.

## Scoped verification

The new unit regression was observed failing before the fix (PAID instead of
PENDING). `src/lib/billing/settlement-refund.test.ts` exercises real settlement,
callback/poll/cron handlers with synthetic database/provider boundaries,
rollback, stale observations, identity rejection and ordinary payment behavior.

`scripts/billing-reversal-postgres.ts` requires an explicit test flag and a
dedicated PostgreSQL 16 database: financial_p05, user quddam_financial_test,
loopback port 55465. It refuses other targets, existing due purchases and
unknown HTTP destinations. Prepare a fresh synthetic instance using the
unchanged forward migrations and content-only seed; provide credentials
through restricted local configuration, never command arguments or logs.

Set `BILLING_TEST_DATABASE=1`, `DATABASE_POOL_MAX=10`,
`PUBLIC_WELCOME_CREDITS_ENABLED=false`, and a new absolute
`BILLING_REVERSAL_EVIDENCE_FILE` under `/tmp`. Then run:

```bash
node --import tsx scripts/billing-reversal-postgres.ts
```

The script retains synthetic fixtures, performs no database reset/deletion,
intercepts every provider GET, and refuses unknown HTTP requests. It records
actual distinct PostgreSQL backends waiting on independent row-lock gates,
both reversal/paid winner orders, and real Board START/refund contention.
Evidence cannot overwrite an earlier run.

These are scoped synthetic checks. Historical approved RC assets/manifests are
unchanged; the changed source requires its own later successor release gate.
