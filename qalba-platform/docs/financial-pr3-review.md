# PR #3 independent review and correction status — 2026-10-13

This is a scoped review of financial behavior and test reproducibility, not a
release verification or authorization to merge/deploy. Production billing,
real merchant credentials and customer data were not used.

## Owner-authorized correction — 2026-10-13

After the historical review below, the owner authorized a narrow correction:
verified unrelated zero-charge historical void attempts must not permanently hold
a valid distinct paid purchase. Multiple zero-charge attempts may settle an
ordinary terminal invoice when complete financial evidence establishes that no
paid payment is being reversed. Missing, inconsistent or ambiguous evidence must
retain a durable hold. This authorization changes the prior-void acceptance
decision; it does not permit ignoring reversal evidence or releasing an existing
hold on a later snapshot.

The current correction checks complete, uniquely identified attempt histories
against the linked invoice, exact amount and SAR currency, bounded counters and
consistent timestamps. It permits one clean paid/captured payment beside distinct
ended failed/voided attempts with zero recorded capture/refund and no contradictory
financial timestamps. Complete all-ended no-credit terminal histories, including
multiple voids and explicit empty arrays, can settle; a missing array remains
unknown. Active or ambiguous terminal history retains review. Ordinary consistent
in-progress observations remain PENDING without creating a review marker.

The available fields describe distinct ended void attempts and recorded financial
evidence; they do not prove an earlier AUTHORIZED state or that the attempt was
never charged. New paid settlements record the selected payment ID in the immutable
settlement event. Compensation uses that ID to identify the actual reversal among
multiple ended void attempts, validates every other attempt's strict history, and
rechecks the binding under the Purchase lock. An earlier void cannot compensate a
grant bound to a different payment. Existing holds remain sticky; the correction
supplies no retrospective release.

The corrected coverage comprises the complete unit suite, 56 retained-fixture
native reversal scenarios, 13 B01 scenarios with complete synthetic observations,
and a 14-case in-memory rollback-hazard probe. The exact tested source and executed
results are recorded in the source-bound manifest and attached PR evidence.
The earlier `3500c50` results establish only the historical behavior described below.

The owner also authorized the durable-hold
[operations and rollback runbook](payment-review-operations.md). It specifies
detection, assignment, escalation, customer communication, immutable records and
the required freeze/drain of callback, poll, cron, direct settlement and support
refund confirmation paths, including in-flight workers.
It adds no deployed alert, financial override or audited release endpoint. A safe
fallback must preserve durable holds, strict attempt classification and the new
grant/refund payment identity binding: honoring holds alone cannot prevent an old
void from compensating a grant bound to a different payment. The approved older
RC/main and earlier hold-aware PR3 artifacts must not be used as rollback targets
for these records.
**A safe, owner-approved audited resolution mechanism for held PENDING purchases
remains a launch blocker before customers.** This limitation is separate from
scoped code correctness and routine merge review.

PR #2 remains OPEN and unmerged, and main remains `2d4e868`, as of this correction
request. There is no authorization to merge, deploy, or treat a proposed GitHub
merge SHA as a completed merge. PR #3 must be updated and its corrected checks
rerun against the actual latest main after PR #2's approval and merge.

Current recommendation: **NOT READY for routine merge** until PR #2 is actually
approved and merged, PR #3 is updated against that resulting main, and its relevant
checks pass on the new exact head. The prior-void policy decision is now authorized.
Launch remains blocked by the audited resolution mechanism and operational
readiness regardless of a later scoped merge result.

## Historical independent review of `3500c50` — 2026-10-13

The remaining sections preserve the findings and recommendation recorded before
the owner authorized the correction. Their source references, observed behavior
and acceptance decisions apply to `3500c50`, not to the corrected implementation.

### Source and PR status at historical review start

At review start, GitHub independently reported:

