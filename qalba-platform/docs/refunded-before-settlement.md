# Refunded-before-settlement integrity

This correction preserves the full-refund and consumed-credit policy in
[PAYMENT_REFUNDS.md](PAYMENT_REFUNDS.md). It changes neither provider money
movement nor the immutable original PAID purchase/grant and compensation model.

## Trigger and correction

An invoice may remain `paid` after its payment has been refunded. Previously,
a local PENDING purchase bypassed refund handling and received a purchase grant.
The existing refund-before-PAID native case used invoice status `refunded`,
so it did not exercise this shape.

`settleInvoice` checks complete payment-attempt evidence and existing review
markers after locking/re-reading Purchase and validating linked invoice identity,
including the required purchase metadata. Unsupported reversals, partial refunds,
missing or inconsistent terminal evidence and ambiguous financial histories cannot
authorize a fresh grant. The purchase remains PENDING and the transaction commits
a deduplicated `REFUND_REVIEW / REVIEW_REQUIRED` event. Purchase facts, wallet,
purchase grant, coupon reservation/usage, refund rows and terminal analytics remain
unchanged by that hold.

The owner-authorized correction distinguishes a valid paid payment from a distinct
ended void attempt. A paid invoice requires an explicit complete attempt array,
unique UUIDs, matching invoice IDs, exact original amounts, SAR currency, bounded
captured/refunded counters and valid optional timestamps. Exactly one payment must
be paid with capture zero/full, or captured in full, with no refund or void evidence
and no capture timestamp contradicting a zero captured amount. Every other attempt
must be failed without financial timestamps, or voided with a valid void timestamp,
zero captured/refunded amounts and no capture/refund timestamp. Such unrelated
ended attempts do not permanently hold the distinct valid paid payment.

For failed/canceled/expired/voided invoices, a complete history containing only
those ended zero-counter attempts settles without credits, including multiple
voided attempts. An explicit empty array is treated as a complete no-attempt
history for these no-credit terminal states; a missing array remains unknown and
requires review. Live initiated/authorized/verified payment attempts are not
accepted as ended terminal history. Ordinary initiated/on-hold invoice observations
with consistent in-progress evidence remain PENDING without creating a hold.

These provider fields establish distinct ended attempts and their recorded
capture/refund evidence. They do not prove a historical void was previously
AUTHORIZED or was never charged. A new grant records the actual paid payment ID
in its immutable settlement observation; the compensation transaction requires a
candidate to match that recorded ID. The recorded ID also identifies the actual
reversal among multiple ended void attempts; every other attempt must still pass
the strict ended zero-counter history checks, and the binding is rechecked under
lock. A stale earlier void cannot compensate a grant bound to a different payment.
Legacy grants with no recorded payment ID retain the existing strict authoritative
refund verification path.

For an existing PAID grant, reversal detection consults that original payment ID
after the locked settlement result. Newer paid/active attempts cannot hide a void
of the credited payment as harmless history. Ambiguous mixed histories require
review without guessed compensation. Legacy grants lacking the recorded ID cannot
assume a void is unrelated. Ordinary PENDING in-progress polling remains eligible.

The marker persists across later stale paid/failed/canceled/expired/voided
observations. Existing `INVOICE_OBSERVATION / REVIEW_REQUIRED` markers also
retain the hold. Repeated observations cannot erase it or create another grant.
An ordinary verified no-credit terminal history releases its reservation through
the normal settlement transaction. Contradictory refund/capture evidence retains
review instead. The correction does not release holds already written for earlier
observations, including historical INVOICE_OBSERVATION review markers.

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
owner-approved policy and implementation. A safe audited resolution mechanism for
held PENDING purchases is a launch blocker before customers. Detection, escalation,
customer communication and rollback requirements are in
[payment-review-operations.md](payment-review-operations.md). Rollback artifacts
must preserve durable holds, strict attempt classification and grant/refund payment
identity binding. Do not use the approved older RC/main or earlier hold-aware PR3
artifact as a rollback target for these records. Software ignoring these invariants must not
process callback, poll, cron, direct settlement or support refund confirmation
traffic after the corresponding records have been written; freeze every path and
in-flight worker while establishing a verified safe artifact or forward fix.

The server cannot know about a reversal it has not yet observed. If a valid
paid observation wins before the first reversal, the established compensation
policy applies. This is not a claim that provider refunds or live merchant
configuration have been verified.

## Scoped verification

The original unit regression was observed failing before the historical fix
(PAID instead of PENDING). `src/lib/billing/settlement-refund.test.ts` exercises real settlement,
callback/poll/cron handlers with synthetic database/provider boundaries,
rollback, stale observations, identity rejection and ordinary payment behavior.
The owner-authorized classification correction needs its own exact-head unit,
native PostgreSQL and CI evidence. This document does not claim those corrected
checks have passed; the scoped manifest records the source and observed outcome.

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

For the reproducible clean PostgreSQL/CI procedure, see
[financial-review](../../ci/financial-review/README.md). Independent review
findings and unresolved policy decisions are recorded separately in
[financial-pr3-review.md](financial-pr3-review.md).
