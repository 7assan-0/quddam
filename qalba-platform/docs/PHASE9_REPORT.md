# Phase 9 report — checkout and game credits

## Implemented

Players see active products priced from the database and may create a hosted Moyasar invoice. A coupon is reserved atomically at checkout; the purchase stores the charged price and credit quantity so later admin edits do not alter it. Invoice callbacks, player status checks and a scheduled reconciliation endpoint fetch the invoice with the server secret, compare ID, amount, currency and paid status, then grant credits in the same transaction as marking the purchase paid. A unique ledger key prevents duplicate grants. Failed invoices release coupon reservations; a cron job also expires purchases that never obtained an invoice. Checkout remains disabled with a clear explanation until provider credentials are configured.

## Files changed

`src/lib/billing/{provider,checkout}*`, `src/app/api/billing/**`, `src/app/{pricing,billing/return}/**`, `src/components/{checkout-card,purchase-status}.tsx`, product and profile navigation, home content, `scripts/checkout-*`, `tests/e2e/checkout.spec.ts`, `prisma/schema.prisma`, migration, `.env.example`, checklist and README.

## Database changes

`Coupon.reservedCount` blocks overbooking pending discounts. `Purchase.credits`, `checkoutUrl`, `expiresAt` and `couponReserved` preserve the exact order and lifecycle; pending status/expiry is indexed. No prices are hard-coded into application logic.

## Tests executed and results

ESLint, typecheck, 36 unit tests, migration/seed plus mock-provider payment integration, and production build passed. Adapter unit test, full HTTP integration, and targeted Playwright checkout journey passed. Mock integration verifies snapshot pricing, coupon limit, amount mismatch rejection, duplicate webhook reconciliation, paid grant once, failed invoice, and expired uninvoiced cleanup. Browser test verifies admin product price appears and checkout fails closed without credentials.

## Operations and known limits

Set `MOYASAR_SECRET_KEY`, random 32+ character `MOYASAR_CALLBACK_TOKEN`, `BILLING_CRON_SECRET`, and public HTTPS `APP_URL`. Configure the scheduled job to POST `/api/billing/reconcile` with `Authorization: Bearer <BILLING_CRON_SECRET>` at least every few minutes. Provider methods are isolated in `src/lib/billing/provider.ts`; test and live keys determine the gateway mode. Live payment methods depend on the merchant account configuration. We did not submit a real Mada, Apple Pay or card transaction without merchant credentials. Invoice callbacks and return pages both reconcile through the provider; a production webhook/load rehearsal is still needed before charging customers.
