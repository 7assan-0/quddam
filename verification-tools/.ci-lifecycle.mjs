import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,writeFileSync,appendFileSync,cpSync,mkdirSync,readdirSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,createHash} from 'node:crypto';
const root=process.env.LIFECYCLE_WORKSPACE??(existsSync(join(import.meta.dirname,'qalba-platform'))?import.meta.dirname:join(import.meta.dirname,'..')),app=join(root,'qalba-platform'),out=join(root,process.env.F1_OUTPUT??'development-evidence'),require=createRequire(join(app,'package.json')),{Pool}=require('pg');
const manifestPath=existsSync(join(root,'evidence/Source-Verification.json'))?join(root,'evidence/Source-Verification.json'):join(root,'Source-Manifest.json');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
if(process.env.SOURCE_FINGERPRINT&&process.env.SOURCE_FINGERPRINT!==manifest.sourceFingerprint)throw Error('Requested source fingerprint differs from saved manifest');
mkdirSync(out,{recursive:true});
const bin=process.env.PG_BIN; if(!bin)throw Error('PG_BIN must identify native PostgreSQL 16 binaries for the isolated fixture runner');
const pgEnv={...process.env,...(process.env.PG_IDENTITY_PRELOAD?{LD_PRELOAD:process.env.PG_IDENTITY_PRELOAD}:{}),...(process.env.PG_LIBRARY_PATH?{LD_LIBRARY_PATH:process.env.PG_LIBRARY_PATH}:{})};
const data=mkdtempSync(join(tmpdir(),'quddam-f1-pg-'));
const connection='postgresql://postgres@127.0.0.1:55441/f1_lifecycle';
const env={...process.env,CHECKPOINT_DISABLE:'1',DISABLE_PRISMA_TELEMETRY:'true',NEXT_TELEMETRY_DISABLED:'1',DATABASE_URL:connection,E2E_DATABASE_URL:connection,DATABASE_POOL_MAX:'8',APP_URL:'http://127.0.0.1:3000',AUTH_RATE_LIMIT_SECRET:randomBytes(32).toString('hex'),PUBLIC_WELCOME_CREDITS_ENABLED:'false',AUTH_TRUST_PROXY:'true',AUTH_CLIENT_IP_HEADER:'x-quddam-client-ip',LIFECYCLE_TEST_DATABASE:'1',BILLING_TEST_DATABASE:'1',LIFECYCLE_OUTPUT:out,SEED_ADMIN_EMAIL:'admin@example.test',SEED_ADMIN_PASSWORD:'synthetic-admin-123456',SEED_USER_EMAIL:'player@example.test',SEED_USER_PASSWORD:'synthetic-user-123456',NODE_OPTIONS:'--max-old-space-size=3072',SOURCE_FINGERPRINT:manifest.sourceFingerprint};
delete env.LD_PRELOAD;delete env.LD_LIBRARY_PATH;
let pg,next;
const events=[];
function mark(event,detail={}){events.push({event,at:new Date().toISOString(),...detail});writeFileSync(join(out,'Process-Lifecycle.json'),JSON.stringify(events,null,2));console.log(event);}
function run(command,args,runEnv=env,cwd=app,label=command.replaceAll('/','_')){return new Promise((resolve,reject)=>{const p=spawn(command,args,{cwd,env:runEnv,stdio:['ignore','pipe','pipe']});const log=join(out,label+'.log');writeFileSync(log,'');for(const s of[p.stdout,p.stderr])s.on('data',v=>{appendFileSync(log,v);process.stdout.write(v)});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(label+' exit '+code)));});}
function launch(command,args,runEnv,label,cwd=app){const p=spawn(command,args,{cwd,env:runEnv,stdio:['ignore','pipe','pipe']});for(const s of[p.stdout,p.stderr])s.on('data',v=>appendFileSync(join(out,label+'.log'),v));return p;}
async function poll(fn,timeout=30000){const until=Date.now()+timeout;do{if(await fn())return;await new Promise(r=>setTimeout(r,100));}while(Date.now()<until);throw Error('Bounded readiness timeout');}
async function stop(child,signal='SIGTERM'){if(!child||child.exitCode!==null||child.signalCode!==null)return;const done=new Promise(r=>child.once('exit',r));child.kill(signal);await done;}
async function pgStart(){pg=launch(join(bin,'postgres'),['-D',data,'-h','127.0.0.1','-p','55441','-k','','-c','timezone=UTC','-c','jit=off','-c','max_connections=100'],pgEnv,'postgres',root);await poll(async()=>{try{const p=new Pool({connectionString:'postgresql://postgres@127.0.0.1:55441/postgres',connectionTimeoutMillis:100});try{return (await p.query('SHOW data_directory')).rows[0].data_directory===data}finally{await p.end()}}catch{return false}});mark('postgres-started',{pid:pg.pid,isolatedDataDirectoryVerified:true});}
async function appStart(){next=launch(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],{...env,NODE_ENV:'production'},'next-production');await poll(async()=>{try{return (await fetch('http://127.0.0.1:3000/login')).status===200}catch{return false}},45000);mark('application-started',{pid:next.pid,mode:'next start / production'});}
async function appStop(){const pid=next?.pid;await stop(next);mark('application-stopped',{pid});next=null;}
function guard(){for(const[n,h]of Object.entries(manifest.files)){if(n==='next-env.d.ts')continue;if(createHash('sha256').update(readFileSync(join(app,n))).digest('hex')!==h)throw Error('Source fingerprint mismatch '+n);}}
async function stage(name,pre=false){guard();await run(process.execPath,['--import','tsx','scripts/database-lifecycle-postgres.ts',name],{...env,...(pre?{LIFECYCLE_PRE_UPGRADE:'1'}:{})},app,'native-'+name);guard();const report=JSON.parse(readFileSync(join(out,'native-'+name+'.json')));if(report.sourceFingerprint!==env.SOURCE_FINGERPRINT||report.failed!==0)throw Error('Native report mismatch');writeFileSync(join(out,'archived-native-'+name+'.json'),JSON.stringify(report,null,2));}
const migrations=readdirSync(join(app,'prisma/migrations')).filter(n=>/^\d/.test(n)).sort();
const migrationStage=mkdtempSync(join(app,'src/generated/f1-stage-'));
let copied=0;
async function deploy(count){const migrationPath=join(migrationStage,'migrations-'+count);mkdirSync(migrationPath,{recursive:true});for(let i=0;i<count;i++)cpSync(join(app,'prisma/migrations',migrations[i]),join(migrationPath,migrations[i]),{recursive:true});cpSync(join(app,'prisma/migrations/migration_lock.toml'),join(migrationPath,'migration_lock.toml'));const config=join(migrationStage,'config-'+count+'.ts');writeFileSync(config,`import {defineConfig} from 'prisma/config';export default defineConfig({schema:${JSON.stringify(join(app,'prisma/schema.prisma'))},migrations:{path:${JSON.stringify(migrationPath)}},datasource:{url:process.env.DATABASE_URL}});`);await run(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy','--config',config],env,app,'migrate-through-'+count);copied=count;mark('migration-stage-completed',{count,last:migrations[count-1]});}
async function sql(text,params=[]){const p=new Pool({connectionString:connection,max:1});try{return await p.query(text,params)}finally{await p.end()}}
async function anchorSnapshot(label){const queries={users:'SELECT id,role FROM "User" WHERE id LIKE \'f1-%\' ORDER BY id',sessions:'SELECT id,status,"stateVersion" FROM "GameSession" WHERE id LIKE \'f1-anchor%\' ORDER BY id',auth:'SELECT id,"userId","expiresAt","revokedAt" FROM "AuthSession" WHERE id LIKE \'f1-anchor%\' ORDER BY id'};if(copied>=7){queries.wallet='SELECT "userId",balance FROM "CreditWallet" WHERE "userId"=\'f1-admin\'';queries.purchase='SELECT id,status,"amountHalalas","credits","couponReserved","providerReference" FROM "Purchase" WHERE id LIKE \'f1-anchor%\' ORDER BY id';queries.coupon='SELECT id,"reservedCount","usedCount","maxUses" FROM "Coupon" WHERE id=\'f1-anchor-coupon\'';queries.ledger='SELECT id,delta,"idempotencyKey" FROM "GameCredit" WHERE id LIKE \'f1-anchor%\'';queries.events='SELECT id,provider,"externalId" FROM "PaymentEvent" WHERE id LIKE \'f1-anchor%\'';}const result={};for(const[k,q]of Object.entries(queries))result[k]=(await sql(q)).rows;writeFileSync(join(out,'anchor-'+label+'.json'),JSON.stringify(result,null,2));return result;}
async function interrupted(mode){rmSync(join(out,'worker-ready.json'),{force:true});const child=launch(process.execPath,['--import','tsx','scripts/database-lifecycle-postgres.ts',mode],env,'worker-'+mode);try{await poll(async()=>existsSync(join(out,'worker-ready.json')),25000);const ready=JSON.parse(readFileSync(join(out,'worker-ready.json')));if(ready.mode!==mode)throw Error('Wrong interruption marker');await stop(child,'SIGKILL');mark('worker-killed',{mode,pid:child.pid,ready});}finally{await stop(child,'SIGKILL');}}
try{
 guard();await run(join(bin,'initdb'),['-D',data,'-A','trust','-U','postgres','--no-locale','-E','UTF8'],pgEnv,root,'initdb-isolated');await pgStart();
 await run(join(bin,'createdb'),['-h','127.0.0.1','-p','55441','-U','postgres','f1_lifecycle'],pgEnv,root,'create-fixture-database');
 await deploy(1);
 await sql(`INSERT INTO "User" (id,email,name,role,"updatedAt") VALUES ('f1-host','f1-host@example.test','Host fixture','USER',now()),('f1-admin','f1-admin@example.test','Admin fixture','ADMIN',now());
 INSERT INTO "AuthSession" (id,"userId","tokenHash","expiresAt","revokedAt") VALUES ('f1-anchor-live','f1-host',repeat('a',64),now()+interval '1 day',NULL),('f1-anchor-invalid','f1-host',repeat('b',64),now()-interval '1 day',now()-interval '1 day');
 INSERT INTO "GameType" (id,slug,title,description) VALUES ('f1-anchor-type','f1-legacy-fixture','Historical fixture','Retained synthetic compatibility row');
 INSERT INTO "GameSession" (id,"gameTypeId","hostId",status,state,"stateVersion","updatedAt","endedAt") VALUES ('f1-anchor-history','f1-anchor-type','f1-host','COMPLETED','{"phase":"COMPLETED","scores":[2,1]}',7,now(),now()-interval '120 days');`);
 const early=await anchorSnapshot('after-initial');
 await deploy(7);const after7=await anchorSnapshot('after-checkout');for(const k of Object.keys(early))if(JSON.stringify(early[k])!==JSON.stringify(after7[k]))throw Error('Initial populated identity lost '+k);
 await sql(`INSERT INTO "CreditWallet" ("userId",balance,"updatedAt") VALUES ('f1-admin',3,now());
 INSERT INTO "GameCredit" (id,"userId",delta,reason,"idempotencyKey") VALUES ('f1-anchor-credit','f1-admin',3,'Historical grant','f1-anchor-grant');
 INSERT INTO "Product" (id,slug,title,credits,"priceHalalas",active) VALUES ('f1-anchor-product','f1-historical-product','Historical product',3,1500,true);
 INSERT INTO "Coupon" (id,code,"maxUses","usedCount","reservedCount",active,"discountPercent") VALUES ('f1-anchor-coupon','F1ANCHOR',2,1,1,true,10);
 INSERT INTO "Purchase" (id,"userId","productId","couponId","couponReserved",status,"amountHalalas",credits,provider,"providerReference","idempotencyKey") VALUES ('f1-anchor-pending','f1-admin','f1-anchor-product','f1-anchor-coupon',true,'PENDING',1350,3,'moyasar','f1-historical-invoice','f1-anchor-checkout');
 INSERT INTO "PaymentEvent" (id,provider,"externalId") VALUES ('f1-anchor-event','moyasar','f1-safe-legacy-event');`);
 const financialAnchors=await anchorSnapshot('before-game-migrations');
 await deploy(18);const at18=await anchorSnapshot('after-ten-games');for(const k of Object.keys(financialAnchors))if(JSON.stringify(financialAnchors[k])!==JSON.stringify(at18[k]))throw Error('Populated anchor lost '+k);
 await sql(`INSERT INTO "Category" (id,slug,title,"updatedAt") VALUES ('f1-legacy-category','f1-legacy-category','Synthetic legacy category',now());
 INSERT INTO "SecretWord" (id,word,"categoryId","alternativeAnswers","updatedAt") VALUES ('f1-legacy-word','كلمة تاريخية','f1-legacy-category',ARRAY['مرادف تاريخي'],now());
 INSERT INTO "SocialParticipant" (id,"sessionId","tokenHash",name,position) VALUES ('f1-legacy-outsider','f1-anchor-history',repeat('c',64),'Legacy identity',0);
 INSERT INTO "SocialRound" (id,"sessionId",number,"secretWordId","outsiderId",winner) VALUES ('f1-legacy-round','f1-anchor-history',1,'f1-legacy-word','f1-legacy-outsider','INSIDERS');`);
 await deploy(20);
 const legacy=(await sql('SELECT id,"snapshotOrigin",("wordSnapshot"=\'كلمة تاريخية\') AS captured,"alternativesSnapshot"=ARRAY[\'مرادف تاريخي\'] AS aliases FROM "SocialRound" WHERE id=\'f1-legacy-round\'')).rows[0];if(!legacy.captured||!legacy.aliases||legacy.snapshotOrigin!=='LEGACY_BANK_CAPTURE')throw Error('Legacy snapshot compatibility failed');writeFileSync(join(out,'Legacy-Snapshot-Migration.json'),JSON.stringify(legacy,null,2));
 await deploy(23);const at23=await anchorSnapshot('before-retention');for(const k of Object.keys(financialAnchors))if(JSON.stringify(financialAnchors[k])!==JSON.stringify(at23[k]))throw Error('Hardening migrations altered anchor '+k);
 const preSchema=join(migrationStage,'schema.prisma');let schema=readFileSync(join(app,'prisma/schema.prisma'),'utf8').replace('output   = "../src/generated/prisma"',`output = ${JSON.stringify(join(app,'src/generated/pre-upgrade'))}`).replace(/^\s*retainedVoteCounts.*\n/gm,'').replace(/^\s*retainedVoteCount\s+.*\n/gm,'');writeFileSync(preSchema,schema);
 const preConfig=join(migrationStage,'pre.config.ts');writeFileSync(preConfig,`import {defineConfig} from 'prisma/config';export default defineConfig({schema:${JSON.stringify(preSchema)},datasource:{url:process.env.DATABASE_URL}});`);
 await run(process.execPath,['node_modules/prisma/build/index.js','generate','--config',preConfig],env,app,'generate-pre-E1-client');await run(process.execPath,['--import','tsx','prisma/seed.ts'],env,app,'seed-pre-E1-content');
 await stage('fixture',true);
 // Backup the populated predecessor, not an empty final schema.
 await run(join(bin,'pg_dump'),['-h','127.0.0.1','-p','55441','-U','postgres','-Fc','-f',join(out,'synthetic-pre-upgrade.dump'),'f1_lifecycle'],pgEnv,root,'backup-populated-pre-upgrade');
 await deploy(24);await stage('verify-upgrade');
 await run('npm',['run','db:migrate'],env,app,'migrate-rerun-noop');
 if(process.argv.includes('--probe')){await stage('continue-active');mark('development-probe-complete');}
 else{
 await appStart();await appStop();await appStart();mark('idle-restart-verified');
 await stage('continue-active');await stage('prepare-offline');await appStop();
 const d=JSON.parse(readFileSync(join(out,'offline-deadlines.json'))).deadline;await poll(async()=>Date.now()>d+250,15000);
 await appStart();await stage('verify-offline');
 for(const mode of ['retention-interrupt','reconcile-interrupt','invoice-interrupt','refund-before','refund-after'])await interrupted(mode);
 await appStop();await appStart();await stage('resume-jobs');await stage('failure-mvcc');
 // Reuse existing native acceptance suites; no original tests are altered.
 const regressions=[['billing-settlement-postgres.ts','BILLING_EVIDENCE_FILE'],['billing-recovery-postgres.ts','BILLING_RECOVERY_REPORT'],['billing-refunds-postgres.ts','BILLING_REFUNDS_REPORT'],['command-boundary-postgres.ts','COMMAND_BOUNDARY_REPORT'],['history-content-postgres.ts','HISTORY_CONTENT_REPORT'],['realtime-postgres.ts','REALTIME_MEASURE_REPORT'],['data-retention-postgres.ts','RETENTION_REPORT']];
 if(!process.env.F1_SKIP_EXISTING_NATIVE)for(const[index,[name,variable]]of regressions.entries()){
  const database='f1_regression_'+index;
  await run(join(bin,'createdb'),['-h','127.0.0.1','-p','55441','-U','postgres',database],pgEnv,root,'create-'+database);
  const regressionEnv={...env,DATABASE_URL:connection.replace('f1_lifecycle',database),E2E_DATABASE_URL:connection.replace('f1_lifecycle',database)};
  await run('npm',['run','db:migrate'],regressionEnv,app,'migrate-'+database);
  await run(process.execPath,['--import','tsx','prisma/seed.ts'],regressionEnv,app,'seed-'+database);
  const target=join(out,'regression-'+name+'.json');
  await run(process.execPath,['--import','tsx','scripts/'+name],{...regressionEnv,[variable]:target},app,'regression-'+name);guard();
  const report=JSON.parse(readFileSync(target));if(!report.passed||report.failed)throw Error('Failed/incomplete native regression '+name);
  writeFileSync(join(out,'archived-regression-'+name+'.json'),JSON.stringify({sourceFingerprint:env.SOURCE_FINGERPRINT,sourceHashGuardPassed:true,exitCode:0,nativeReport:report},null,2));
 }
 await sql(`SELECT 1`);
 writeFileSync(join(out,'profile-count.json'),JSON.stringify({count:Math.min(30,(await sql('SELECT count(*)::int n FROM "GameSession" WHERE "hostId"=$1',['f1-host'])).rows[0].n)}));
 // Custom config reuses this production server and never runs dev/reset setup.
 const pwConfig=join(app,'src/generated/f1-playwright.config.ts');
 writeFileSync(pwConfig,`import {defineConfig} from '@playwright/test';export default defineConfig({testDir:${JSON.stringify(join(app,'tests/database-lifecycle'))},testMatch:'**/production.browser.ts',reporter:[['list'],['json',{outputFile:${JSON.stringify(join(out,'browser-native.json'))}}]],timeout:150000,workers:1,retries:0,use:{baseURL:'http://127.0.0.1:3000',viewport:{width:1440,height:900},launchOptions:{executablePath:${JSON.stringify(process.env.CHROMIUM_PATH)},args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu']}},outputDir:${JSON.stringify(join(out,'browser-results'))}});`);
 const browser=launch(process.execPath,['node_modules/@playwright/test/cli.js','test','--config',pwConfig,'--max-failures=1','--retries=0','production.browser.ts'],env,'browser-production');
 const browserDone=new Promise((ok,bad)=>browser.once('exit',code=>code===0?ok():bad(Error('Browser tests exit '+code))));
 try{
  await poll(async()=>existsSync(join(out,'browser-outage-ready.json')),180000);
  await run(join(bin,'pg_ctl'),['-D',data,'-m','immediate','-w','stop'],pgEnv,root,'pg-stop-during-sse');mark('postgres-immediate-stop-during-host-sse');
  await new Promise(r=>setTimeout(r,3500));await pgStart();mark('postgres-recovered-same-data-directory');
  await browserDone;
 }finally{await stop(browser,'SIGKILL');}
 const browserReport=JSON.parse(readFileSync(join(out,'browser-native.json')));
 if(browserReport.stats.expected!==2||browserReport.stats.unexpected||browserReport.stats.skipped||browserReport.stats.flaky||browserReport.errors.length)throw Error('Incomplete native browser evidence');
 writeFileSync(join(out,'archived-browser-native.json'),JSON.stringify(browserReport,null,2));cpSync(join(out,'browser-results'),join(out,'archived-browser-results'),{recursive:true});
 // Restore the pre-upgrade backup into a NEW database, leaving the populated main database intact.
 await run(join(bin,'createdb'),['-h','127.0.0.1','-p','55441','-U','postgres','f1_lifecycle_restore'],pgEnv,root,'create-restore-database');
 await run(join(bin,'pg_restore'),['-h','127.0.0.1','-p','55441','-U','postgres','--exit-on-error','--no-owner','--no-privileges','-d','f1_lifecycle_restore',join(out,'synthetic-pre-upgrade.dump')],pgEnv,root,'restore-new-database');
 const restoreEnv={...env,DATABASE_URL:connection.replace('f1_lifecycle','f1_lifecycle_restore')};
 await run('npm',['run','db:migrate'],restoreEnv,app,'migrate-restored-database');
 await run(process.execPath,['--import','tsx','scripts/database-lifecycle-postgres.ts','restore-check'],restoreEnv,app,'native-restore-check');
 const restoredReport=JSON.parse(readFileSync(join(out,'native-restore-check.json')));if(restoredReport.passed!==1||restoredReport.failed)throw Error('Restore proof incomplete');
 writeFileSync(join(out,'archived-native-restore-check.json'),JSON.stringify(restoredReport,null,2));
 mark('restart-recovery-native-complete');
 }
 guard();writeFileSync(join(out,'Run-Completion.json'),JSON.stringify({sourceFingerprint:env.SOURCE_FINGERPRINT,sourceHashGuardPassed:true,exitCode:0,completedAt:new Date().toISOString(),fullRegression:false},null,2));
}catch(error){writeFileSync(join(out,'Run-Completion.json'),JSON.stringify({sourceFingerprint:env.SOURCE_FINGERPRINT,exitCode:1,error:String(error),completedAt:new Date().toISOString(),fullRegression:false},null,2));throw error;}
finally{await appStop();if(pg){await run(join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop'],pgEnv,root,'pg-stop-final');}rmSync(data,{recursive:true,force:true});}
