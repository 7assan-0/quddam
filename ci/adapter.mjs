/** Frozen source plus explicitly audited verification-only execution adaptations. */
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
  // Owner-approved exception for identity 066 only. The authored test stays frozen.
  const identity = 'tests/e2e/forbidden-word.spec.ts::Forbidden Word: real Correct Skip Foul and duplicate races consume and score exactly once';
  const input = 'qalba-platform/tests/e2e/forbidden-word.spec.ts';
  const output = 'qalba-platform/src/generated/rg03-forbidden-word.spec.ts';
  const config = 'qalba-platform/src/generated/rg03-forbidden-word.config.ts';
  const before = readFileSync(join(root, input), 'utf8');
  if (sha(before) !== source.files['tests/e2e/forbidden-word.spec.ts']) throw Error('Canonical 066 source is not frozen');
  const oldRace = ' await page.goto("/games");const v=await read(page,id);await expire(id);const r=await Promise.all(["END_ROUND","CORRECT"].map(type=>page.request.post("/api/secret-word/"+id+"/commands",{headers:{Origin:origin},data:{key:crypto.randomUUID(),expectedVersion:v.version,action:{type}}})));expect(r.map(r=>r.status()).sort()).toEqual([200,409]);expect((await read(page,id)).teams.map(t=>t.score)).toEqual(v.teams.map(t=>t.score));';
  const newRace = ` await page.goto("/games");const v=await read(page,id);expect(v.phase).toBe("CARD_ACTIVE");
 const pre=(await sql('SELECT "stateVersion","state",(SELECT count(*)::int FROM "ScoreEvent" WHERE "sessionId"=$1) AS events,(SELECT count(*)::int FROM "GameCommand" WHERE "sessionId"=$1) AS commands FROM "GameSession" WHERE "id"=$1',[id])).rows[0];expect(pre.stateVersion).toBe(v.version);expect(pre.state.phase).toBe("CARD_ACTIVE");
 await expire(id);const keys=[crypto.randomUUID(),crypto.randomUUID()];const r=await Promise.all(["END_ROUND","CORRECT"].map((type,i)=>page.request.post("/api/secret-word/"+id+"/commands",{headers:{Origin:origin},data:{key:keys[i],expectedVersion:v.version,action:{type}}})));
 const bodies=await Promise.all(r.map(response=>response.json()));expect(r[1].status()).toBe(409);
 // Either contender may acquire the row lock first. A late CORRECT can commit
 // ROUND_TIMEOUT while rejecting the judgment, making the other command stale.
 expect([200,409]).toContain(r[0].status());
 if(r[0].status()===200){expect(bodies[1].code).toBe("STALE_GAME_STATE");expect(bodies[0]).toMatchObject({duplicate:false,session:{version:v.version+1,phase:"ROUND_RESULTS",endReason:"TIMEOUT"}});}
 else{expect(bodies[0].code).toBe("STALE_GAME_STATE");expect(["TIMER_EXPIRED","STALE_GAME_STATE"]).toContain(bodies[1].code);}
 // Inspect native state before any GET can settle a missing timeout itself.
 const post=(await sql('SELECT "stateVersion","state",(SELECT count(*)::int FROM "ScoreEvent" WHERE "sessionId"=$1) AS events,(SELECT count(*)::int FROM "GameCommand" WHERE "sessionId"=$1) AS commands,(SELECT jsonb_agg("score" ORDER BY "position") FROM "Team" WHERE "sessionId"=$1) AS scores FROM "GameSession" WHERE "id"=$1',[id])).rows[0];
 expect(post.stateVersion).toBe(v.version+1);expect(post.state).toMatchObject({phase:"ROUND_RESULTS",endReason:"TIMEOUT",deadlineAt:null,remainingMs:0,cardIndex:pre.state.cardIndex,useIds:pre.state.useIds,matchNumber:pre.state.matchNumber,roundIndex:pre.state.roundIndex});expect(post.state.outcomes).toEqual(pre.state.outcomes);expect(post.state.scores).toEqual(v.teams.map(t=>t.score));expect(post.scores).toEqual(v.teams.map(t=>t.score));expect(post.events).toBe(pre.events);expect(post.commands).toBe(pre.commands+1);
 const terminal=await sql('SELECT "key","type","stateVersion" FROM "GameCommand" WHERE "sessionId"=$1 AND "stateVersion">$2 ORDER BY "stateVersion"',[id,v.version]);expect(terminal.rows).toEqual([{key:r[0].status()===200?keys[0]:\`timeout:\${v.matchNumber}:\${v.roundNumber-1}\`,type:r[0].status()===200?"END_ROUND":"ROUND_TIMEOUT",stateVersion:v.version+1}]);
 const card=await sql('SELECT "result","resolvedAt" FROM "ForbiddenWordCardUse" WHERE "sessionId"=$1 AND "id"=$2',[id,pre.state.useIds[pre.state.cardIndex]]);expect(card.rows).toHaveLength(1);expect(card.rows[0].result).toBe("TIMEOUT");expect(card.rows[0].resolvedAt).not.toBeNull();
 const timeouts=await sql('SELECT count(*)::int AS n FROM "ForbiddenWordCardUse" WHERE "sessionId"=$1 AND "matchNumber"=$2 AND "roundIndex"=$3 AND "result"=$4',[id,v.matchNumber,v.roundNumber-1,"TIMEOUT"]);expect(timeouts.rows[0].n).toBe(1);
 console.log("RG03 identity 066 expired-round evidence "+JSON.stringify({statuses:r.map(response=>response.status()),codes:bodies.map(body=>body.code??null),versionBefore:v.version,versionAfter:post.stateVersion,phase:post.state.phase,terminalType:terminal.rows[0].type,scoreEventsBefore:pre.events,scoreEventsAfter:post.events,timeoutCards:timeouts.rows[0].n}));
 expect((await read(page,id)).teams.map(t=>t.score)).toEqual(v.teams.map(t=>t.score));`;
  if (before.split(oldRace).length !== 2) throw Error('Canonical 066 requires exactly one frozen race');
  const adaptedTest = before.replace(oldRace, newRace);
  mkdirSync(join(app, 'src/generated'), {recursive: true});
  writeFileSync(join(root, output), adaptedTest);
  const adaptedConfig = `import{defineConfig,devices}from'@playwright/test';export default defineConfig({testDir:'.',testMatch:'rg03-forbidden-word.spec.ts',timeout:60000,workers:1,retries:0,maxFailures:1,reporter:[['json',{outputFile:process.env.J1_REPORT}]],outputDir:process.env.J1_ARTIFACTS,use:{baseURL:'http://127.0.0.1:3000',...devices['Desktop Chrome'],trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{slowMo:100,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu']}}});`;
  writeFileSync(join(root, config), adaptedConfig);
  const diff = spawnSync('diff', ['-u', '--label', input, '--label', output, join(root, input), join(root, output)], {encoding: 'utf8'});
  if (diff.status !== 1) throw Error('Unable to record exact approved canonical 066 diff');
  const override = {identity, canonicalNumber: 66, input, inputSha256: sha(before), output, outputSha256: sha(adaptedTest), config, configSha256: sha(adaptedConfig), edits: [[oldRace, newRace]], diff: diff.stdout,
    authorization: 'Owner approved only identity 066 race oracle: both valid lock orders, exactly-once timeout and unchanged scores; frozen authored files unchanged.', assertionTimeoutsChanged: false};
  const canonicalSelection = `const approved066=JSON.parse(readFileSync(join(root,'receipts/CI-Adapter-Audit.json'))).canonicalOverrides[0];const override066=c.identity===${JSON.stringify(identity)};if(override066){for(const[path,hash]of[[approved066.output,approved066.outputSha256],[approved066.config,approved066.configSha256]])if(createHash('sha256').update(readFileSync(join(root,path))).digest('hex')!==hash)throw Error('Approved canonical 066 source changed');}const executionConfig=override066?join(root,approved066.config):config,executionFile=override066?join(root,approved066.output):c.file;`;
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
    ["config,c.file,'--grep'", "executionConfig,executionFile,'--max-failures=1','--retries=0','--grep'"],
    ["await appStart(ce,number+'-server');const start=Date.now();", rankedUiFixture + canonicalSelection + "await appStart(ce,number+'-server');const start=Date.now();"],
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
  writeFileSync(join(root, 'receipts/CI-Adapter-Audit.json'), JSON.stringify({assertionsChanged: true, authoredAssertionsChanged: false, assertionTimeoutsChanged: false, mimeFunctionChanged: false, files: audits, canonicalOverrides: [override]}, null, 2));
  writeFileSync(join(root, 'receipts/Exact-CI-Adapter.diff'), [...audits.map(x => x.diff), override.diff].join('\n'));
  return {consolidated, quality, lifecycle, content, launch, security};
}

if (process.argv[1] === join(import.meta.dirname, 'adapter.mjs')) {
  adapt();
  console.log('Exact CI-only orchestration adapters generated; no tests executed.');
}
