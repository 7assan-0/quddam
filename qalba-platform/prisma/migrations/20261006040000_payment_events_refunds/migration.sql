-- Preserve prior PaymentEvent rows without inventing purchase/state/operator history.
ALTER TABLE "PaymentEvent"
 ADD COLUMN "purchaseId" TEXT,
 ADD COLUMN "providerReference" VARCHAR(200),
 ADD COLUMN "paymentReference" VARCHAR(200),
 ADD COLUMN "source" VARCHAR(30),
 ADD COLUMN "eventType" VARCHAR(40),
 ADD COLUMN "observedState" VARCHAR(30),
 ADD COLUMN "processingResult" VARCHAR(30),
 ADD COLUMN "operatorId" VARCHAR(100);
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PaymentEvent_purchaseId_receivedAt_idx" ON "PaymentEvent"("purchaseId", "receivedAt");
CREATE TABLE "PurchaseRefund" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "purchaseId" TEXT NOT NULL,
 "provider" VARCHAR(60) NOT NULL,
 "providerReference" VARCHAR(200) NOT NULL,
 "paymentReference" VARCHAR(200) NOT NULL,
 "state" VARCHAR(30) NOT NULL,
 "amountHalalas" INTEGER NOT NULL,
 "currency" CHAR(3) NOT NULL,
 "grantedCredits" INTEGER NOT NULL,
 "recoveredCredits" INTEGER NOT NULL,
 "unresolvedCredits" INTEGER NOT NULL,
 "supportStatus" VARCHAR(30) NOT NULL,
 "ledgerKey" VARCHAR(150) NOT NULL,
 "operatorId" VARCHAR(100),
 "confirmedAt" TIMESTAMP(3) NOT NULL,
 "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PurchaseRefund_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PurchaseRefund_ledgerKey_fkey" FOREIGN KEY ("ledgerKey") REFERENCES "GameCredit"("idempotencyKey") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PurchaseRefund_full_compensation_check" CHECK (
  "provider" = 'moyasar' AND "state" IN ('REFUNDED','VOIDED') AND "amountHalalas" > 0 AND "currency" = 'SAR' AND
  "grantedCredits" >= 0 AND "recoveredCredits" >= 0 AND "unresolvedCredits" >= 0 AND
  "recoveredCredits" + "unresolvedCredits" = "grantedCredits" AND
  (("unresolvedCredits" = 0 AND "supportStatus" = 'RESOLVED') OR ("unresolvedCredits" > 0 AND "supportStatus" = 'SUPPORT_REQUIRED'))
 )
);
CREATE UNIQUE INDEX "PurchaseRefund_purchaseId_key" ON "PurchaseRefund"("purchaseId");
CREATE UNIQUE INDEX "PurchaseRefund_provider_paymentReference_key" ON "PurchaseRefund"("provider","paymentReference");
CREATE UNIQUE INDEX "PurchaseRefund_ledgerKey_key" ON "PurchaseRefund"("ledgerKey");
CREATE INDEX "PurchaseRefund_supportStatus_recordedAt_idx" ON "PurchaseRefund"("supportStatus","recordedAt");
