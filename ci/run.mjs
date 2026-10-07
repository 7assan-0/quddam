/** Serial first-failure orchestration; no inherited counts or automatic mandatory retries. */
import {spawn, spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {adapt, root} from './adapter.mjs';

const app = join(root, 'qalba-platform'), phase = process.argv[2];
const manifest = JSON.parse(readFileSync(join(root, 'Quddam-Phase-5.0J-2-Test-Manifest.json')));
const source = JSON.parse(readFileSync(join(root, 'Source-Manifest.json')));
const readiness = JSON.parse(readFileSync(join(root, 'receipts/Runtime-Readiness.json')));
if (readiness.status !== 'PASS' || !readiness.readyForMandatoryTests) throw Error('Mandatory execution prohibited before runtime readiness');
if (!process.env.PG_BIN || !process.env.CHROMIUM_PATH) throw Error('Readiness-proven executable paths required');
if (process.env.J1_CONTINUE || process.env.I1_BROWSER_FILTER) throw Error('Resume / inherited partial filters forbidden');
if (process.env.GITHUB_RUN_ATTEMPT !== '1') throw Error('A rerun cannot replace first-failure evidence; start only a newly authorized fresh workflow');
const receipt = {phase, status: 'RUNNING', sourceFingerprint: source.sourceFingerprint, previousOutcomesInherited: false, automaticRetries: 0, tasks: [], startedAt: new Date().toISOString()};
const out = join(root, 'receipts'); mkdirSync(join(out, 'private'), {recursive: true});
const save = () => writeFileSync(join(out, 'Phase-' + phase + '.json'), JSON.stringify(receipt, null, 2));
const environment = {...process.env, PG_IDENTITY_PRELOAD: '', PG_LIBRARY_PATH: '', CHECKPOINT_DISABLE: '1', NEXT_TELEMETRY_DISABLED: '1', DISABLE_PRISMA_TELEMETRY: 'true'};
delete environment.LD_PRELOAD; delete environment.LD_LIBRARY_PATH;
delete environment.MOYASAR_SECRET_KEY; delete environment.SMTP_USER; delete environment.SMTP_PASSWORD;
delete environment.SMTP_PASS; delete environment.SMTP_URL;
delete environment.RG03_CASE_IDENTITIES; delete environment.RG03_RUN_LABEL;
function guard() {
  const check = spawnSync('python3', [join(root, 'ci/baseline.py'), 'verify'], {cwd: root, encoding: 'utf8'});
  if (check.status !== 0) throw Error('Frozen source/harness guard: ' + check.stderr);
}
async function run(label, command, args, extra = {}, cwd = root) {
  guard();
  const row = {label, status: 'RUNNING', startedAt: new Date().toISOString()}; receipt.tasks.push(row); save();
  console.log('RG03 ' + phase + ': ' + label);
  const log = join(out, 'private', phase + '-' + label + '.log');
  writeFileSync(log, '', {mode: 0o600});
  const code = await new Promise((resolve, reject) => {
    const p = spawn(command, args, {cwd, env: {...environment, ...extra}, stdio: ['ignore', 'pipe', 'pipe']});
    let chunks = [];
    for (const stream of [p.stdout, p.stderr]) stream.on('data', bytes => chunks.push(bytes));
    p.on('error', reject); p.once('exit', (code, signal) => {writeFileSync(log, Buffer.concat(chunks), {mode: 0o600}); row.signal = signal; resolve(code);});
  });
  row.exitCode = code; row.status = code === 0 ? 'PASS' : 'FAILED'; row.finishedAt = new Date().toISOString(); row.privateLog = log.slice(root.length + 1); save();
  if (code !== 0) throw Error('STOP at first failed task: ' + label + ' (exit ' + code + ')');
  guard(); console.log('PASS ' + label);
}
async function types() {
  // Generated route typings only. Restore the frozen next-env bytes immediately.
  const file = join(app, 'next-env.d.ts'), original = readFileSync(file);
  try {
    const value = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'typegen'], {cwd: app, env: environment, encoding: 'utf8'});
    writeFileSync(join(out, 'private', phase + '-typegen.log'), value.stdout + value.stderr, {mode: 0o600});
    if (value.status !== 0) throw Error('Generated route type readiness failed');
    const generated = join(app, '.next/types'), dev = join(app, '.next/dev/types');
    if (existsSync(generated)) {
      mkdirSync(dev, {recursive: true});
      // validator.ts must stay in .next/types because its source imports are relative.
      for (const name of ['routes.d.ts', 'root-params.d.ts']) cpSync(join(generated, name), join(dev, name));
    }
    for (const name of ['routes.d.ts', 'root-params.d.ts']) if (!existsSync(join(dev, name))) throw Error('Next generated route types missing: ' + name);
  } finally {writeFileSync(file, original);}
  guard();
}
const tools = adapt();
const resetTitle = 'M05 real reset mail flow is bounded, recovers and preserves one-use session invalidation';
const reset = manifest.browserApi.cases.find(x => x.file === 'tests/e2e/public-ingress.spec.ts' && x.title === resetTitle);
if (!reset) throw Error('Canonical M05 identity missing');
const related = manifest.browserApi.cases.filter(x => (x.file === 'tests/e2e/public-ingress.spec.ts' && x.title.startsWith('M05 ') && x.identity !== reset.identity) || x.file === 'tests/e2e/host-auth-revocation.spec.ts');
if (related.length !== 10) throw Error('Related auth/reset identity inventory must contain exactly 10 unchanged canonical tests');
save();
try {
  if (phase === 'prepare') {
    await types(); await run('production-build-preparation', process.execPath, [tools.quality, '--prepare-target']);
  } else if (phase === 'm05' || phase === 'related') {
    if (!existsSync(join(app, '.next/BUILD_ID'))) throw Error('Production build required');
    const wanted = phase === 'm05' ? [reset] : related;
    const path = join(root, 'verification', phase);
    if (existsSync(path)) throw Error('Refuse to reuse any prior targeted execution');
    if (phase === 'related' && JSON.parse(readFileSync(join(out, 'Phase-m05.json'))).status !== 'PASS') throw Error('M05 must pass before related verification');
    receipt.requiredIdentities = wanted.map(x => x.identity); save();
    await run('unchanged-canonical-' + phase, process.execPath, [tools.consolidated, 'canonical'], {RG03_RUN_LABEL: phase, RG03_CASE_IDENTITIES: JSON.stringify(receipt.requiredIdentities)});
    const results = JSON.parse(readFileSync(join(path, 'Execution-Results.json')));
    if (results.failed || results.retries || results.runs.length !== wanted.length || results.runs.some(x => x.status !== 'passed') || wanted.some(x => !results.runs.some(y => y.identity === x.identity))) throw Error('Targeted complete assertion execution not proven');
    receipt.passed = wanted.length; receipt.failed = 0; receipt.skipped = 0;
  } else if (phase === 'full') {
    // Freeze verification checks current run ID/SHA and every executable-source byte.
    await run('verify-new-rg03-freeze', 'python3', [join(root, 'ci/package.py'), 'verify-freeze']);
    for (const label of ['native', 'canonical', 'lifecycle', 'content-browser', 'launch-low-browser', 'security-headers', 'quality-gates']) {
      if (existsSync(join(root, 'verification', label))) throw Error('Refuse to inherit earlier final execution: ' + label);
    }
    receipt.identityStart = {native: manifest.nativePostgres.cases[0].identity, canonical: 'tests/e2e/foundation.spec.ts::Arabic landing and account entry points render on desktop and mobile'}; save();
    await types();
    await run('fresh-complete-quality-content-operations', process.execPath, [tools.quality]);
    await run('native-postgresql-from-001', process.execPath, [tools.consolidated, 'native']);
    await run('canonical-browser-api-from-001', process.execPath, [tools.consolidated, 'canonical']);
    await run('m13-native-lifecycle-and-browser', process.execPath, [tools.lifecycle], {LIFECYCLE_WORKSPACE: root, F1_OUTPUT: 'verification/lifecycle', F1_SKIP_EXISTING_NATIVE: '1'});
    await run('supplemental-content-browser', process.execPath, [tools.content, '--final'], {CONTENT_WORKSPACE: root, G1_OUTPUT: 'verification/content-browser', PLAYWRIGHT_EXECUTABLE_PATH: environment.CHROMIUM_PATH});
    await run('supplemental-launch-low-browser', process.execPath, [tools.launch, 'final'], {H1_WORKSPACE: root, H1_OUTPUT: 'verification/launch-low-browser', J1_SKIP_EXISTING_NATIVE: '1'});
    await run('supplemental-security-csp-report-only', process.execPath, [tools.security, 'final'], {I1_OUTPUT: join(root, 'verification/security-headers'), I1_SOURCE_MANIFEST: join(root, 'Source-Manifest.json')}, app);
    await run('independent-complete-result-audit', 'python3', [join(root, 'ci/results.py'), '--require-complete']);
  } else throw Error('Unknown phase');
  receipt.status = 'PASS'; receipt.completedAt = new Date().toISOString(); save();
} catch (error) {
  receipt.status = 'FAILED'; receipt.originalOrchestrationError = String(error.stack ?? error); receipt.stoppedAt = receipt.tasks.at(-1)?.label ?? phase;
  receipt.classification = 'D — UNRESOLVED; original child errors preserved for evidence-based diagnosis'; receipt.firstFailurePreserved = true;
  save(); throw error;
}
