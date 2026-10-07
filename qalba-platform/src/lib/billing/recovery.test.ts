import { afterEach, expect, it, vi } from "vitest";
import { paymentProvider } from "./provider";
import { reconcileDelay } from "./reconciliation";

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; vi.unstubAllGlobals(); });
const id = "dc876b90-42c4-44f5-b0c5-e80339a18a62";
const purchaseId = "8a869768-2d24-40d9-95a8-6b89b2de4e4b";
const invoice = { id, status: "initiated", amount: 1500, currency: "SAR", url: `https://checkout.moyasar.com/invoices/${id}`, metadata: { purchase_id: purchaseId } };
function setup(body: object) {
  process.env.MOYASAR_SECRET_KEY = "fake-test-key";
  process.env.MOYASAR_CALLBACK_TOKEN = "a".repeat(40);
  const fetcher = vi.fn(async (url: string) => Response.json(url.includes("?") ? body : invoice));
  vi.stubGlobal("fetch", fetcher); return fetcher;
}
it("recovers by documented merchant metadata query and fetches authoritative invoice", async () => {
  const fetcher = setup({ invoices: [invoice], meta: { total_pages: 1, next_page: null } });
  expect(await paymentProvider().recoverInvoice!(purchaseId)).toEqual(invoice);
  expect(fetcher.mock.calls[0][0]).toContain("metadata%5Bpurchase_id%5D=");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("missing invoice remains unknown without POST", async () => {
  const fetcher = setup({ invoices: [], meta: { total_pages: 0, next_page: null } });
  expect(await paymentProvider().recoverInvoice!(purchaseId)).toBeNull(); expect(fetcher).toHaveBeenCalledOnce();
});
it.each([
  { invoices: [invoice, invoice], meta: { total_pages: 1 } },
  { invoices: [invoice], meta: { total_pages: 2, next_page: 2 } },
  { invoices: [{ ...invoice, metadata: { purchase_id: "foreign" } }], meta: { total_pages: 1 } },
])("rejects ambiguous, incomplete and foreign recovery lists", async body => {
  setup(body); await expect(paymentProvider().recoverInvoice!(purchaseId)).rejects.toThrow();
});
it("provider 404 is distinguishable and no network error becomes a failed payment", async () => {
  setup({}); vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
  await expect(paymentProvider().fetchInvoice(id)).rejects.toMatchObject({ status: 404 });
});
it("backoff is deterministic, bounded and distinguishes pending from errors", () => {
  expect([1, 2, 3, 6, 20].map(n => reconcileDelay(n, "PENDING"))).toEqual([30000, 60000, 120000, 900000, 900000]);
  for (const outcome of ["TRANSIENT_ERROR", "NOT_FOUND", "CREATION_UNKNOWN"] as const) {
    expect(reconcileDelay(1, outcome)).toBe(60000); expect(reconcileDelay(99, outcome)).toBe(3600000);
  }
  expect(reconcileDelay(1, "TERMINAL")).toBe(0);
});
