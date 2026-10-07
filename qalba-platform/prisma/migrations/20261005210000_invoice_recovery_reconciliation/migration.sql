BEGIN;
ALTER TABLE "Purchase"
  ADD COLUMN "invoiceCreationState" VARCHAR(30) NOT NULL DEFAULT 'NOT_CREATED',
  ADD COLUMN "invoiceCreationAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lastReconcileAttemptAt" TIMESTAMP(3),
  ADD COLUMN "nextReconcileAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "reconcileAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reconcileLeaseId" VARCHAR(36);
-- Legacy missing references are ambiguous; never assume no remote invoice exists.
UPDATE "Purchase" SET "invoiceCreationState" = CASE WHEN "providerReference" IS NULL THEN 'UNKNOWN_OUTCOME' ELSE 'CREATED' END;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_invoice_creation_state_check"
  CHECK ("invoiceCreationState" IN ('NOT_CREATED', 'UNKNOWN_OUTCOME', 'CREATED')),
  ADD CONSTRAINT "Purchase_reconcile_attempt_count_check" CHECK ("reconcileAttemptCount" >= 0);
CREATE INDEX "Purchase_status_nextReconcileAt_createdAt_idx" ON "Purchase"("status", "nextReconcileAt", "createdAt");
COMMIT;
