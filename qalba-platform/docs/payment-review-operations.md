# Payment review holds: operations and safe rollback

This runbook covers durable review holds on PENDING purchases and the separate
review of unsupported reversals on PAID purchases. It preserves the approved
[full-refund and consumed-credit policy](PAYMENT_REFUNDS.md). It does not deploy
monitoring, authorize provider money movement, or implement a hold-release API.

## Launch requirements and responsibility

Before customer exposure, the owner must name a Billing Support lead and backup,
a billing engineering on-call contact, an approved restricted case system, and
the alert destination. Billing Support owns customer communication and merchant
verification; engineering owns application evidence, reconciliation failures and
safe recovery. Both retain responsibility until a case has an audited disposition.

The proposed operating targets are a read-only detection run at least every five
minutes, acknowledgement of a new hold within 30 minutes, engineering escalation
if investigation cannot establish the payment history within four hours, and a
customer update within one business day and each business day while unresolved.
The owner must accept or replace these targets before launch. These are runbook
targets, not evidence that an alert or service guarantee is configured.

**A safe, owner-approved, audited resolution mechanism for held PENDING purchases
is a launch blocker before customers.** Monitoring and investigation alone cannot
release an existing hold. This PR supplies no resolution endpoint. The owner must
approve the permitted dispositions and their implementation, authorization,
concurrency checks, immutable audit and coupon handling before customer exposure.
Existing refund confirmation supports PAID purchases only.

## Detect and alert

An HTTP 200 callback acknowledgement, PENDING polling result, or cron run with
zero failures does not establish that a purchase is healthy. A review hold is a
persisted payment event, and pending reconciliation can continue to back off while
the case remains unresolved.

Implement the detection report through reviewed, read-only application access;
this runbook authorizes no direct database intervention. Its durable-hold filter is:

| Field | Required value |
| --- | --- |
| Purchase status | PENDING |
| PaymentEvent purchaseId | The same Purchase ID |
| PaymentEvent provider | moyasar |
| PaymentEvent processingResult | REVIEW_REQUIRED |
| PaymentEvent eventType | REFUND_REVIEW or INVOICE_OBSERVATION |

Include all sources: CALLBACK, POLL, CRON, SETTLEMENT and any historical linked
review marker. A marker from one source remains a hold when another source later
reports paid, failed, canceled, expired or voided. Historical nullable event fields
remain unknown; do not invent a backfill or infer a resolution from missing data.

Group alerts by purchase so deduplicated events from different sources do not
create separate cases. Report the oldest review time, newest observation time,
observed states/sources, age, coupon reservation and whether a case is assigned.
Alert on each newly held purchase, overdue acknowledgement/investigation, growing
backlog and provider/reconciliation failures. Track PAID REFUND_REVIEW cases in a
separate queue under PAYMENT_REFUNDS.md; a pending hold is not a confirmed refund.
Keep these records and reports restricted; omit callback bodies, credentials,
card/source data and unnecessary customer details.

The current admin API can inspect a known purchase using
`GET /api/admin/purchases/<id>/refund` with the existing active ADMIN session.
It returns only the first 50 audit events, so it is not a complete global hold
queue or proof that later events are absent. A reviewed detection/alerting report
must cover every matching purchase and its relevant history. The current code
does not implement that report, paging or case assignment.

## Investigate and communicate

1. Open a restricted case tied to the Purchase ID; record the assigned operator,
   timestamps, review marker identities and a due time for the next update.
2. Inspect the admin view and approved application audit access. Preserve original
   amount/credits, status/paidAt, provider and invoice references, original grant,
   any compensation, coupon reservation and observations from every source.
3. Use the trusted merchant dashboard and server-authorized provider verification
   to establish the linked invoice and complete payment-attempt history. Verify
   provider, invoice/payment IDs, purchase metadata, original amount, SAR currency,
   status, captured/refunded amounts and relevant timestamps. Customer screenshots
   and callback status/amount are hints only. Missing, inconsistent or incomplete
   evidence remains unresolved and is escalated to billing engineering/support.
4. Establish a complete history and distinguish the actual paid financial payment
   from a different ended void attempt with zero recorded capture/refund and no
   contradictory financial timestamps. The available provider fields do not prove
   that the voided attempt was previously AUTHORIZED or was never charged. The
   owner-authorized correction requires the supported complete evidence and binds
   the grant to the distinct paid payment ID; ambiguity retains a durable hold.
   A later clean-looking snapshot does not erase an earlier hold.
