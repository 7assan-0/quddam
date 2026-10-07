import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,appendFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
const root=process.env.H1_WORKSPACE??import.meta.dirname,app=join(root,'qalba-platform'),mode=process.argv[2]??'reproduce',out=resolve(root,process.env.H1_OUTPUT??mode),require=createRequire(join(app,'package.json')),{Pool}=require('pg');mkdirSync(out,{recursive:true});
const runtime=join(root,'../phase5e1/pg-runtime'),bin=join(runtime,'ubuntu/usr/lib/postgresql/16/bin');
const pgEnv={...process.env,LD_PRELOAD:join(runtime,'identity.so'),LD_LIBRARY_PATH:join(runtime,'ubuntu/usr/lib/x86_64-linux-gnu')};
const data=mkdtempSync(join(tmpdir(),'h1-native-pg-')),connection='postgresql://postgres@127.0.0.1:55452/h1_launch';
const env={...process.env,CHECKPOINT_DISABLE:'1',DISABLE_PRISMA_TELEMETRY:'true',NEXT_TELEMETRY_DISABLED:'1',DATABASE_URL:connection,DATABASE_POOL_MAX:'8',APP_URL:'http://127.0.0.1:3000',AUTH_RATE_LIMIT_SECRET:randomBytes(32).toString('hex'),PUBLIC_WELCOME_CREDITS_ENABLED:'false',H1_TEST_DATABASE:'1',H1_OUTPUT:out,SEED_ADMIN_EMAIL:'admin@example.test',SEED_ADMIN_PASSWORD:'synthetic-admin-123456',SEED_USER_EMAIL:'player@example.test',SEED_USER_PASSWORD:'synthetic-user-123456',NODE_OPTIONS:'--max-old-space-size=3072'};delete env.LD_PRELOAD;delete env.LD_LIBRARY_PATH;
function run(cmd,args,e=env,label='task'){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{cwd:app,env:e,stdio:['ignore','pipe','pipe']});for(const s of[p.stdout,p.stderr])s.on('data',v=>{appendFileSync(join(out,label+'.log'),v);process.stdout.write(v)});p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(Error(label+' exit '+c)));});}
function launch(cmd,args,e,label){const p=spawn(cmd,args,{cwd:app,env:e,stdio:['ignore','pipe','pipe']});for(const s of[p.stdout,p.stderr])s.on('data',v=>appendFileSync(join(out,label+'.log'),v));return p;}
async function poll(fn,time=45000){const until=Date.now()+time;while(Date.now()<until){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('readiness timeout');}
async function stop(p){if(!p||p.exitCode!==null||p.signalCode!==null)return;const done=new Promise(r=>p.once('exit',r));p.kill();await done;}
const manifest=mode==='final'?JSON.parse(readFileSync(join(root,'Source-Manifest.json'),'utf8')):null;if(manifest)env.SOURCE_FINGERPRINT=manifest.sourceFingerprint;
function guard(){if(manifest)for(const [n,h]of Object.entries(manifest.files))if(createHash('sha256').update(readFileSync(join(app,n))).digest('hex')!==h)throw Error('Fingerprint mismatch '+n);}
let pg,next;try{guard();
await run(join(bin,'initdb'),['-D',data,'-U','postgres','--auth=trust','--locale=C','--encoding=UTF8'],pgEnv,'pg-init');
pg=launch(join(bin,'postgres'),['-D',data,'-h','127.0.0.1','-p','55452','-k','','-c','timezone=UTC','-c','jit=off'],pgEnv,'postgres');
await poll(async()=>{const p=new Pool({connectionString:'postgresql://postgres@127.0.0.1:55452/postgres',connectionTimeoutMillis:100});try{return(await p.query('SHOW data_directory')).rows[0].data_directory===data}catch{return false}finally{await p.end()}});
await run(join(bin,'createdb'),['-h','127.0.0.1','-p','55452','-U','postgres','h1_launch'],pgEnv,'createdb');await run('npm',['run','db:migrate'],env,'migrate');await run(process.execPath,['--import','tsx','prisma/seed.ts'],env,'seed');
if(mode==='reproduce')await run(process.execPath,['--import','tsx','src/generated/h1-reproduce.ts'],env,'baseline-reproduction');
else {
await run(process.execPath,['--import','tsx','scripts/launch-low-postgres.ts'],env,'launch-low-native');
await run('npm',['run','content:validate','--','--output',join(out,'Content-Audit.json')],env,'content-validation');
if(mode==='gates'||mode==='final'&&!process.env.J1_SKIP_EXISTING_NATIVE){
const tasks=[
 ['h1_b01','scripts/billing-settlement-postgres.ts','BILLING_EVIDENCE_FILE','B01-settlement.json'],
 ['h1_recovery','scripts/billing-recovery-postgres.ts','BILLING_RECOVERY_REPORT','M01-M02-recovery.json'],
 ['h1_refunds','scripts/billing-refunds-postgres.ts','BILLING_REFUNDS_REPORT','M03-refunds.json'],
 ['h1_history','scripts/history-content-postgres.ts','HISTORY_CONTENT_REPORT','M10-M11-history-content.json'],
 ['h1_boundary','scripts/command-boundary-postgres.ts','COMMAND_BOUNDARY_REPORT','M08-M09-boundary.json'],
 ['h1_retention','scripts/data-retention-postgres.ts','RETENTION_REPORT','M12-retention.json'],
 ['h1_realtime','scripts/realtime-postgres.ts','REALTIME_MEASURE_REPORT','M06-M07-realtime.json']
];
for(const [name,script,key,report]of tasks){
 await run(join(bin,'createdb'),['-h','127.0.0.1','-p','55452','-U','postgres',name],pgEnv,name+'-create');
 const isolated={...env,DATABASE_URL:connection.replace('/h1_launch','/'+name),BILLING_TEST_DATABASE:'1',[key]:join(out,report),REALTIME_MEASURE_MODE:'after'};
 await run('npm',['run','db:migrate'],isolated,name+'-migrate');await run(process.execPath,['--import','tsx','prisma/seed.ts'],isolated,name+'-seed');
 await run(process.execPath,['--import','tsx',script],isolated,name+'-regression');
}
}
if(mode==='gates'){for(const command of ['lint','typecheck','test','build'])await run('npm',['run',command],command==='test'?{...env,APP_URL:''}:env,command);}
if(mode==='final'){
next=launch(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],{...env,NODE_ENV:'production'},'next');await poll(async()=>{try{return(await fetch('http://127.0.0.1:3000/login')).status===200}catch{return false}});
const browser=process.env.CHROMIUM_PATH??join(root,'../phase5g1/browser-runtime/chromium_headless_shell-1194/chrome-linux/headless_shell'),config=join(app,'src/generated/h1-playwright.config.ts');
writeFileSync(config,`import{defineConfig}from'@playwright/test';export default defineConfig({testDir:${JSON.stringify(join(app,'tests/launch-low'))},testMatch:'**/*.browser.ts',workers:1,retries:0,timeout:60000,reporter:[['list'],['json',{outputFile:${JSON.stringify(join(out,'browser-native.json'))}}]],use:{baseURL:'http://127.0.0.1:3000',viewport:{width:390,height:844},launchOptions:{executablePath:${JSON.stringify(browser)},args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu']}},outputDir:${JSON.stringify(join(out,'browser-results'))}});`);
await run(process.execPath,['node_modules/@playwright/test/cli.js','test','--config',config],env,'browser');
await stop(next);next=undefined;
await run(process.execPath,['--import','tsx','scripts/launch-low-postgres.ts','--verify-browser'],env,'browser-persistence');
// Actual app restart with an expired persisted Board deadline; same DB and credentials.
await run(process.execPath,['--import','tsx','scripts/launch-low-postgres.ts','--prepare-restart'],env,'prepare-restart');
await new Promise(r=>setTimeout(r,1500));next=launch(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],{...env,NODE_ENV:'production'},'next-restart');await poll(async()=>{try{return(await fetch('http://127.0.0.1:3000/login')).status===200}catch{return false}});
await run(process.execPath,['--import','tsx','scripts/launch-low-postgres.ts','--verify-restart'],env,'restart-verification');
}
}
guard();writeFileSync(join(out,'Run-Completion.json'),JSON.stringify({sourceHashGuardPassed:true,sourceFingerprint:env.SOURCE_FINGERPRINT,exitCode:0,fullRegression:false,completedAt:new Date().toISOString()}));
}catch(e){writeFileSync(join(out,'Run-Completion.json'),JSON.stringify({exitCode:1,error:String(e)}));throw e;}finally{await stop(next);if(pg)await run(join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop'],pgEnv,'pg-stop');rmSync(data,{recursive:true,force:true});}
