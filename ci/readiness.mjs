/** Local-only readiness: service PostgreSQL + independent native lifecycle + official browser. */
import {spawn, spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {root} from './adapter.mjs';

const app = join(root, 'qalba-platform'), require = createRequire(join(app, 'package.json'));
const {Pool} = require('pg'), {chromium} = require('@playwright/test');
const out = join(root, 'receipts'); mkdirSync(out, {recursive: true});
const receipt = {status: 'RUNNING', mandatoryTestsStarted: false, conditions: {}, run: {
  repository: process.env.GITHUB_REPOSITORY ?? null, sha: process.env.GITHUB_SHA ?? null,
  id: process.env.GITHUB_RUN_ID ?? null, attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  job: process.env.GITHUB_JOB ?? null, imageOS: process.env.ImageOS ?? null,
  imageVersion: process.env.ImageVersion ?? null,
}};
const save = () => writeFileSync(join(out, 'Runtime-Readiness.json'), JSON.stringify(receipt, null, 2));
const bin = process.env.PG_BIN ?? '/usr/lib/postgresql/16/bin';
let pg, dir;
async function command(cmd, args, env = process.env) {
  const result = spawnSync(cmd, args, {cwd: app, env, encoding: 'utf8'});
  if (result.status !== 0) throw Error(cmd + ' readiness failure: ' + (result.stderr || result.error || result.stdout));
  return result.stdout.trim();
}
async function poll(task) {
  const end = Date.now() + 30000;
  while (Date.now() < end) { if (await task()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw Error('Native PostgreSQL startup readiness failure');
}
save();
try {
  if (process.versions.node !== '24.19.0' || process.getuid() === 0) throw Error('Expected non-root Node 24.19.0 GitHub runner');
  receipt.conditions.node = {status: 'PASS', version: process.versions.node, projectEngines: require('./package.json').engines.node};
  if (process.env.RG03_NPM_CI_COMPLETE !== '1') throw Error('npm ci success receipt missing');
  receipt.conditions.npmCi = {status: 'PASS', command: 'npm ci', npmVersion: await command('npm', ['--version'])};
  const integrity = spawnSync('python3', [join(root, 'ci/baseline.py'), 'verify'], {cwd: root, encoding: 'utf8'});
  if (integrity.status !== 0) throw Error('Frozen source/harness readiness failure: ' + integrity.stderr);
  receipt.conditions.integrity = JSON.parse(readFileSync(join(out, 'Source-Integrity.json')));
  const url = new URL(process.env.DATABASE_URL);
  if (url.hostname !== '127.0.0.1' || url.port !== '5432' || url.pathname !== '/rg03_verification' || url.username !== 'rg03_test') throw Error('Only the isolated CI service database is allowed');
  const service = new Pool({connectionString: url.href, max: 2});
  try {
    const v = (await service.query('SELECT version() AS version, current_setting(\'server_version_num\')::int AS number, current_database() AS db')).rows[0];
    if (Math.floor(v.number / 10000) !== 16 || v.db !== 'rg03_verification') throw Error('CI service is not isolated PostgreSQL 16');
    const imageDigests = await command('docker', ['image', 'inspect', 'postgres:16', '--format', '{{json .RepoDigests}}']);
    receipt.conditions.servicePostgres = {status: 'PASS', version: v.version, major: 16, mode: 'official postgres:16 service', imageDigests: JSON.parse(imageDigests), connection: 'localhost, isolated test database; credentials omitted'};
    await command('npm', ['run', 'db:generate']);
    await command('npm', ['run', 'db:migrate']);
    const rows = await service.query('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name');
    if (rows.rowCount !== 24) throw Error('Existing migration chain incomplete');
    receipt.conditions.prisma = {status: 'PASS', generated: true, appliedMigrationCount: rows.rowCount, existingMigrationNames: rows.rows.map(x => x.migration_name)};
  } finally { await service.end(); }
  const versions = {};
  for (const exe of ['postgres', 'initdb', 'pg_ctl', 'psql', 'createdb', 'pg_dump', 'pg_restore']) {
    versions[exe] = await command(join(bin, exe), ['--version']);
    if (!/\b16\./.test(versions[exe])) throw Error('Native binary must be PostgreSQL 16: ' + exe);
  }
  dir = mkdtempSync(join(tmpdir(), 'rg03-native-readiness-'));
  const data = join(dir, 'pg'), connection = 'postgresql://postgres@127.0.0.1:55440/rg03_native_smoke';
  await command(join(bin, 'initdb'), ['-D', data, '-U', 'postgres', '--auth=trust', '--locale=C', '--encoding=UTF8']);
  const start = async () => {
    pg = spawn(join(bin, 'postgres'), ['-D', data, '-h', '127.0.0.1', '-p', '55440', '-k', '', '-c', 'timezone=UTC', '-c', 'jit=off'], {stdio: ['ignore', 'ignore', 'pipe']});
    let errors = ''; pg.stderr.on('data', x => {errors += x;});
    await poll(async () => {
      if (pg.exitCode !== null) throw Error('Native postgres exited: ' + errors);
      const p = new Pool({connectionString: connection.replace('rg03_native_smoke', 'postgres'), connectionTimeoutMillis: 100});
      try { return (await p.query('SHOW data_directory')).rows[0].data_directory === data; } catch { return false; } finally { await p.end(); }
    });
  };
  const stop = async mode => {
    const child = pg; const exited = new Promise(resolve => child.once('exit', resolve));
    await command(join(bin, 'pg_ctl'), ['-D', data, '-m', mode, '-w', 'stop']);
    if (child.exitCode === null && child.signalCode === null) await exited;
    pg = null;
  };
  await start();
  await command(join(bin, 'createdb'), ['-h', '127.0.0.1', '-p', '55440', '-U', 'postgres', 'rg03_native_smoke']);
  const marker = randomUUID();
  const withDb = async action => {const p = new Pool({connectionString: connection, max: 2}); try {return await action(p);} finally {await p.end();}};
  await withDb(async p => {
    const v = (await p.query('SHOW server_version_num')).rows[0].server_version_num;
    if (Math.floor(Number(v) / 10000) !== 16) throw Error('Native cluster version not 16');
    await p.query('CREATE TABLE smoke (id text PRIMARY KEY)'); await p.query('INSERT INTO smoke VALUES ($1)', [marker]);
    const a = await p.connect(), b = await p.connect();
    try { await a.query('SELECT pg_advisory_lock(501203)'); if ((await b.query('SELECT pg_try_advisory_lock(501203) AS ok')).rows[0].ok) throw Error('Native cross-connection lock proof failed'); await a.query('SELECT pg_advisory_unlock(501203)'); } finally {a.release(); b.release();}
  });
  await command(join(bin, 'pg_dump'), ['-h', '127.0.0.1', '-p', '55440', '-U', 'postgres', '-Fc', '-f', join(dir, 'smoke.dump'), 'rg03_native_smoke']);
  await stop('immediate'); await start();
  await withDb(async p => {if ((await p.query('SELECT id FROM smoke')).rows[0].id !== marker) throw Error('Native restart did not preserve smoke data');});
  await command(join(bin, 'createdb'), ['-h', '127.0.0.1', '-p', '55440', '-U', 'postgres', 'rg03_native_restore']);
  await command(join(bin, 'pg_restore'), ['-h', '127.0.0.1', '-p', '55440', '-U', 'postgres', '--exit-on-error', '--no-owner', '--no-privileges', '-d', 'rg03_native_restore', join(dir, 'smoke.dump')]);
  const restore = new Pool({connectionString: connection.replace('rg03_native_smoke', 'rg03_native_restore')});
  try {if ((await restore.query('SELECT id FROM smoke')).rows[0].id !== marker) throw Error('Native backup restore proof failed');} finally {await restore.end();}
  await stop('fast');
  receipt.conditions.nativeM13Capabilities = {status: 'PASS', versions, mode: 'native runner-owned disposable clusters, not Docker lifecycle emulation', initialization: true, startup: true, independentLocking: true, immediateStopRestart: true, backupRestoreNewDatabase: true, cleanShutdown: true, m13IdentitiesExecuted: false};
  const pw = require('@playwright/test/package.json').version, browsers = JSON.parse(readFileSync(join(dirname(require.resolve('playwright-core/package.json')), 'browsers.json')));
  const expected = browsers.browsers.find(x => x.name === 'chromium');
  if (pw !== '1.56.1' || expected.revision !== '1194' || expected.browserVersion !== '141.0.7390.37') throw Error('Locked Playwright/browser compatibility mismatch');
  if (process.env.PLAYWRIGHT_DOWNLOAD_HOST || process.env.PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw Error('Official browser endpoints and normal TLS verification are required');
  const browserPath = chromium.executablePath();
  const browser = await chromium.launch({executablePath: browserPath, headless: true});
  try {if (browser.version() !== expected.browserVersion) throw Error('Launched Chromium version does not match the locked Playwright revision'); const page = await browser.newPage(); await page.goto('data:text/html,<title>RG03 runtime smoke</title>'); if (await page.title() !== 'RG03 runtime smoke') throw Error('Chromium launch smoke failed'); receipt.conditions.chromium = {status: 'PASS', playwright: pw, revision: expected.revision, expectedVersion: expected.browserVersion, actualVersion: browser.version(), executablePath: browserPath, launch: true, officialProjectCli: true};} finally {await browser.close();}
  receipt.status = 'PASS'; receipt.readyForMandatoryTests = true; save();
  if (process.env.GITHUB_ENV) writeFileSync(process.env.GITHUB_ENV, `PG_BIN=${bin}\nCHROMIUM_PATH=${browserPath}\nPLAYWRIGHT_EXECUTABLE_PATH=${browserPath}\n`, {flag: 'a'});
  console.log('Runtime readiness PASS. This does not count as any mandatory release identity.');
} catch (error) {
  receipt.status = 'FAILED'; receipt.readyForMandatoryTests = false; receipt.originalError = String(error.stack ?? error); save(); throw error;
} finally {
  if (pg && pg.exitCode === null) spawnSync(join(bin, 'pg_ctl'), ['-D', join(dir, 'pg'), '-m', 'fast', '-w', 'stop'], {stdio: 'ignore'});
  if (dir) rmSync(dir, {recursive: true, force: true});
}