5. Tell the customer that payment verification is under review, whether credits
   have been granted, and when the next update is due. Explain any separately
   verified provider monetary result accurately. Do not promise a refund, credit
   grant, coupon release, resolution time or automatic future recovery that the
   application has not authorized and completed.
6. Record evidence, findings, requested disposition and approvals in the restricted
   case. A case note or merchant confirmation does not itself alter purchase,
   wallet, coupon, refund or audit state.

## Permitted outcomes and immutable records

An ordinary purchase with complete evidence and no durable hold can follow the
normal settlement path. An existing hold remains PENDING with its coupon reserved
until the separately approved audited resolution mechanism exists and validates
the disposition. Do not release it through a retry, a replacement checkout, an
arbitrary wallet grant, a status/coupon edit or deletion of payment events.

If the purchase is already PAID and a full refund or supported post-payment VOIDED
reversal is authoritatively confirmed, the existing support confirmation API may
record exactly one compensation under PAYMENT_REFUNDS.md. Keep the original PAID
purchase/grant unchanged. Preserve SUPPORT_REQUIRED and consumed-credit remainders;
later top-ups and retries do not create another deduction. This flow cannot refund
or resolve a held unpaid local purchase.

Partial, unsupported, conflicting or incomplete histories remain support cases.
Preserve original purchase facts and retain immutable PaymentEvent, PurchaseRefund
and GameCredit audit records under the financial retention policy. Normal
reconciliation scheduling does not resolve a hold. This runbook includes no direct
database writes, cleanup, automatic release, override or bypass.

## Rollback after a durable hold or bound paid grant has been written

Older settlement code that ignores review markers can grant a held purchase after
a stale paid observation. Code that preserves holds but ignores the new grant's
recorded payment ID can compensate the wrong historical void and deduct credits
from a different paid payment. Once a durable hold or bound paid grant exists,
rolling back without its required enforcement is unsafe even if the earlier
release passed its own tests. Database restoration, audit deletion and expiration
of worker leases do not make such a rollback safe.

Use a verified artifact that preserves durable-hold enforcement, strict complete
attempt classification and grant/refund payment identity binding, or prepare a
verified forward fix. Do not use the approved older RC/main or earlier hold-aware
PR3 artifact as a rollback target for these records: prior approval or hold
awareness alone is insufficient. Before any financial rollout/rollback:

1. Inventory every settlement entry point and process: provider callbacks,
   owned-purchase polling, pending and paid refund cron jobs, direct/internal
   `settleInvoice` and `processObservedRefund` callers, support refund confirmation
   mutations, checkout/recovery workers and all replicas.
2. Freeze new financial work through a verified maintenance/admission control
   covering every entry point. Disable scheduled job launches and prevent new
   checkout work. Stopping cron alone, hiding a browser page or freezing one
   replica is insufficient. Keep the verified artifact enforcing all these invariants
   serving where a complete freeze cannot be established.
3. Drain or terminate every in-flight request, worker and old replica; verify
   completion or transaction rollback through approved operational evidence.
   A ten-minute lease timeout is not proof that a worker has stopped. Prevent
   delayed workers or queued jobs from resuming with code that ignores holds,
   strict attempt classification or recorded grant/refund payment identity.
4. Preserve payment/audit records and provider references. If callbacks are paused,
   do not acknowledge an unpersisted observation as successfully processed. Verify
   the merchant's retry/recovery behavior; this repository does not establish a
   durable callback queue or guaranteed provider retry. Reconcile affected linked
   invoices authoritatively with code enforcing all these invariants when service resumes.
5. Verify the candidate artifact against durable holds from every source, including
   historical INVOICE_OBSERVATION markers. Exercise stale paid/failed/canceled/
   expired/voided replay, a stale historical void against a grant bound to a distinct
   paid payment, selection of the actual bound reversal among multiple ended voids,
   strict history rejection, both settlement winner orders, exactly-once compensation
   and wallet contention. Record its exact commit/artifact and passing evidence.
6. Reopen entry points only after all active processes use the verified artifact
   enforcing all these invariants and the hold queue, alerts and reconciliation are
   checked. Existing holds remain held; recovery is not a hold-release authorization.

If no verified safe artifact or complete freeze is available, keep the verified
implementation enforcing all these invariants in place and escalate for a forward
fix. An artifact ignoring durable holds, strict attempt classification or recorded
grant/refund payment identity must not handle callback, poll, cron, direct settlement
or support refund confirmation traffic after the corresponding records have been
written. Deployment and rollback require their own authorization; none was performed
as part of this documentation work.
