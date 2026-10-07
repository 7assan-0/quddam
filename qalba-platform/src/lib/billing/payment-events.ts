import { createHash } from "node:crypto";
import type { Prisma, Purchase } from "@/generated/prisma/client";

export type PaymentSource = "CALLBACK" | "POLL" | "CRON" | "CHECKOUT" | "RECOVERY" | "SUPPORT" | "LOCAL_EXPIRY" | "SETTLEMENT";
type EventType = "INVOICE_CREATION_INTENT" | "INVOICE_OBSERVATION" | "INVOICE_CREATED" | "INVOICE_RECOVERED" | "REFUND_CONFIRMED" | "SUPPORT_CONFIRMATION" | "LOCAL_EXPIRY" | "REFUND_REVIEW";
type Result = "SETTLED" | "NOOP" | "PENDING" | "CONFLICT_IGNORED" | "LINKED" | "REFUND_APPLIED" | "REFUND_RECORDED" | "REVIEW_REQUIRED";
const states = new Set(["initiated", "paid", "failed", "refunded", "canceled", "on_hold", "expired", "voided", "authorized", "captured", "verified", "unknown"]);
export function safePaymentState(state: string) { return states.has(state) ? state : "unknown"; }

export function paymentEventIdentity(input: { purchaseId: string; providerReference: string | null; source: PaymentSource; eventType: EventType; state: string; paymentReference?: string; operatorId?: string }) {
  // A fixed number of meaningful states per source, independent of poll count, timestamp or callback body.
  return `quddam:v1:${createHash("sha256").update(JSON.stringify([input.purchaseId, input.providerReference, input.source, input.eventType,
    safePaymentState(input.state), input.paymentReference ?? null, input.operatorId ?? null])).digest("hex")}`;
}
export async function recordPaymentEvent(tx: Prisma.TransactionClient, purchase: Pick<Purchase, "id" | "providerReference">, input: {
  source: PaymentSource; eventType: EventType; state: string; result: Result; paymentReference?: string; operatorId?: string;
}) {
  const now = new Date();
  return tx.paymentEvent.createMany({ data: [{ provider: "moyasar", externalId: paymentEventIdentity({ purchaseId: purchase.id, providerReference: purchase.providerReference, ...input }),
    purchaseId: purchase.id, providerReference: purchase.providerReference, source: input.source, eventType: input.eventType,
    observedState: safePaymentState(input.state), processingResult: input.result, paymentReference: input.paymentReference, operatorId: input.operatorId,
    receivedAt: now, processedAt: now }], skipDuplicates: true });
}