- main: `2d4e868ba43700414c19ece1394bf6815e7639cf`.
- [PR #2](https://github.com/7assan-0/quddam/pull/2): OPEN, not merged, no
  submitted reviews; head `736e6afb09efb22e6cadd1b5afc3f8b735440c65`.
- [PR #3](https://github.com/7assan-0/quddam/pull/3): OPEN, not merged; reviewed
  financial implementation `3500c50f9afe9e3232544cf24d0c77fa4beeedae`.

No merge was performed. Updating PR #3 onto PR #2 is conditional on its actual
approval and merge; GitHub's proposed merge SHA is not proof of a merge. Once
that happens, fetch main, preserve the financial source bytes/behavior, resolve
only verification metadata conflicts, and rerun the scoped checks on the new
exact PR head. The evidence manifest, not this status snapshot, identifies
the source used for each test run.

The approved `v1.0.0-rc.1` and its evidence remain immutable. PR #2's pinned
successor target also does not establish verification of PR #3. These scoped
tests cover neither the complete release gate nor live provider behavior.

### Verified controls in the historical source

- `src/lib/billing/checkout.ts:93–117`: Purchase FOR UPDATE precedes the
  authoritative reread, identity check and pending reversal/hold decision.
  The hold and normal settlement side effects commit atomically. A reversal
  already observed for a pending purchase prevents later stale terminal
  observations from granting/releasing coupons.
- `src/lib/billing/payment-events.ts:10–22`: immutable deduplicated identities
  include purchase, invoice, source, type and normalized state. A duplicate
  callback cannot overwrite a hold. Different sources retain their own marker.
- `src/lib/billing/checkout.ts:40–62`: callbacks/polling/cron use the locked
  returned status when the initial pending read races a paid settlement. If the
  legitimate paid observation wins before the reversal, existing authoritative
  refund compensation is used. Network lookups remain outside row locks.
- `src/lib/billing/refunds.ts:18–88`: invoice and selected payment validation,
  Purchase/wallet locks, unique compensation and balance cap preserve the paid
  grant and prevent duplicate/future clawbacks. Partial/ambiguous/unsupported
  `reversed` observations cannot manufacture a compensation.
- `src/app/api/billing/callback/route.ts:14–23`: the authenticated bounded
  callback is an invoice hint; its amount/status do not authorize a grant.
  The owned polling route and bounded cron queue use the same service.

### Historical unresolved merge decisions and edge cases

#### 1. Prior zero-charge void attempts can permanently block a legitimate purchase

Reproducible shape: a paid invoice has one historical payment
`status=voided, captured=0, refunded=0` and one current paid payment. The new
detector sees the historical void (`refunds.ts:8–11`), while the prepayment
exception requires the *invoice* to be VOIDED (`checkout.ts:104–109`). The
purchase stays PENDING, wallet/grant remain unchanged and coupon stays reserved.
A later paid snapshot with only the current payment still cannot settle because
the marker is durable (`checkout.ts:101–111`). Failed-then-paid attempts proceed.

Likewise, a VOIDED invoice with two uncaptured/unrefunded void attempts remains
PENDING, and a FAILED invoice with one such attempt remains PENDING. A VOIDED
invoice without payments or with one zero-charge void settles VOIDED normally.

This is confirmed behavior, not proof that a real merchant has delivered those
combined snapshots. It is a high-priority policy/contract gap: the unchanged
approved policy says pre-payment voids are normal B01 terminal settlements
(`docs/PAYMENT_REFUNDS.md:9`); the new tests/document deliberately impose a
narrower exception. Do not infer business approval from a passing test.

Public provider documentation retrieved on 2026-10-13 describes invoice
`payments` as "Payment attempts made against this invoice" and permits voiding
an authorized payment before capture. It supplies no evidence that the combined
retry histories above are impossible:

- https://docs.moyasar.com/api/invoices/04-show-invoice
- https://docs.moyasar.com/api/payments/payment-status-reference

Acceptance: owner explicitly accepts these permanent holds as intended policy,
or approves a narrowly defined way to distinguish an unrelated prepayment
attempt from reversal of the actual financial payment, with counterexamples
covered by unit/native tests. Do not automatically loosen the denial criterion.

#### 2. Review holds require an operator disposition policy

`confirmSupportRefund` rejects PENDING purchases (`refunds.ts:93–99`). There
is no audited hold-release mechanism. Ordinary polling reports PENDING and
callbacks acknowledge the hold; cron treats it as ordinary PENDING, not a
failure (`reconciliation.ts:29–38`). Coupon reservations remain held. This
protects credits but can silently accumulate cases for manual review.

Acceptance: document who monitors REFUND_REVIEW/REVIEW_REQUIRED, response time,
customer communication and permissible disposition. Decide whether a separate
authorized resolution implementation is required before exposure to customers.
Deleting review/audit records or refunding an unpaid purchase is not a remedy.

#### 3. Rolling back to main would ignore durable holds

The pre-PR main settlement path does not query review markers. A held PENDING
purchase followed by a stale paid observation after software rollback could
receive a grant. Current PR code protects the marker; old software does not.

Acceptance: financial rollback must retain the hold-aware settlement path or
suspend all settlement entry points until a safe forward fix. Restoring older
code alone is not a safe rollback once holds have been written. No deployment
or rollback was performed to demonstrate this operational hazard.

#### 4. Existing scope limitations remain

Two paid payments with no reversal still grant once. This predates PR #3; the
hold applies to mixed histories containing reversal evidence. Documentation
has been clarified without changing settlement behavior. Out-of-order
unobserved provider reversals cannot be predicted; a valid paid winner is
compensated when a later supported full reversal is verified. Live delivery,
unsupported statuses, retention/recovery and monitoring remain launch gates.

### Historical reproducible evidence

Follow [the clean PostgreSQL procedure](../../ci/financial-review/README.md).
It uses the original forward migrations and content-only seed on two fresh
synthetic databases. No resets/deletion, live HTTP or release artifacts are
needed. The new runner fails on dirty or changed tracked source, wrong/native
PostgreSQL version/target, missing cases, failed assertions or invalid physical
backend contention evidence. Only an allowlisted sanitized manifest is uploaded.

Native reversal acceptance covers direct settlement, actual callback,
poll/reconciliation service, cron, sticky stale observations, legitimate paid
and prepayment voids, both purchase winner orders and actual Board START/refund
wallet contention. Owned polling authentication is covered in the unit handler
tests with synthetic session/database boundaries. These distinctions matter:
service checks do not claim a full HTTP deployment test.

The attached PR evidence identifies the exact commit/tree and tracked source
inventory, tool versions, command exits, case names/counts, raw report hashes
and distinct backend counts. Raw fixtures/logs stay private. Hosted CI success
must be observed separately; configuring the workflow is not executing it.

### Historical recommendation

NOT READY for merge until the prior-void/permanent-hold decisions have explicit
owner disposition, PR #2 has been approved/merged, and PR #3 has been updated
and tested against that latest main. A passing scoped run demonstrates the
implemented behavior on its recorded source; it does not close those gates.
