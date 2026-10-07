import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),app=join(root,'qalba-platform'),dir=join(app,'src/generated/j1-discovery');mkdirSync(dir,{recursive:true});
writeFileSync(join(dir,'fixture-private.json'),JSON.stringify({fixtures:[],phone:{},tv:{}}));
const config=join(app,'src/generated/j1-discovery.config.ts');
writeFileSync(config,`import{defineConfig}from'@playwright/test';export default defineConfig({testDir:'../../tests',testMatch:['e2e/*.spec.ts','content/*.browser.ts','launch-low/*.browser.ts','database-lifecycle/*.browser.ts','security-headers/*.browser.ts'],workers:1,retries:0,use:{baseURL:'http://127.0.0.1:3000'}});`);
const listing=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--config',config,'--list','--reporter=json'],{cwd:app,encoding:'utf8',env:{...process.env,DATABASE_URL:'postgresql://postgres@127.0.0.1:55453/j1_discovery',I1_OUTPUT:dir,H1_OUTPUT:dir,CONTENT_OUTPUT:dir,LIFECYCLE_OUTPUT:dir}});
if(listing.status!==0)throw Error(listing.stderr+listing.stdout);
writeFileSync(join(root,'Supplemental-E2E-Discovery.json'),listing.stdout);
const supplemental=[];
function walk(suites){for(const suite of suites){for(const spec of suite.specs??[])supplemental.push({file:'tests/'+spec.file,line:spec.line,title:spec.title,nativeId:spec.id});walk(suite.suites??[]);}}
const json=JSON.parse(listing.stdout);if(json.errors.length)throw Error('Discovery errors');walk(json.suites);

const existing=JSON.parse(readFileSync(join(root,'Quddam-Phase-5.0J-2-Test-Manifest.json')));const current=supplemental.map(c=>({...c,identity:c.file+'::'+c.title,sourceSha256:createHash('sha256').update(readFileSync(join(app,c.file))).digest('hex')}));if(current.length!==existing.browserApi.totalUnique||new Set(current.map(c=>c.identity)).size!==current.length)throw Error('Canonical discovery count mismatch');for(const c of current){const old=existing.browserApi.cases.find(x=>x.identity===c.identity);if(!old||old.sourceSha256!==c.sourceSha256)throw Error('Canonical source or identity mismatch '+c.identity);}writeFileSync(join(root,'Current-E2E-Discovery.json'),JSON.stringify({phase:'5.0J-2',executed:false,totalUnique:current.length,sourceIdentitiesAndHashesUnchanged:true,cases:current},null,2));console.log(JSON.stringify({currentUnique:current.length,unchangedCanonicalIdentities:true}));
