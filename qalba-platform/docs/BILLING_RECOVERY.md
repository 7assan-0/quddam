# Invoice recovery and reconciliation

Scope: M01/M02 only. Existing B01 `settleInvoice` and `settleLockedPurchase` are unchanged. No refunds or game debits changed.

## Creation

Purchase is the durable intent: ID, amountHalalas, provider=moyasar, expiry, credits, idempotencyKey and coupon reservation commit first. New rows start NOT_CREATED. A short Purchase FOR UPDATE transaction claims UNKNOWN_OUTCOME and invoiceCreationAttemptAt, commits, then one caller POSTs the invoice with stable metadata.purchase_id. No HTTP runs within a transaction. Linking validates provider, UUID reference supplied by provider parsing, exact purchase metadata, SAR amount and HTTPS checkout.moyasar.com URL; a second short row lock rejects a conflicting existing reference. Successful linking becomes CREATED. Reservation is never repeated on retry.

UNKNOWN_OUTCOME retries perform GET /invoices?metadata[purchase_id]=... followed by authoritative GET /invoices/{id}; no POST. List must be one complete page with zero or one result. Multiple candidates, pagination, mismatched metadata/reference/amount/currency and malformed responses fail closed. Empty search is still unknown, never proof that POST did not happen. There is no documented invoice-search visibility bound or invoice creation idempotency guarantee. Payment given_id documentation is not applied to invoices.

Crash before the committed UNKNOWN claim leaves NOT_CREATED and safely retries once. Crash after that commit but before actual HTTP is indistinguishable from lost successful HTTP; it remains recovery-only. If nothing is found, automated retries cannot resolve that uncertainty; payment support must investigate with the stable Purchase ID, without blindly recreating or releasing its coupon reservation. This conservative limitation is deliberate. No administrator recovery UI or refund automation is added. Unknown purchases can be recovered after local expiry and are never locally marked FAILED just because the creation response was lost. Only demonstrably NOT_CREATED expired rows retain existing local FAILED cleanup.

Migration marks all legacy referenced rows CREATED and legacy unreferenced rows UNKNOWN_OUTCOME, because the old system cannot prove whether remote creation occurred. Old metadata already used purchase_id. Legacy linked invoices retain existing reference/amount/currency validation without requiring new metadata; newly created invoices additionally require their captured purchase metadata on polling/callback/cron fetch. Callback for an unlinked unknown invoice remains 404 until polling/cron recovers the reference; no callback body is trusted as invoice data.

Official contracts inspected 2026-10-05:
- https://docs.moyasar.com/api/invoices/01-create-invoice
- https://docs.moyasar.com/api/invoices/03-list-invoice
- https://docs.moyasar.com/api/idempotency

Verified by documentation and deterministic fake contract tests; no real merchant sandbox credentials or live provider recovery check was performed.

## Reconciliation

One batch claims at most 50 eligible PENDING purchases, ordered nextReconcileAt, createdAt, id with FOR UPDATE SKIP LOCKED. Attempt timestamp/count, UUID lease and next eligibility commit before provider HTTP. Three bounded workers. Lease is ten minutes: at most 17 waves, with three 10-second requests per unknown recovery (list/fetch/status fetch), normally under 510 seconds. A crashed job becomes eligible at lease expiry. Very slow DB/worker suspension can overlap an expired lease; B01 prevents duplicate settlement and lease-ID compare-and-set prevents stale schedule overwrite. No exactly-once external GET claim is asserted under arbitrary process suspension.

PENDING backoff: 30s, 60s, 120s, 240s, 480s, then 15m maximum. TRANSIENT_ERROR, NOT_FOUND and CREATION_UNKNOWN: 60s, 120s, 240s, 480s, 960s, 1920s, then 1h maximum. Counter includes all cron attempts and saturates exponential calculation. Eligibility is based on completion time. New purchases are immediately eligible; served stale purchases move behind other eligible rows. Terminal rows leave the status-filtered queue. Provider network/404/unknown failures never become payment FAILED. Callback/polling still promptly fetch directly, bypassing cron backoff, and use the same B01 settlement primitive.

Forward migration adds state/attempt fields and reconciliation scheduling/lease/count fields, state/nonnegative count checks and (status,nextReconcileAt,createdAt) index. No old migration is edited. No terminal payment enum, ledger key, coupon counter or financial analytics semantics changes.

M03 refunds/consumed-credit policy remains open; product and payment support must define it. No M04/M05 or other audit work is included.
