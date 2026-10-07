/** External verification harness; no product or canonical assertion changes. */
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),app=join(root,'qalba-platform'),prepareOnly=process.argv.includes('--prepare-target'),out=join(root,prepareOnly?'verification/target-preparation':'verification/quality-gates');mkdirSync(out,{recursive:true});
const source=JSON.parse(readFileSync(join(root,'Source-Manifest.json'))),require=createRequire(join(app,'package.json')),{Pool}=require('pg');
const bin=process.env.PG_BIN;if(!bin)throw Error("PG_BIN required: native PostgreSQL 16");const pgEnv={...process.env};delete pgEnv.LD_PRELOAD;delete pgEnv.LD_LIBRARY_PATH;
const work=mkdtempSync(join(tmpdir(),'j2-approved-quality-')),data=join(work,'pg'),connection='postgresql://postgres@127.0.0.1:55453/j2_quality';
const env={...process.env,DATABASE_URL:connection,E2E_DATABASE_URL:connection,DATABASE_POOL_MAX:'8',APP_URL:'https://quddam.synthetic.test',AUTH_RATE_LIMIT_SECRET:randomBytes(32).toString('hex'),AUTH_TRUST_PROXY:'true',AUTH_CLIENT_IP_HEADER:'x-quddam-client-ip',MOYASAR_SECRET_KEY:'synthetic-local-contract-only',MOYASAR_CALLBACK_TOKEN:randomBytes(32).toString('hex'),BILLING_CRON_SECRET:randomBytes(32).toString('hex'),ANALYTICS_CRON_SECRET:randomBytes(32).toString('hex'),SMTP_HOST:'127.0.0.1',SMTP_PORT:'2525',SMTP_FROM:'synthetic@example.test',PUBLIC_WELCOME_CREDITS_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1',DISABLE_PRISMA_TELEMETRY:'true',NODE_OPTIONS:'--max-old-space-size=3072',SEED_ADMIN_EMAIL:'admin@example.test',SEED_ADMIN_PASSWORD:randomBytes(24).toString('hex'),SEED_USER_EMAIL:'player@example.test',SEED_USER_PASSWORD:randomBytes(24).toString('hex')};
delete env.LD_PRELOAD;delete env.LD_LIBRARY_PATH;
const originalNextEnv=readFileSync(join(app,'next-env.d.ts')),receipt={phase:'5.0J-2',approvedFixtureOnlyRerun:true,preparatoryBuildOnly:prepareOnly,sourceFingerprint:source.sourceFingerprint,previousPhaseOutcomesInherited:false,steps:[]};let pg;
function save(){writeFileSync(join(root,prepareOnly?'Target-Build-Preparation.json':'Quality-Gates.json'),JSON.stringify(receipt,null,2));}
function guard(){for(const[n,h]of Object.entries(source.files))if(createHash('sha256').update(readFileSync(join(app,n))).digest('hex')!==h)throw Error('Source guard mismatch '+n);}
function run(cmd,args,e,label){const row={label,command:[cmd,...args],startedAt:new Date().toISOString(),status:'RUNNING'};receipt.steps.push(row);save();writeFileSync(join(out,label+'.log'),'');console.log('QUALITY '+label);return new Promise((ok,bad)=>{const p=spawn(cmd,args,{cwd:app,env:e,stdio:['ignore','pipe','pipe']});for(const s of[p.stdout,p.stderr])s.on('data',b=>appendFileSync(join(out,label+'.log'),b));p.on('error',bad);p.on('exit',code=>{row.exitCode=code;row.status=code===0?'PASSED':'FAILED';row.finishedAt=new Date().toISOString();save();if(code===0){console.log('PASS '+label);ok();}else bad(Error(label+' exit '+code));});});}
async function poll(){const end=Date.now()+30000;while(Date.now()<end){const p=new Pool({connectionString:'postgresql://postgres@127.0.0.1:55453/postgres',connectionTimeoutMillis:100});try{if((await p.query('SHOW data_directory')).rows[0].data_directory===data)return;}catch{}finally{await p.end();}await new Promise(r=>setTimeout(r,100));}throw Error('PostgreSQL readiness timeout');}
try{
 guard();await run(join(bin,'initdb'),['-D',data,'-U','postgres','--auth=trust','--locale=C','--encoding=UTF8'],pgEnv,'pg-init');
 pg=spawn(join(bin,'postgres'),['-D',data,'-h','127.0.0.1','-p','55453','-k','','-c','timezone=UTC','-c','jit=off'],{cwd:root,env:pgEnv,stdio:['ignore','pipe','pipe']});for(const s of[pg.stdout,pg.stderr])s.on('data',b=>appendFileSync(join(out,'postgres.log'),b));await poll();
 await run(join(bin,'createdb'),['-h','127.0.0.1','-p','55453','-U','postgres','j2_quality'],pgEnv,'db-create');
 await run('npm',['run','db:generate'],env,'prisma-generate');await run('npm',['run','db:migrate'],env,'migrate');await run(process.execPath,['--import','tsx','prisma/seed.ts'],env,'seed');
 if(!prepareOnly){await run('npm',['run','content:validate','--','--output',join(out,'Content-Audit.json')],env,'content-validation');
 await run('npm',['run','ops:validate'],{...env,NODE_ENV:'production'},'ops-validation');
 await run('npm',['run','lint'],env,'lint');await run('npm',['run','typecheck'],env,'typecheck');const unitEnv={...env};delete unitEnv.APP_URL;await run('npm',['run','test','--','--bail=1','--retry=0','--no-file-parallelism','--maxWorkers=1','--reporter=json','--outputFile='+join(out,'unit-native.json')],unitEnv,'test');}
 await run('npm',['run','build'],{...env,NODE_ENV:'production'},'build');
 writeFileSync(join(app,'next-env.d.ts'),originalNextEnv);await run('npm',['run','typecheck'],env,'typecheck-restored-baseline');guard();
 const css={};for(const n of readFileSync(join(app,'.next/BUILD_ID'),'utf8').trim()?[join(app,'.next/BUILD_ID')]:[])css[n.slice(app.length+1)]=createHash('sha256').update(readFileSync(n)).digest('hex');
 writeFileSync(join(root,'Build-Fingerprint.json'),JSON.stringify({sourceFingerprint:source.sourceFingerprint,buildId:readFileSync(join(app,'.next/BUILD_ID'),'utf8').trim(),files:css,productionBuild:true,authoredSourceGuardPassed:true},null,2));
 receipt.passed=true;save();writeFileSync(join(out,'Run-Completion.json'),JSON.stringify({exitCode:0,sourceFingerprint:source.sourceFingerprint,sourceHashGuardPassed:true,completedAt:new Date().toISOString(),previousPassClaimsInherited:false}));console.log('QUALITY GATES COMPLETE');
}catch(e){writeFileSync(join(out,'Run-Completion.json'),JSON.stringify({exitCode:1,sourceFingerprint:source.sourceFingerprint,error:String(e),firstFailurePreserved:true}));throw e;}
finally{writeFileSync(join(app,'next-env.d.ts'),originalNextEnv);if(pg&&pg.exitCode===null)await run(join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop'],pgEnv,'pg-stop');rmSync(work,{recursive:true,force:true});}
