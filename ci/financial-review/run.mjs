#!/usr/bin/env node
/** Scoped synthetic review checks. Raw fixtures/logs stay private; only manifest.json is public. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
const application = path.join(repository, 'qalba-platform');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const within = (parent, child) => child === parent || child.startsWith(parent + path.sep);
const safeName = value => String(value).replace(/https?:\/\/\S+/g, '[url]')
  .replace(/[\w.+-]+@[\w.-]+\.[\w-]+/g, '[email]')
  .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[fixture]');
const inherited = ['PATH', 'HOME', 'TMPDIR', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY',
  'http_proxy', 'https_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR',
  'NPM_CONFIG_REGISTRY', 'npm_config_registry', 'NPM_CONFIG_CACHE', 'npm_config_cache'];
const environment = Object.fromEntries(inherited.filter(name => process.env[name] !== undefined).map(name => [name, process.env[name]]));
Object.assign(environment, { CI: 'true', TZ: 'UTC', NODE_ENV: 'test', CHECKPOINT_DISABLE: '1',
  NEXT_TELEMETRY_DISABLED: '1', DISABLE_PRISMA_TELEMETRY: 'true',
  BILLING_TEST_DATABASE: '1', DATABASE_POOL_MAX: '10', PUBLIC_WELCOME_CREDITS_ENABLED: 'false',
  APP_URL: 'https://quddam.test', MOYASAR_SECRET_KEY: 'synthetic-financial-review-never-live',
  MOYASAR_CALLBACK_TOKEN: 'synthetic-financial-review-callback-token-only',
  BILLING_CRON_SECRET: 'synthetic-financial-review-cron-token-only' });
const manifest = { schemaVersion: 1, scope: 'synthetic-financial-review', status: 'RUNNING',
  releaseVerified: false, startedAt: new Date().toISOString(), steps: [], checks: {} };
let publicDirectory, privateDirectory, activeStep = 'output-preflight';

async function command(executable, args, options = {}) {
  const chunks = [];
  const childEnvironment = { ...environment, ...options.env };
  for (const name of Object.keys(childEnvironment)) if (childEnvironment[name] === undefined) delete childEnvironment[name];
  const result = await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: options.cwd ?? application,
      env: childEnvironment, stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
    child.stdout.on('data', data => chunks.push(data)); child.stderr.on('data', data => chunks.push(data));
    if (options.input !== undefined) child.stdin.end(options.input);
    child.on('error', reject); child.on('close', (exitCode, signal) => resolve({ exitCode, signal }));
  });
  const output = Buffer.concat(chunks);
  if (options.rawFile) await writeFile(options.rawFile, output, { flag: 'wx', mode: 0o600 });
  return { ...result, output };
}
async function git(args) {
  const result = await command('git', ['-C', repository, ...args]);
  assert.equal(result.exitCode, 0, 'Git source inspection failed'); return result.output.toString().trim();
}
async function inventory() {
  const files = (await git(['ls-files', '-z'])).split('\0').filter(Boolean).sort();
  return Object.fromEntries(await Promise.all(files.map(async file => [file, sha256(await readFile(path.join(repository, file)))])));
}
async function committedInventory() {
  const entries = (await git(['ls-tree', '-r', '-z', 'HEAD'])).split('\0').filter(Boolean).map(entry => {
    const [metadata, file] = entry.split('\t'); const [, type, object] = metadata.split(' ');
    assert.equal(type, 'blob', 'Tracked submodules are unsupported by this byte inventory'); return { file, object };
  }).sort((left, right) => left.file.localeCompare(right.file, 'en'));
  const result = await command('git', ['-C', repository, 'cat-file', '--batch'], { input: entries.map(entry => entry.object).join('\n') + '\n' });
  assert.equal(result.exitCode, 0); let offset = 0;
  const hashes = {};
  for (const entry of entries) {
    const end = result.output.indexOf(10, offset); assert.ok(end >= offset);
    const [object, type, length] = result.output.subarray(offset, end).toString().split(' ');
    assert.equal(object, entry.object); assert.equal(type, 'blob'); const size = Number(length);
    assert.ok(Number.isInteger(size) && size >= 0); offset = end + 1;
    hashes[entry.file] = sha256(result.output.subarray(offset, offset + size)); offset += size;
    assert.equal(result.output[offset++], 10);
  }
  assert.equal(offset, result.output.length);
  return Object.fromEntries(Object.entries(hashes).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
}
async function save() {
  await writeFile(path.join(publicDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
}
async function step(name, executable, args, env = {}) {
  activeStep = name; console.log(`Starting ${name}`);
  const started = Date.now(); const rawFile = path.join(privateDirectory, `${name}.log`);
  const result = await command(executable, args, { env, rawFile });
  manifest.steps.push({ name, exitCode: result.exitCode, signal: result.signal,
    durationMs: Date.now() - started, outputSha256: sha256(result.output) });
  await save(); assert.equal(result.exitCode, 0, `${name} failed`);
}
async function jsonEvidence(name, file) {
  const bytes = await readFile(file); const data = JSON.parse(bytes.toString());
  manifest.checks[name] = { rawSha256: sha256(bytes) }; return data;
}
function passedResults(record, count) {
  assert.ok(Array.isArray(record.results)); assert.equal(record.results.length, count);
  assert.equal(record.passed, count); assert.ok(record.results.every(item => item.status === 'passed'));
  assert.equal(new Set(record.results.map(item => item.name)).size, count);
  assert.ok(record.results.every(item => Number.isFinite(item.durationMs) && item.durationMs >= 0));
}
function distinctBackends(evidence) {
  assert.ok(Number.isInteger(evidence.gatePid) && evidence.gatePid > 0);
  assert.ok(Array.isArray(evidence.blockedBackendPids)); assert.equal(evidence.blockedBackendPids.length, 2);
  assert.ok(evidence.blockedBackendPids.every(pid => Number.isInteger(pid) && pid > 0 && pid !== evidence.gatePid));
  assert.equal(new Set(evidence.blockedBackendPids).size, 2);
}

try {
  const requested = process.env.FINANCIAL_REVIEW_OUTPUT;
  assert.ok(requested && path.isAbsolute(requested), 'FINANCIAL_REVIEW_OUTPUT must be a new absolute directory outside the checkout');
  const candidate = path.join(await realpath(path.dirname(requested)), path.basename(requested));
  assert.ok(!within(repository, candidate), 'Public evidence must be outside the checkout');
  await mkdir(candidate, { mode: 0o700 });
  publicDirectory = candidate;
  privateDirectory = await mkdtemp('/tmp/quddam-financial-review-private-');
  await save(); activeStep = 'source-preflight';
  assert.equal(process.env.BILLING_TEST_DATABASE, '1', 'Explicit synthetic database authorization is required');
  assert.equal(await git(['status', '--porcelain=v1', '--untracked-files=all']), '', 'A clean committed checkout is required');
  const source = await inventory();
  assert.deepEqual(source, await committedInventory(), 'Working tree bytes must match every HEAD blob, including files hidden from git status');
  manifest.source = { commit: await git(['rev-parse', 'HEAD']), tree: await git(['rev-parse', 'HEAD^{tree}']),
    trackedSha256: source, beforeInventorySha256: sha256(JSON.stringify(source)) };
  const bootstrap = new URL(process.env.DATABASE_URL ?? '');
  assert.ok(['postgres:', 'postgresql:'].includes(bootstrap.protocol));
  assert.equal(bootstrap.hostname, '127.0.0.1'); assert.equal(bootstrap.port, '55465');
  assert.equal(decodeURIComponent(bootstrap.username), 'quddam_financial_test');
  assert.equal(bootstrap.pathname, '/postgres'); assert.equal(bootstrap.search, ''); assert.equal(bootstrap.hash, '');
  assert.ok(bootstrap.password, 'The disposable PostgreSQL service needs a credential');
  environment.DATABASE_URL = bootstrap.href;
  const npmVersion = await command('npm', ['--version']); assert.equal(npmVersion.exitCode, 0);
  assert.match(npmVersion.output.toString().trim(), /^\d+\.\d+\.\d+$/);
  const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
  assert.ok(nodeMajor >= 24 || nodeMajor === 22 && nodeMinor >= 12 || nodeMajor === 20 && nodeMinor >= 19, 'Unsupported Node version');
  manifest.tools = { node: process.version, npm: npmVersion.output.toString().trim() };
  await save();
  await step('npm-ci', 'npm', ['ci', '--include=dev', '--no-audit', '--no-fund']);
  await step('prisma-generate', 'npm', ['run', 'db:generate']);
  const rollbackFile = path.join(privateDirectory, 'rollback.json');
  await step('rollback-probe', process.execPath, [path.join(repository, 'ci/financial-review/rollback-probe.mjs'), repository, rollbackFile]);
  activeStep = 'validate-rollback';
  const rollback = await jsonEvidence('rollback', rollbackFile);
  assert.equal(rollback.status, 'PASS'); assert.equal(rollback.head, manifest.source.commit);
  assert.equal(rollback.tree, manifest.source.tree);
  assert.equal(rollback.baseline, '2d4e868ba43700414c19ece1394bf6815e7639cf');
  assert.equal(rollback.probeSha256, source['ci/financial-review/rollback-probe.mjs']);
  assert.equal(rollback.passed, 14); assert.ok(Array.isArray(rollback.cases)); assert.equal(rollback.cases.length, 14);
  assert.ok(rollback.cases.every(item => item.status === 'passed'));
  const rollbackSources = ['SETTLEMENT', 'CALLBACK', 'POLL', 'CRON'];
  const rollbackNames = rollbackSources.flatMap(name => [`current_hold_survives_stale_paid_${name}`, `immutable_baseline_ignores_committed_hold_${name}`]);
  rollbackNames.push(...['CALLBACK', 'POLL', 'CRON'].flatMap(name => [`current_binding_blocks_stale_void_${name}`, `b6_baseline_ignores_payment_binding_${name}`]));
  assert.deepEqual(rollback.cases.map(item => item.name), rollbackNames);
  for (let index = 0; index < rollbackSources.length; index++) {
    const current = rollback.cases[index * 2], legacy = rollback.cases[index * 2 + 1];
    assert.deepEqual(current.directSourcesChecked, rollbackSources);
    assert.deepEqual(current.reconciliationSourcesChecked, ['CALLBACK', 'POLL', 'CRON']);
    assert.equal(current.syntheticProviderLookups, 3); assert.equal(current.outcome.status, 'PENDING');
    assert.equal(current.outcome.balance, 0); assert.equal(current.outcome.purchaseGrants, 0);
    assert.ok(current.outcome.reviewMarkers >= 1); assert.equal(current.outcome.terminalAnalytics, 0);
    assert.equal(legacy.unsafeRollbackObserved, true); assert.equal(legacy.outcome.status, 'PAID');
    assert.equal(legacy.outcome.balance, 3); assert.equal(legacy.outcome.purchaseGrants, 1);
    assert.equal(legacy.outcome.grantedCredits, 3); assert.equal(legacy.outcome.reviewMarkers, 1);
  }
  assert.equal(rollback.unsafeRollbackObserved, true); assert.equal(rollback.safeToRollback, false);
  assert.equal(rollback.bindingBaseline, 'b6c61cca11a87c69eec4372acb34a0fcb34f6cec');
  assert.equal(rollback.unsafeReviewRollbackObserved, true); assert.equal(rollback.unsafePaymentBindingRollbackObserved, true);
  for (let index = 8; index < 14; index += 2) {
    const current = rollback.cases[index], legacy = rollback.cases[index + 1];
    assert.equal(current.rejectedStatus, 409); assert.equal(current.selectedPaymentBindingPreserved, true);
    assert.equal(current.outcome.balance, 3); assert.equal(current.outcome.refundCount, 0); assert.equal(current.outcome.compensationCount, 0);
    assert.equal(legacy.unsafeRollbackObserved, true); assert.equal(legacy.outcome.balance, 0);
    assert.equal(legacy.outcome.refundUsesSelectedPayment, false); assert.equal(legacy.outcome.compensationDelta, -3);
  }
  for (const flag of ['databaseAccess', 'providerAccess', 'deploymentRollbackPerformed', 'concurrencyProven']) assert.equal(rollback[flag], false);
  assert.ok(Object.keys(rollback.boundSourceSha256.current).length > 0 && Object.keys(rollback.boundSourceSha256.baseline).length > 0);
  for (const [file, hash] of Object.entries(rollback.boundSourceSha256.current)) assert.equal(hash, source[file]);
  for (const [file, hash] of Object.entries(rollback.boundSourceSha256.baseline)) {
    const baselineBytes = await command('git', ['-C', repository, 'show', `${rollback.baseline}:${file}`]);
    assert.equal(baselineBytes.exitCode, 0); assert.equal(sha256(baselineBytes.output), hash);
  }
  assert.ok(Object.keys(rollback.boundSourceSha256.bindingBaseline).length > 0);
  for (const [file, hash] of Object.entries(rollback.boundSourceSha256.bindingBaseline)) {
    const baselineBytes = await command('git', ['-C', repository, 'show', `${rollback.bindingBaseline}:${file}`]);
    assert.equal(baselineBytes.exitCode, 0); assert.equal(sha256(baselineBytes.output), hash);
  }
  Object.assign(manifest.checks.rollback, { passed: 14, failed: 0, unsafeRollbackObserved: true,
    safeToRollback: false, databaseAccess: false, providerAccess: false, concurrencyProven: false,
    baseline: rollback.baseline, bindingBaseline: rollback.bindingBaseline, boundSourceSha256: rollback.boundSourceSha256,
    cases: rollback.cases.map(({ name, status }) => ({ name, status })) });
  await save();
  activeStep = 'native-postgres-preflight';
  const { default: pg } = await import(pathToFileURL(path.join(application, 'node_modules/pg/lib/index.js')));
  const pool = new pg.Pool({ connectionString: bootstrap.href, max: 1 });
  try {
    const { rows: [server] } = await pool.query('SELECT version() AS version, current_user AS role, current_database() AS database, current_setting(\'server_version_num\') AS number');
    assert.match(server.version, /^PostgreSQL 16\./); assert.doesNotMatch(server.version, /PGlite/i);
    assert.equal(Math.floor(Number(server.number) / 10000), 16);
    assert.equal(server.role, 'quddam_financial_test'); assert.equal(server.database, 'postgres');
    manifest.tools.postgres = safeName(server.version);
    const existing = await pool.query('SELECT datname FROM pg_database WHERE datname = ANY($1::text[])', [['financial_p05', 'financial_b01']]);
    assert.equal(existing.rowCount, 0, 'Both financial databases must be absent; this runner never resets or reuses a database');
    await pool.query('CREATE DATABASE financial_p05'); await pool.query('CREATE DATABASE financial_b01');
    manifest.checks.databasePreparation = { newDatabases: 2, forwardMigrationsOnly: true, resetPerformed: false };
  } finally { await pool.end(); }
  const urlFor = database => { const url = new URL(bootstrap); url.pathname = `/${database}`; return url.href; };
  const p05 = { DATABASE_URL: urlFor('financial_p05') }, b01 = { DATABASE_URL: urlFor('financial_b01') };
  await step('migrate-p05', 'npm', ['run', 'db:migrate'], p05);
  await step('migrate-b01', 'npm', ['run', 'db:migrate'], b01);
  await step('seed-p05-content', 'npm', ['run', 'db:seed:content'], { ...p05, NODE_ENV: 'production' });
  const p05File = path.join(privateDirectory, 'p05.json'), b01File = path.join(privateDirectory, 'b01.json');
  await step('native-p05', process.execPath, ['--import', 'tsx', 'scripts/billing-reversal-postgres.ts'], { ...p05, BILLING_REVERSAL_EVIDENCE_FILE: p05File });
  activeStep = 'validate-p05';
  const reversal = await jsonEvidence('reversal', p05File); passedResults(reversal, 56);
  assert.equal(reversal.status, 'PASS'); assert.match(reversal.server, /^PostgreSQL 16\./);
  assert.equal(reversal.productionAccess, false); assert.equal(reversal.liveProviderAccess, false);
  assert.equal(reversal.destructiveSql, false); assert.equal(reversal.fixturesRetained, true);
  assert.ok(Number.isInteger(reversal.syntheticHttpRequests) && reversal.syntheticHttpRequests > 0);
  const races = reversal.results.filter(item => item.evidence?.blockedBackendPids);
  assert.equal(races.length, 11); races.forEach(item => distinctBackends(item.evidence));
  const originalRaceNames = [1, 2, 3].flatMap(n => [`native reversal-first then stale paid contender ${n}`, `native paid-first then stale-PENDING reversal observer ${n}`]);
  originalRaceNames.push('actual Board START/refund native wallet contention START first', 'actual Board START/refund native wallet contention REFUND first');
  const newRaceNames = ['native historical-attempt REVERSAL wins settlement/reversal ordering', 'native historical-attempt PAID wins settlement/reversal ordering',
    'concurrent full refund observers with historical attempts compensate exactly once'];
  const raceNames = [...newRaceNames, ...originalRaceNames];
  assert.deepEqual(races.map(item => item.name), raceNames);
  const directNames = ['paid/full-refunded payment', 'paid/partial refund numeric evidence', 'paid/voided payment',
    'paid/reversed payment', 'paid/ambiguous multiple payments with reversal', 'refunded invoice', 'reversed invoice',
    'initiated invoice with refunded payment', 'voided invoice with fully refunded payment',
    'voided invoice with partial refund', 'voided invoice with reversed payment',
    'voided invoice with duplicate zero-charge void identity', 'voided invoice with captured void payment',
    'paid/missing payment list', 'paid/empty payment list', 'paid/partial captured amount', 'paid/foreign history invoice',
    'paid/foreign history currency', 'paid/foreign history amount', 'paid/zero-counter capture timestamp',
    'paid/active historical authorization', 'paid/unsupported history state', 'terminal/missing payment list'];
  const reversalNames = [...directNames.map(name => `direct ${name}: sticky hold and stale replays`),
    'real callback paid hint fetches reversed provider invoice and cannot grant',
    'POLL enters sticky hold from fresh reversal then stale paid observation',
    'CRON reconciliation marks a pending reversal and later blocks stale payment',
    'prepayment invoice void complete-empty-list remains VOIDED without a review hold',
    'prepayment invoice void one-zero-charge-void remains VOIDED without a review hold',
    'normal paid settlement across direct/callback/POLL/CRON grants exactly once',
    ...[1, 3].map(count => `verified paid with ${count} ended historical attempts grants exactly once across all entry points`),
    ...['failed', 'canceled', 'expired', 'voided'].map(status => `complete ${status} multiple zero-charge void history settles without credits`),
    ...['missing counter', 'invalid timestamp'].map(kind => `authenticated callback ${kind} payment evidence creates a durable hold`),
    'ordinary initiated historical void observation permits a later distinct paid payment',
    ...['REFUND_REVIEW', 'INVOICE_OBSERVATION'].map(type => `existing ${type} review holds override eligible paid and complete terminal history`),
    'partial refund of the recorded paid payment beside historical attempts remains review only',
    ...newRaceNames,
    'fully consumed refund records zero compensation without clawing back later credits',
    'recorded automatic paid payment later voids beside older zero-counter void attempts',
    'stale older void cannot compensate a grant bound to a different payment',
    'existing refund uniqueness constraint rolls back wallet and compensation atomically', ...originalRaceNames];
  assert.deepEqual(reversal.results.map(item => item.name), reversalNames);
  assert.ok(reversal.results.every(item => item.evidence && typeof item.evidence === 'object'));
  for (const item of races.filter(item => item.name.includes('stale-PENDING'))) assert.equal(item.evidence.purchaseStatusAtProviderFetch, 'PENDING');
  Object.assign(manifest.checks.reversal, { passed: 56, failed: 0, nativeRaceCases: 11,
    distinctBackendPairs: true, syntheticHttpRequests: reversal.syntheticHttpRequests,
    cases: reversal.results.map(({ name, durationMs }) => ({ name: safeName(name), durationMs })) });
  await save();
  await step('native-b01', process.execPath, ['--import', 'tsx', 'scripts/billing-settlement-postgres.ts'], { ...b01, BILLING_EVIDENCE_FILE: b01File });
  activeStep = 'validate-b01';
  const settlement = await jsonEvidence('settlement', b01File); passedResults(settlement, 13);
  assert.match(settlement.server, /^PostgreSQL 16\./);
  const settlementNames = ['A/B concurrent paid', 'A/B concurrent failed', 'C paid wins conflicting race',
    'C failed wins conflicting race', 'D callback plus reconciliation',
    ...['paid', 'failed', 'canceled', 'expired', 'voided'].map(status => `E ${status} terminal retries and conflict`),
    'F maxUses admission after failed settlement race', 'G constraints, unlimited coupons and fail-closed rollback',
    'H local expiry concurrency uses same terminal primitive'];
  assert.deepEqual(settlement.results.map(item => item.name), settlementNames);
  const settlementRaces = settlement.results.filter(item => item.backendPids);
  assert.equal(settlementRaces.length, 7);
  assert.deepEqual(settlementRaces.map(item => item.name), [...settlementNames.slice(0, 5), settlementNames[10], settlementNames[12]]);
  for (const item of settlementRaces) {
    assert.equal(item.backendPids.length, 2); assert.equal(new Set(item.backendPids).size, 2);
    assert.ok(item.backendPids.every(pid => Number.isInteger(pid) && pid > 0));
  }
  Object.assign(manifest.checks.settlement, { passed: 13, failed: 0, nativeRaceCases: 7, distinctBackendPairs: true,
    cases: settlement.results.map(({ name, durationMs }) => ({ name: safeName(name), durationMs })) });
  await save();
  const unitFile = path.join(privateDirectory, 'unit.json');
  await step('unit', 'npm', ['run', 'test', '--', '--maxWorkers=1', '--retry=0', '--reporter=json', `--outputFile=${unitFile}`], { ...p05, APP_URL: undefined });
  activeStep = 'validate-unit';
  const unit = await jsonEvidence('unit', unitFile);
  assert.equal(unit.success, true); assert.equal(unit.numFailedTests, 0); assert.equal(unit.numPendingTests, 0);
  assert.equal(unit.numFailedTestSuites, 0); assert.equal(unit.numPendingTestSuites ?? 0, 0);
  assert.ok(Array.isArray(unit.testResults) && unit.testResults.length > 0);
  const expectedFiles = Object.keys(source).filter(file => file.startsWith('qalba-platform/') && /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) && !file.startsWith('qalba-platform/tests/e2e/')).sort();
  const actualFiles = unit.testResults.map(file => path.relative(repository, file.name)).sort();
  assert.deepEqual(actualFiles, expectedFiles, 'All tracked unit test files must execute');
  const assertions = unit.testResults.flatMap(file => file.assertionResults);
  assert.ok(assertions.length > 0 && assertions.every(item => item.status === 'passed'));
  assert.equal(unit.numTotalTests, assertions.length); assert.equal(unit.numPassedTests, assertions.length);
  assert.ok(unit.testResults.every(file => file.status === 'passed'));
  const regression = unit.testResults.find(file => file.name.endsWith('/src/lib/billing/settlement-refund.test.ts'));
  assert.ok(regression && regression.assertionResults.length === 86);
  Object.assign(manifest.checks.unit, { passed: assertions.length, failed: 0, pending: 0,
    files: actualFiles.length, allTrackedTestFilesExecuted: true, retries: 0,
    regressionCases: regression.assertionResults.map(item => ({ name: safeName(item.fullName), status: item.status })) });
  activeStep = 'source-postflight';
  assert.equal(await git(['rev-parse', 'HEAD']), manifest.source.commit);
  const after = await inventory(); assert.deepEqual(after, source, 'Tracked bytes changed during the review');
  assert.equal(await git(['status', '--porcelain=v1', '--untracked-files=all']), '', 'Checkout changed during the review');
  manifest.source.afterInventorySha256 = sha256(JSON.stringify(after));
  manifest.status = 'PASS'; console.log('PASS scoped synthetic financial review');
} catch (error) {
  manifest.status = 'FAILED'; manifest.failure = { step: activeStep, detail: 'Required command or evidence assertion failed; raw diagnostics are retained privately.' };
  console.error(`FAILED ${activeStep}; raw diagnostics remain private.`); process.exitCode = 1;
  if (privateDirectory) {
    try { await writeFile(path.join(privateDirectory, 'failure.txt'), String(error?.stack ?? error), { flag: 'wx', mode: 0o600 }); }
    catch { manifest.failure.privateDiagnosticsSaved = false; }
  }
} finally {
  manifest.finishedAt = new Date().toISOString();
  manifest.durationMs = Date.parse(manifest.finishedAt) - Date.parse(manifest.startedAt);
  if (publicDirectory) await save();
}
