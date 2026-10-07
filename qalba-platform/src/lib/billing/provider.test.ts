import { afterEach, expect, it, vi } from "vitest";
import { paymentProvider } from "./provider";

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; vi.unstubAllGlobals(); });
it("sends a hosted invoice with server credentials and validates the response", async () => {
  process.env.MOYASAR_SECRET_KEY = "sk_test_example";
  process.env.MOYASAR_CALLBACK_TOKEN = "a".repeat(40);
  process.env.APP_URL = "http://localhost:3000";
  const id = "dc876b90-42c4-44f5-b0c5-e80339a18a62", purchaseId = "8a869768-2d24-40d9-95a8-6b89b2de4e4b";
  const mock = vi.fn(async (_url: string, options: RequestInit) => {
    expect(options.headers).toMatchObject({ Authorization: `Basic ${Buffer.from("sk_test_example:").toString("base64")}` });
    const body = JSON.parse(options.body as string);
    expect(body).toMatchObject({ amount: 1500, currency: "SAR", metadata: { purchase_id: purchaseId } });
    expect(body.callback_url).toContain("/api/billing/callback?token=");
    return new Response(JSON.stringify({ id, amount: 1500, currency: "SAR", status: "initiated", url: `https://checkout.moyasar.com/invoices/${id}` }), { status: 201 });
  });
  vi.stubGlobal("fetch", mock);
  const invoice = await paymentProvider().createInvoice({ amount: 1500, title: "باقة", purchaseId, expiresAt: new Date(Date.now() + 30_000) });
  expect(invoice.id).toBe(id); expect(mock).toHaveBeenCalledOnce();
});
