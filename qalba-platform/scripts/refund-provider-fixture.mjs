// Test process preload only. Not imported by application code or deployment.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
if (process.env.BILLING_TEST_DATABASE !== '1' || !process.env.E2E_DATABASE_URL?.includes('@127.0.0.1:') || !process.env.REFUND_PROVIDER_FIXTURE_FILE) throw new Error('Refund provider fixture requires isolated native test DB');
const original = globalThis.fetch;
globalThis.fetch = async (input, options = {}) => {
  const url = String(input);
  if (!url.startsWith('https://api.moyasar.com/v1/')) return original(input, options);
  const file = process.env.REFUND_PROVIDER_FIXTURE_FILE;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const path = new URL(url).pathname.replace('/v1', '');
  if (path === '/invoices' && options.method === 'POST') {
    const body = JSON.parse(options.body);
    const id = randomUUID(), paymentId = randomUUID();
    const payment = { id: paymentId, status: 'paid', amount: body.amount, currency: body.currency, refunded: 0, captured: 0, invoice_id: id, refunded_at: null, voided_at: null };
    const invoice = { id, status: 'initiated', amount: body.amount, currency: body.currency, metadata: body.metadata, url: `https://checkout.moyasar.com/invoices/${id}`, payments: [payment] };
    data.invoices[id] = invoice; data.payments[paymentId] = payment;
    fs.writeFileSync(file, JSON.stringify(data)); return Response.json(invoice);
  }
  const match = path.match(/^\/(invoices|payments)\/([a-f0-9-]+)$/);
  if (!match) throw new Error('Unexpected contract fixture request');
  const value = data[match[1]][match[2]];
  return value ? Response.json({ ...value, source: { token: 'SENSITIVE_FIXTURE_SENTINEL', number: 'SENSITIVE_CARD_SENTINEL' }, ip: '192.0.2.199', callback_url: 'SENSITIVE_CALLBACK_SENTINEL' }) : new Response('', { status: 404 });
};
