/** CI-only copies of frozen orchestration. Assertions and MIME implementation untouched. */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

export const root = resolve(import.meta.dirname, '..');
const app = join(root, 'qalba-platform');
const authorized = JSON.parse(readFileSync(join(root, 'Authorized-Harness-Fingerprints.json')));
const source = JSON.parse(readFileSync(join(root, 'Source-Manifest.json')));
export const sha = value => createHash('sha256').update(value).digest('hex');

export function adapt() {
  const audits = [];
  function copy(file, edits, output) {
    let text = readFileSync(join(root, file), 'utf8');
    const before = text;
    const expected = file.startsWith('verification-tools/') ? authorized.harnessFiles[file] : source.files[file.slice('qalba-platform/'.length)];
    if (sha(text) !== expected) throw Error('Adapter input not frozen: ' + file);
    for (const [old, replacement] of edits) {
      if (text.split(old).length !== 2) throw Error('Adapter requires exactly one known match: ' + file + ' / ' + old);
      text = text.replace(old, replacement);
    }
    const target = join(root, 'verification-tools', output);
    writeFileSync(target, text);
    // Keep the complete authorized SMTP/MIME function byte-identical, including dot unstuffing.
    if (file.endsWith('consolidated-runner.mjs')) {
      const mail = value => value.slice(value.indexOf('function mailHarness()'), value.indexOf('\ntry{guard();'));
      if (mail(before) !== mail(text)) throw Error('CI adapter changed the authorized MIME correction');
    }
    const diff = spawnSync('diff', ['-u', '--label', file, '--label', 'ci-adapted/' + output, join(root, file), target], {encoding: 'utf8'});
    if (![0, 1].includes(diff.status)) throw Error('Unable to record exact CI adapter diff');
    audits.push({input: file, inputSha256: sha(before), output: 'verification-tools/' + output, outputSha256: sha(text), edits, diff: diff.stdout});
    return target;
  }
  const pgReplacement = 'const bin=process.env.PG_BIN;if(!bin)throw Error("PG_BIN required: native PostgreSQL 16");const pgEnv={...process.env};delete pgEnv.LD_PRELOAD;delete pgEnv.LD_LIBRARY_PATH;';
  // This unchanged identity asserts legacy-label branding, so supply that test fixture.
  const rankedUiFixture = `
if (c.identity === 'tests/e2e/quddam-ui.spec.ts::Quddam ranked Host and TV presentation fits mobile and 1080p') {
  const address = new URL(d.DATABASE_URL);
  if (address.hostname !== '127.0.0.1' || address.port !== '55454' || !/^\\/j2_suite_\\d{3}$/.test(address.pathname)) throw Error('Ranked UI fixture requires the disposable canonical database');
  const fixturePool = new Pool({connectionString: d.DATABASE_URL, max: 1});
  try {
    const location = await fixturePool.query('SHOW data_directory');
    if (location.rows[0].data_directory !== data) throw Error('Ranked UI fixture requires the runner-owned cluster');
    await fixturePool.query('BEGIN');
    const rows = await fixturePool.query('SELECT "id", "sourceLabel" FROM "RankedListQuestion" ORDER BY "id" FOR UPDATE');
    const ids = new Set(Array.from({length: 82}, (_, i) => 'ranked-seed-' + (i + 1)));
    if (rows.rows.length !== ids.size || rows.rows.some(row => !ids.has(row.id) || row.sourceLabel !== 'إعداد تحريري لقدّام')) throw Error('Ranked UI fixture requires the exact frozen starter bank');
    const changed = await fixturePool.query('UPDATE "RankedListQuestion" SET "sourceLabel" = $1 WHERE "id" = ANY($2::text[])', ['إعداد تحريري أصلي لقلبة', [...ids]]);
    if (changed.rowCount !== ids.size) throw Error('Incomplete Ranked UI legacy-label fixture');
    await fixturePool.query('COMMIT');
    writeFileSync(join(root, 'receipts/Ranked-UI-Legacy-Fixture.json'), JSON.stringify({identity: c.identity, changedField: 'sourceLabel', rows: changed.rowCount, originalLabel: 'إعداد تحريري لقدّام', fixtureLabel: 'إعداد تحريري أصلي لقلبة', assertionAndTimeoutUnchanged: true}, null, 2));
  } catch (error) {
    await fixturePool.query('ROLLBACK');
    throw error;
  } finally {await fixturePool.end();}
}
`;
  const consolidated = copy('verification-tools/consolidated-runner.mjs', [
    ["const runtime=join(root,'../phase5e1/pg-runtime'),bin=join(runtime,'ubuntu/usr/lib/postgresql/16/bin'),pgEnv={...process.env,LD_PRELOAD:join(runtime,'identity.so'),LD_LIBRARY_PATH:join(runtime,'ubuntu/usr/lib/x86_64-linux-gnu')};", pgReplacement],
    ["out=join(root,'verification',mode)", "out=join(root,'verification',process.env.RG03_RUN_LABEL??mode)"],
    ["c.file.startsWith('tests/e2e/')&&mode!=='neighbor'", "c.file.startsWith('tests/e2e/')&&(!process.env.RG03_CASE_IDENTITIES||JSON.parse(process.env.RG03_CASE_IDENTITIES).includes(c.identity))&&mode!=='neighbor'"],
    ["config,c.file,'--grep'", "config,c.file,'--max-failures=1','--retries=0','--grep'"],
    ["await appStart(ce,number+'-server');const start=Date.now();", rankedUiFixture + "await appStart(ce,number+'-server');const start=Date.now();"],
  ], '.ci-consolidated.mjs');
  const quality = copy('verification-tools/quality-runner.mjs', [
    ["const runtime=resolve(root,'../phase5e1/pg-runtime'),bin=join(runtime,'ubuntu/usr/lib/postgresql/16/bin'),pgEnv={...process.env,LD_PRELOAD:join(runtime,'identity.so'),LD_LIBRARY_PATH:join(runtime,'ubuntu/usr/lib/x86_64-linux-gnu')};", pgReplacement],
    ["await run('npm',['run','test'],unitEnv,'test')", "await run('npm',['run','test','--','--bail=1','--retry=0','--no-file-parallelism','--maxWorkers=1','--reporter=json','--outputFile='+join(out,'unit-native.json')],unitEnv,'test')"],
  ], '.ci-quality.mjs');
  const lifecycle = copy('verification-tools/lifecycle-runner.mjs', [
    ["'--config',pwConfig,'production.browser.ts'", "'--config',pwConfig,'--max-failures=1','--retries=0','production.browser.ts'"],
  ], '.ci-lifecycle.mjs');
  const content = copy('verification-tools/content-runner.mjs', [
    ["pgEnv={...process.env,LD_PRELOAD:process.env.PG_IDENTITY_PRELOAD,LD_LIBRARY_PATH:process.env.PG_LIBRARY_PATH}", "pgEnv={...process.env}"],
    ["'--config',config],env,app,'browser'", "'--config',config,'--max-failures=1','--retries=0'],env,app,'browser'"],
  ], '.ci-content.mjs');
  const launch = copy('verification-tools/launch-low-runner.mjs', [
    ["const runtime=join(root,'../phase5e1/pg-runtime'),bin=join(runtime,'ubuntu/usr/lib/postgresql/16/bin');\nconst pgEnv={...process.env,LD_PRELOAD:join(runtime,'identity.so'),LD_LIBRARY_PATH:join(runtime,'ubuntu/usr/lib/x86_64-linux-gnu')};", pgReplacement],
    ["'--config',config],env,'browser'", "'--config',config,'--max-failures=1','--retries=0'],env,'browser'"],
  ], '.ci-launch-low.mjs');
  const security = copy('qalba-platform/scripts/browser-security-runner.mjs', [
    ["'--config',config,...(process.env.I1_BROWSER_FILTER", "'--config',config,'--max-failures=1','--retries=0',...(process.env.I1_BROWSER_FILTER"],
    ["expected:t.expectedStatus,durationMs:r.duration,retry:r.retry", "expected:t.expectedStatus,durationMs:r.duration,retry:r.retry,workerIndex:r.workerIndex"],
  ], '.ci-security.mjs');
  mkdirSync(join(root, 'receipts'), {recursive: true});
  writeFileSync(join(root, 'receipts/CI-Adapter-Audit.json'), JSON.stringify({assertionsChanged: false, assertionTimeoutsChanged: false, mimeFunctionChanged: false, files: audits}, null, 2));
  writeFileSync(join(root, 'receipts/Exact-CI-Adapter.diff'), audits.map(x => x.diff).join('\n'));
  return {consolidated, quality, lifecycle, content, launch, security};
}

if (process.argv[1] === join(import.meta.dirname, 'adapter.mjs')) {
  adapt();
  console.log('Exact CI-only orchestration adapters generated; no tests executed.');
}
