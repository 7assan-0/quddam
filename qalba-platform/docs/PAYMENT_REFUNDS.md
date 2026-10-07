# Launch payment/refund support policy — Phase 5.0C-4

## Supported policy

Only the **entire original paid purchase amount** is supported. The provider can issue partial refunds, but Quddam does not account for them in this release. A partial/unconfirmed/ambiguous observation fails closed with 409, records a deduplicated review marker when the known purchase is being reconciled, and requires support. No fractional credit conversion or chargeback product is introduced.

Support issues an approved full monetary refund in the Moyasar dashboard using the merchant's existing authority, then confirms it in Quddam. Quddam **does not call the external refund POST API**. The support API accepts only invoice/payment references; it cannot initiate money movement, choose a wallet delta, override verification or refund an unpaid purchase.

The original Purchase remains PAID with its original paidAt, amount and credits. Its `purchase:<id>` GameCredit grant is retained unchanged. A separate PurchaseRefund stores REFUNDED (or confirmed post-payment VOIDED), original amount, recovered credits, unresolved credits and supportStatus. Pre-payment voids are normal B01 terminal settlements, with no refund compensation.

## Credit recovery and consumed-credit limitation

The ledger knows the original grant, but does not attribute historical consumption to a particular purchase. No retroactive FIFO/LIFO is assumed. The immediately recoverable maximum is **min(original purchase grant, current positive wallet balance)**, regardless of the wallet's sources. This balance cap can include other grants; it is not proof those credits came from the refunded purchase. Support must explain and review that limitation before approving a provider refund.

The server locks the wallet and writes `purchase-refund:<purchaseId>:full`, an explicit compensating ledger entry. It records a zero delta when no balance is available. The wallet cannot become negative. The remaining grant amount is stored as unresolvedCredits with SUPPORT_REQUIRED. This is a support review obligation, **not automatically collectible debt**. Do not silently take later credits, alter already played games, delete game history or rewrite paid grants. A later top-up or refund retry does not trigger another deduction.

Unused full grant: deduct the grant and mark RESOLVED. Partial/all consumption: deduct the capped available amount, retain the remainder, escalate to support. Any further remedy requires a separately authorized and audited product/support decision outside this phase.

## Authoritative verification

Both the linked invoice (`GET /v1/invoices/:id`) and the selected payment (`GET /v1/payments/:id`) are fetched using server credentials before the compensation transaction. Require provider moyasar, invoice reference, exact original amount, SAR currency, merchant metadata purchase_id, one unambiguous financial payment, matching payment ID and invoice_id, and a verified full refunded amount. A VOIDED reversal requires the documented voided state/timestamp and an already PAID local grant. Missing legacy merchant metadata is a support verification gap; there is no unsafe bypass.

Callbacks are hints only. Existing invoice hints `{id: invoiceId}` remain supported; documented payment webhook hints `{type: payment_refunded|payment_voided|payment_paid|payment_failed|payment_captured, data: {id, invoice_id}}` locate the invoice. Callback amounts/status/secret_token/card/source/body data never authorize a compensation. The existing URL callback token and bounded 16 KiB reader remain required. Register the endpoint with the provider's supported callback/webhook configuration; no live registration was performed here.

## Minimal admin workflow

1. Require the existing active ADMIN session and same Origin for mutations.
2. Inspect `GET /api/admin/purchases/<id>/refund`: original PAID facts, safe audit events and compensation/support remainder. References come from trusted merchant records, not customer screenshots alone.
3. Inspect the provider dashboard and verify the purchase metadata, invoice and payment references, original amount/currency, full refund result and original ledger grant. Approve/explain the balance cap and consumed-credit policy.
4. After the provider confirms the monetary refund, POST `{providerReference: <invoice UUID>, paymentReference: <payment UUID>}` to that same endpoint.
5. The server re-fetches both provider objects and verifies them, rechecks the operator's ADMIN/non-suspended account, locks Purchase then CreditWallet, creates one compensation/refund, and audits the operator. Repeating it returns the saved operation without a second deduction. Conflicting references are 409.
6. If SUPPORT_REQUIRED, retain the case for human review. GET shows the outstanding credit count. There is no automatic future clawback or adjustment endpoint in this release.

Anonymous/USER are denied; request fields are strict and arbitrary amount/delta/userId are rejected. Responses omit card data, raw callbacks, tokens and unnecessary customer PII.

## Event history and deduplication

Existing PaymentEvent's unique `(provider, externalId)` is reused. New nullable columns link the purchase and safe references, source, type, observed state, result and optional operator ID. Old rows remain unchanged with unknown fields null; no fabricated backfill. New financial events are insert-only. externalId is a SHA-256 identity over purchase, invoice, source, event type, normalized state, optional payment and optional support operator; it is independent of callback bodies, timestamps, random event IDs and poll counts. A duplicate does not overwrite the original processing result.

Sources: CHECKOUT durable unknown-outcome intent and invoice linkage; RECOVERY authoritative recovered linkage; CALLBACK, POLL, CRON meaningful verified invoice/refund observations; SETTLEMENT direct internal settlement; LOCAL_EXPIRY local failed terminal expiry; SUPPORT confirmation/review with authenticated operator. Record at most one identical state/type/source identity, rather than every harmless poll. Unknown provider state text is normalized to `unknown`, not copied into audit fields. B01 transition/grant/coupon/analytics and its observation commit atomically. Refund balance/ledger/refund/events also commit atomically. Network exceptions do not turn payments into FAILED or refunds into confirmed.

## Reconciliation and race behavior

M02's pending queue keeps its 50-row batch and concurrency 3. A separate paid-observation queue uses at most 10 rows, concurrency 3 and the same 10-minute lease/skip-locked pattern. Ordinary paid observations reschedule for one hour; errors use M02's existing bounded 60s exponential backoff capped at one hour. Confirmed refunds leave this queue. Order by due time then creation time prevents old paid records from occupying every eligible batch. The pending queue is processed first, so refund monitoring never consumes its 50 slots. Size/cadence are conservative; refunds for very large installed paid histories can be discovered faster by callback/support, not an instant global scan.

At PostgreSQL READ COMMITTED, Purchase FOR UPDATE serializes full refund creation. CreditWallet FOR UPDATE uses the same row as the unchanged conditional game START decrement. If START wins it consumes one credit and the refund sees the remaining balance/remainder. If refund consumes the last balance first, START returns its existing 402 and its command/state mutation rolls back. No games are reversed.

## Retention and remaining scope

PaymentEvent, PurchaseRefund and GameCredit are financial/support audit records: keep them with original purchases, restricted access and backups; do not put them under short gameplay/auth-counter or analytics pruning. No destructive financial TTL is assigned: the duration needs business/accounting/legal confirmation. See [data-retention.md](data-retention.md) for the implemented M12 operational cleanup and explicit financial exclusions.

No live sandbox credentials/refund API were exercised. Deterministic fixtures test the documented shapes, authenticated lookups, identity checks and database effects. Merchant live/sandbox refund delivery and account-specific configuration remain release-operational verification.

Primary contract checked 2026-10-06:
- https://docs.moyasar.com/api/invoices/04-show-invoice
- https://docs.moyasar.com/api/payments/02-fetch-payment
- https://docs.moyasar.com/api/payments/05-refund-payment
- https://docs.moyasar.com/api/payments/payment-status-reference
- https://docs.moyasar.com/api/other/webhooks/webhook-reference
