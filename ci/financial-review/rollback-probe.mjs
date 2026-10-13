#!/usr/bin/env node
/** In-memory rollback-hazard regression. No deployment, PostgreSQL or provider access. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, realpathSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repository = realpathSync(process.argv[2] ?? fileURLToPath(new URL('../../', import.meta.url)));
const application = path.join(repository, 'qalba-platform');
const dependency = createRequire(path.join(application, 'package.json'));
const ts = dependency('typescript');
const baseline = '2d4e868ba43700414c19ece1394bf6815e7639cf';
const bindingBaseline = 'b6c61cca11a87c69eec4372acb34a0fcb34f6cec';
const settlementSources = ['SETTLEMENT', 'CALLBACK', 'POLL', 'CRON'];
const reconciliationSources = ['CALLBACK', 'POLL', 'CRON'];
const expectedCases = (settlementSources.length + reconciliationSources.length) * 2;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', ['-C', repository, ...args], { maxBuffer: 32 * 1024 * 1024 });
const textGit = (...args) => git(...args).toString().trim();
const head = textGit('rev-parse', 'HEAD'), tree = textGit('rev-parse', 'HEAD^{tree}');
const sourceHashes = { current: {}, baseline: {}, bindingBaseline: {} }, modules = new Map();
const outputArgument = process.argv[3];
let output;
if (outputArgument) {
  assert.ok(path.isAbsolute(outputArgument), 'The evidence file must be absolute');
  output = path.join(realpathSync(path.dirname(outputArgument)), path.basename(outputArgument));
  assert.ok(output !== repository && !output.startsWith(repository + path.sep), 'Evidence must be outside the checkout');
  assert.equal(existsSync(output), false, 'Earlier evidence must not be overwritten');
}
const report = { schemaVersion: 1, status: 'FAILED', scope: 'in-memory-rollback-hazard',
  startedAt: new Date().toISOString(), head, tree, baseline, bindingBaseline,
  probeSha256: digest(readFileSync(fileURLToPath(import.meta.url))),
  runtime: process.version, typescript: ts.version,
  databaseAccess: false, providerAccess: false, deploymentRollbackPerformed: false,
  concurrencyProven: false, safeToRollback: false, cases: [], boundSourceSha256: sourceHashes };
let state, activeCase = 'source-preflight';
const clone = value => structuredClone(value);
const matches = (row, where) => Object.entries(where).every(([key, value]) => {
  if (key === 'OR') return value.some(part => matches(row, part));
  if (value && typeof value === 'object' && 'in' in value) return value.in.includes(row[key]);
  return row[key] === value;
});
const forbidden = () => { throw new Error('This in-memory probe refuses external access'); };
const tx = {
  $queryRaw: async () => [], // This fixture does not simulate locks or concurrency.
  purchase: {
    findUnique: async ({ where }) => matches(state.purchase, where) ? clone(state.purchase) : null,
    findUniqueOrThrow: async ({ where }) => { assert.ok(matches(state.purchase, where)); return clone(state.purchase); },
    updateMany: async ({ where, data }) => {
      if (!matches(state.purchase, where)) return { count: 0 };
      Object.assign(state.purchase, clone(data)); return { count: 1 };
    },
  },
  coupon: { updateMany: async ({ where, data }) => {
    if (where.id !== state.purchase.couponId || state.coupon.reservedCount < where.reservedCount.gte) return { count: 0 };
    state.coupon.reservedCount -= data.reservedCount.decrement;
    state.coupon.usedCount += data.usedCount?.increment ?? 0; return { count: 1 };
  } },
  featureFlag: { findUnique: async () => ({ enabled: false, config: { count: 0 } }) },
  creditWallet: {
    createMany: async () => ({ count: 0 }),
    findUnique: async () => ({ userId: state.purchase.userId, balance: state.balance }),
    findUniqueOrThrow: async () => ({ userId: state.purchase.userId, balance: state.balance }),
    update: async ({ data }) => { state.balance += data.balance.increment; return { userId: state.purchase.userId, balance: state.balance }; },
    updateMany: async ({ where, data }) => {
      if (state.balance < where.balance.gte) return { count: 0 };
      state.balance -= data.balance.decrement; return { count: 1 };
    },
  },
  gameCredit: {
    findUnique: async ({ where }) => clone(state.ledger.find(row => matches(row, where)) ?? null),
    create: async ({ data }) => { state.ledger.push(clone(data)); return clone(data); },
    createMany: async ({ data }) => {
      const fresh = data.filter(row => !state.ledger.some(prior => prior.idempotencyKey === row.idempotencyKey));
      state.ledger.push(...clone(fresh)); return { count: fresh.length };
    },
  },
  purchaseRefund: {
    findUnique: async ({ where }) => clone(state.refunds.find(row => matches(row, where)) ?? null),
    create: async ({ data }) => { state.refunds.push(clone(data)); return clone(data); },
  },
  paymentEvent: {
    findFirst: async ({ where }) => clone(state.events.find(row => matches(row, where)) ?? null),
    createMany: async ({ data }) => {
      const fresh = data.filter(row => !state.events.some(prior => prior.provider === row.provider && prior.externalId === row.externalId));
      state.events.push(...clone(fresh)); return { count: fresh.length };
    },
  },
  analyticsEvent: { create: async ({ data }) => { state.analytics.push(clone(data)); return clone(data); } },
};
const database = { ...tx, $transaction: async action => {
  const before = clone(state);
  try { return await action(tx); } catch (error) { state = before; throw error; }
} };

function load(relativePath, revision = head) {
  const file = relativePath.endsWith('.ts') ? relativePath : relativePath + '.ts';
  const key = revision + ':' + file;
  if (modules.has(key)) return modules.get(key).exports;
  const tracked = 'qalba-platform/' + file, committed = git('show', revision + ':' + tracked);
  const bytes = revision === head ? readFileSync(path.join(application, file)) : committed;
  assert.ok(bytes.equals(committed), 'Loaded application bytes must exactly match the selected commit');
  const inventory = revision === head ? 'current' : revision === baseline ? 'baseline' : revision === bindingBaseline ? 'bindingBaseline' : null;
  assert.ok(inventory, 'Only the reviewed head and exact rollback baselines are permitted');
  sourceHashes[inventory][tracked] = digest(bytes);
  const module = { exports: {} }; modules.set(key, module);
  const requireApplication = specifier => {
    if (specifier === '@/lib/db') return { db: () => database };
    if (specifier === '@/lib/retention/service') return { runRetention: forbidden };
    if (specifier.startsWith('@/')) return load('src/' + specifier.slice(2), revision);
    if (specifier.startsWith('./')) return load(path.posix.join(path.posix.dirname(file), specifier), revision);
    if (specifier === 'zod' || specifier === 'node:crypto') return dependency(specifier);
    throw new Error('Unexpected application dependency refused');
  };
  const compiled = ts.transpileModule(bytes.toString(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, require: requireApplication,
    process: { env: Object.freeze({ PUBLIC_WELCOME_CREDITS_ENABLED: 'false' }) },
    fetch: forbidden, Buffer, URL, URLSearchParams, AbortSignal, Date }, { filename: tracked });
  return module.exports;
}
const invoiceId = 'c079f9ce-4882-4a37-8e16-10f9b1cc62cc', paymentId = '3645d8ed-dcd9-4b5d-acd7-48f2b32b1e63';
const payment = { id: paymentId, invoice_id: invoiceId, status: 'paid', amount: 1500, currency: 'SAR', refunded: 0, captured: 1500 };
const paidInvoice = { id: invoiceId, status: 'paid', amount: 1500, currency: 'SAR', metadata: { purchase_id: 'synthetic-purchase' }, payments: [payment] };
const reversedInvoice = { ...paidInvoice, payments: [{ ...payment, status: 'refunded', refunded: 1500, refunded_at: '2026-10-06T00:00:00Z' }] };
function fixture() {
  state = { purchase: { id: 'synthetic-purchase', userId: 'synthetic-user', productId: 'synthetic-product', couponId: 'synthetic-coupon',
    status: 'PENDING', provider: 'moyasar', providerReference: invoiceId, amountHalalas: 1500, credits: 3,
    couponReserved: true, paidAt: null, invoiceCreationState: 'CREATED', invoiceCreationAttemptAt: new Date('2026-10-01') },
  balance: 0, coupon: { reservedCount: 1, usedCount: 0 }, ledger: [], refunds: [], events: [], analytics: [] };
}
function observe() {
  const grants = state.ledger.filter(row => row.idempotencyKey === 'purchase:synthetic-purchase');
  return { status: state.purchase.status, balance: state.balance, purchaseGrants: grants.length,
    grantedCredits: grants.reduce((total, row) => total + row.delta, 0), couponReserved: state.purchase.couponReserved,
    reservedCount: state.coupon.reservedCount, usedCount: state.coupon.usedCount,
    reviewMarkers: state.events.filter(row => row.processingResult === 'REVIEW_REQUIRED').length,
    terminalAnalytics: state.analytics.length };
}
function assertHeld() {
  const outcome = observe(); assert.equal(outcome.status, 'PENDING'); assert.equal(outcome.balance, 0);
  assert.equal(outcome.purchaseGrants, 0); assert.equal(outcome.grantedCredits, 0);
  assert.equal(outcome.couponReserved, true); assert.equal(outcome.reservedCount, 1); assert.equal(outcome.usedCount, 0);
  assert.ok(outcome.reviewMarkers >= 1); assert.equal(outcome.terminalAnalytics, 0); return outcome;
}
function financial() {
  return clone({ purchase: state.purchase, balance: state.balance, coupon: state.coupon,
    ledger: state.ledger, refunds: state.refunds, analytics: state.analytics });
}
try {
  assert.equal(textGit('rev-parse', baseline + '^{commit}'), baseline, 'Immutable baseline history is required');
  assert.equal(textGit('rev-parse', bindingBaseline + '^{commit}'), bindingBaseline, 'Immutable binding rollback history is required');
  const current = load('src/lib/billing/checkout'), legacy = load('src/lib/billing/checkout', baseline);
  const bindingLegacy = load('src/lib/billing/checkout', bindingBaseline);
  const sources = settlementSources;
  for (const source of sources) {
    activeCase = 'current_hold_survives_stale_paid_' + source; const started = Date.now(); fixture();
    await current.settleInvoice(state.purchase.id, reversedInvoice, source); assertHeld();
    const held = clone(state);
    for (const staleSource of sources) { await current.settleInvoice(state.purchase.id, paidInvoice, staleSource); assertHeld(); }
    const events = state.events.length;
    for (const staleSource of sources) { await current.settleInvoice(state.purchase.id, paidInvoice, staleSource); assertHeld(); }
    assert.equal(state.events.length, events, 'Repeated stale observations must remain bounded');
    let lookups = 0;
    const provider = { createInvoice: forbidden, fetchPayment: forbidden,
      fetchInvoice: async id => { assert.equal(id, invoiceId); lookups++; return clone(paidInvoice); } };
    for (const serviceSource of reconciliationSources) {
      await current.reconcilePurchase(state.purchase.id, provider, serviceSource); assertHeld();
    }
    assert.equal(lookups, 3);
    report.cases.push({ name: activeCase, status: 'passed', durationMs: Date.now() - started,
      directSourcesChecked: sources, reconciliationSourcesChecked: reconciliationSources,
      syntheticProviderLookups: lookups, outcome: assertHeld() });
    activeCase = 'immutable_baseline_ignores_committed_hold_' + source; state = clone(held);
    await legacy.settleInvoice(state.purchase.id, paidInvoice, source);
    const unsafe = observe();
    assert.deepEqual(unsafe, { status: 'PAID', balance: 3, purchaseGrants: 1, grantedCredits: 3,
      couponReserved: false, reservedCount: 0, usedCount: 1, reviewMarkers: 1, terminalAnalytics: 1 });
    report.cases.push({ name: activeCase, status: 'passed', outcome: unsafe, unsafeRollbackObserved: true });
  }
  const oldPaymentId = '2140190e-c0f6-438a-afdc-a7d57c74420e';
  const oldVoid = { ...payment, id: oldPaymentId, status: 'voided', captured: 0,
    voided_at: '2026-10-06T00:00:00Z' };
  const paidWithHistory = { ...paidInvoice, payments: [oldVoid, { ...payment, captured: 0 }] };
  const staleVoid = { ...paidInvoice, payments: [oldVoid] };
  for (const source of reconciliationSources) {
    activeCase = 'current_binding_blocks_stale_void_' + source; fixture();
    await current.settleInvoice(state.purchase.id, paidWithHistory, 'SETTLEMENT');
    assert.equal(state.purchase.status, 'PAID'); assert.equal(state.balance, 3);
    const originalGrant = clone(state.ledger.find(row => row.idempotencyKey === 'purchase:synthetic-purchase'));
    assert.ok(originalGrant && originalGrant.delta === 3);
    const settlement = state.events.find(row => row.eventType === 'INVOICE_OBSERVATION' && row.processingResult === 'SETTLED');
    assert.ok(settlement && settlement.paymentReference === paymentId, 'The new grant must bind its actual payment');
    const before = clone(state), beforeFinancial = financial();
    const provider = { createInvoice: forbidden,
      fetchInvoice: async id => { assert.equal(id, invoiceId); return clone(staleVoid); },
      fetchPayment: async id => { assert.equal(id, oldPaymentId); return clone(oldVoid); } };
    await assert.rejects(() => current.reconcilePurchase(state.purchase.id, provider, source), error => error.status === 409);
    assert.deepEqual(financial(), beforeFinancial, 'Rejected historical VOID must preserve all financial facts');
    assert.equal(state.refunds.length, 0);
    assert.equal(state.ledger.filter(row => row.idempotencyKey === 'purchase-refund:synthetic-purchase:full').length, 0);
    report.cases.push({ name: activeCase, status: 'passed', rejectedStatus: 409, selectedPaymentBindingPreserved: true,
      outcome: { ...observe(), refundCount: 0, compensationCount: 0 } });
    activeCase = 'b6_baseline_ignores_payment_binding_' + source; state = clone(before);
    await bindingLegacy.reconcilePurchase(state.purchase.id, provider, source);
    assert.deepEqual(state.purchase, before.purchase); assert.deepEqual(state.coupon, before.coupon);
    assert.deepEqual(state.ledger.find(row => row.idempotencyKey === 'purchase:synthetic-purchase'), originalGrant);
    assert.equal(state.balance, 0); assert.equal(state.refunds.length, 1);
    const refund = state.refunds[0], compensations = state.ledger.filter(row => row.idempotencyKey === 'purchase-refund:synthetic-purchase:full');
    assert.equal(refund.state, 'VOIDED'); assert.equal(refund.paymentReference, oldPaymentId);
    assert.equal(refund.recoveredCredits, 3); assert.equal(refund.unresolvedCredits, 0);
    assert.equal(compensations.length, 1); assert.equal(compensations[0].delta, -3);
    assert.equal(state.analytics.length, 1); assert.equal(settlement.paymentReference, paymentId);
    report.cases.push({ name: activeCase, status: 'passed', unsafeRollbackObserved: true,
      outcome: { ...observe(), refundCount: 1, compensationCount: 1, compensationDelta: -3,
        refundState: 'VOIDED', refundUsesSelectedPayment: false } });
  }
  activeCase = 'source-postflight';
  assert.equal(textGit('rev-parse', 'HEAD'), head); assert.equal(textGit('rev-parse', 'HEAD^{tree}'), tree);
  for (const [file, hash] of Object.entries(sourceHashes.current)) {
    assert.equal(digest(readFileSync(path.join(repository, file))), hash);
    assert.equal(digest(git('show', head + ':' + file)), hash);
  }
  assert.equal(report.cases.length, expectedCases); assert.ok(report.cases.every(item => item.status === 'passed'));
  report.status = 'PASS'; report.unsafeRollbackObserved = true;
  report.unsafeReviewRollbackObserved = true; report.unsafePaymentBindingRollbackObserved = true;
  report.passed = expectedCases;
} catch {
  report.failure = { case: activeCase, detail: 'Required in-memory behavior or source binding assertion failed.' };
  report.passed = report.cases.length; process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(report.status + ' in-memory rollback-hazard probe; ' + report.passed + ' of ' + expectedCases + ' cases completed; deployment rollback remains unsafe.');
}
