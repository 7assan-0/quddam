from pathlib import Path
import json,hashlib,zipfile,shutil,re,datetime,collections
r=Path(__file__).resolve().parent.parent;a=r/'qalba-platform';stage=r/'evidence-package'
if stage.exists():shutil.rmtree(stage)
stage.mkdir();source=json.loads((r/'Source-Manifest.json').read_text());coverage=json.loads((r/'Native-Execution-Coverage.json').read_text());digests=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def put(n,obj):
 p=stage/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def copy(p,n):
 q=stage/n;q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q)
def scrub(text):
 text=re.sub(r'\x1b\[[0-9;]*m','',text);text=re.sub(r'([?&](?:token|key|secret|code)=)[^\s&"\'<>]+',r'\1[REDACTED]',text,flags=re.I);text=re.sub(r"'nonce-[^']+'","'nonce-[REDACTED]'",text);return text
historical={'Targeted-Verification.json','Source-Preservation-Audit.json','First-Attempt-Summary.json','Diagnostic-Coverage-Note.json','J2-Harness-Corrections.json','Verification-Harness-Failure-01.json','Baseline-Harness-Corrections.json','Baseline-Identity.json','Baseline-Migration-Integrity.json','Baseline-Official-Launch-Catalog.json','Baseline-Release-Verdict.json','Baseline-Source-Manifest.json'}
for p in r.glob('*.json'):
 if p.name.startswith('Baseline-Quddam'):continue
 copy(p,('previous-run-provenance/' if p.name in historical else '')+p.name)
for n in ['CSS-Patch.diff','Authorized-Test-Name-Patch.diff','Native-Harness-Completion-Patch.diff','Harness-Isolation-Patch.diff','Quddam-Phase-5.0J-2-Final-Report.md','Quddam-Phase-5.0J-2-BLOCKED-Report.md','Quddam-Phase-5.0J-2-Release-Checklist.md']:
 p=r/n
 if p.exists():copy(p,n)
for p in (r/'verification/quality-gates').iterdir():
 if p.name in ['Content-Audit.json','content-validation.log','ops-validation.log','lint.log','typecheck.log','typecheck-restored-baseline.log','test.log','build.log','migrate.log','Run-Completion.json']:copy(p,'quality-gates/'+p.name)
for sub in ['targeted','neighbor','canonical','attempt-approved-01/canonical','lifecycle','content-browser','launch-low-browser']:
 d=r/'verification'/sub
 if not d.exists():continue
 for p in d.glob('*native.json'):
  try:x=json.loads(p.read_text())
  except ValueError:continue
  if 'stats' not in x:continue
  specs=[]
  def walk(ss):
   for s in ss:
    for c in s.get('specs',[]):
     ts=[]
     for t in c.get('tests',[]):
      results=[]
      for result in t.get('results',[]):
       row={k:result[k] for k in ['status','duration','retry','startTime'] if k in result}
       if result.get('error'):row['error']={'message':scrub(result['error'].get('message','')),'location':result['error'].get('location')}
       results.append(row)
      ts.append({'status':t.get('status'),'results':results})
     specs.append({k:c[k] for k in ['title','file','line','column','id'] if k in c}|{'tests':ts})
    walk(s.get('suites',[]))
  walk(x.get('suites',[]));put(sub+'/'+p.name,{'originalReceiptSha256':sha(p),'stats':x['stats'],'specs':specs,'errors':[{'message':scrub(e.get('message',''))} for e in x.get('errors',[])],'privateNetworkCookiesScreenshotsTracesExcluded':True});digests.append({'original':p.relative_to(r).as_posix(),'sha256':sha(p)})
 for n in ['Execution-Results.json','Run-Completion.json','Buzzer-Measurements.json','Neighbor-Control-Measurements.json','Social-Control-Measurements.json','Process-Lifecycle.json','browser-native.json']:
  p=d/n
  if p.exists() and n!='browser-native.json':copy(p,sub+'/'+n)
by=collections.defaultdict(list)
for c in coverage['cases']:by[c['report']].append(c)
for report,cases in by.items():
 p=r/report;x=json.loads(p.read_text());n='native/'+p.parent.name+'-'+p.name;safe={'originalReceiptSha256':sha(p),'nativePostgres':True,'sourceFingerprint':source['sourceFingerprint'],'source':cases[0]['source'],'sourceSha256':sha(a/cases[0]['source']),'uniqueCases':len(cases),'cases':[{'identity':c['identity'],'status':c['status']} for c in cases],'privateFixtureDetailsExcluded':True}
 if 'measurements' in x:safe['measurements']=x['measurements']
 put(n,safe);digests.append({'original':report,'sha256':sha(p)})
for n in ['Run-Completion.json','Execution-Results.json']:
 p=r/'verification/native'/n
 if p.exists():copy(p,'native/'+n)
prior=r/'verification/attempt-approved-01/native'
if prior.exists():
 for p in prior.rglob('*.json'):
  try:x=json.loads(p.read_text())
  except ValueError:continue
  rows=x.get('cases',x.get('results',[]))
  if not rows or not isinstance(rows,list):continue
  if not all(isinstance(c,dict) and 'name' in c for c in rows):continue
  put('earlier-attempts/native-completeness/'+p.relative_to(prior).as_posix(),{'originalReceiptSha256':sha(p),'reportedPassed':x.get('passed'),'reportedFailed':x.get('failed'),'receiptCaseCount':len(rows),'cases':[{'name':c['name'],'status':c.get('status','passed' if c.get('passed',True) else 'failed')} for c in rows],'notCountedInCurrentGate':True,'privateFixtureDetailsExcluded':True});digests.append({'original':p.relative_to(r).as_posix(),'sha256':sha(p)})
priorlog=r/'verification/quality-attempt-01/test.log'
if priorlog.exists():
 clean=scrub(priorlog.read_text());headers=[line.strip() for line in clean.splitlines() if re.match(r'^\s*FAIL\s+',line)]
 put('earlier-attempts/quality-environment/Unit-Failure-Headers.json',{'originalLogSha256':sha(priorlog),'firstAttemptFailedAssertions':16,'classification':'External APP_URL/Origin mismatch; no canonical/product source change','failureHeaders':headers,'sourceCodeFramesAndRuntimeBodiesExcluded':True,'notCountedInCurrentGate':True});digests.append({'original':priorlog.relative_to(r).as_posix(),'sha256':sha(priorlog)})
for sub in ['native-readiness-diagnostic','native-keepalive-diagnostic']:
 d=r/'verification'/sub
 if not d.exists():continue
 for p in d.rglob('*.json'):
  try:x=json.loads(p.read_text())
  except ValueError:continue
  rows=x.get('cases',[])
  if not rows or not all(isinstance(c,dict) and 'name' in c for c in rows):continue
  put('diagnostics/'+sub+'/'+p.name,{'originalReceiptSha256':sha(p),'reportedPassed':x.get('passed'),'reportedFailed':x.get('failed'),'cases':[{'name':c['name'],'status':c.get('status','passed' if c.get('passed',True) else 'failed')} for c in rows],'countedAsReleaseIdentities':False,'privateFixtureDetailsExcluded':True})
d=r/'verification/security-headers'
for n in ['Browser-Results.json','Browser-Console.ndjson','Header-Matrix.ndjson','Nonce-Diagnostics.ndjson','Fake-Provider-Summary.json','Run-Completion.json','persisted-verification.log','ops-validation.log']:
 p=d/n
 if p.exists():
  q=stage/'security-headers'/n;q.parent.mkdir(parents=True,exist_ok=True);q.write_text(scrub(p.read_text()))
for p in (r/'verification-tools').iterdir():
 if p.suffix in ['.mjs','.py','.ts'] and not p.name.startswith('write-') and p.name!='package-blocked-evidence.py':copy(p,'verification-tools/'+p.name)
put('Original-Receipt-Digests.json',digests)
(stage/'README.md').write_text('NOT READY FOR RELEASE. This authorized continuation changes exactly two Ordering button locator names from the stopped J2 source; assertions and all product source are unchanged. The inherited J2 product patch is one CSS selector exception from stopped J1. Current gate outcomes only are counted:163 native and16 canonical PASS,1 canonical failure,23 native and244 browser/API NOT_EXECUTED. Previous provenance, manually interrupted runs and diagnostics are labeled separately and never added as PASS identities. Native exports omit private runtime payloads, credential hashes and DB backups. Browser exports omit cookies/network/traces/private screenshots. Safe first-failure timelines and original receipt hashes preserve provenance. No new source patch after the Bluff failure, deployment, CSP enforcement, commit or push occurred.\n')
for p in stage.rglob('*'):
 if p.is_file():assert p.suffix not in ['.pem','.dump','.sql','.sqlite'] and 'fixture-private' not in p.name and p.name!='trace.zip',p
put('Evidence-Manifest.json',{'phase':'5.0J-2','sourceFingerprint':source['sourceFingerprint'],'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':{p.relative_to(stage).as_posix():sha(p) for p in sorted(stage.rglob('*')) if p.is_file()}})
p=r/'Quddam-Phase-5.0J-2-Final-Evidence.zip'
with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f in sorted(stage.rglob('*')):
  if f.is_file():z.write(f,f.relative_to(stage).as_posix())
with zipfile.ZipFile(p) as z:assert z.testzip() is None
print(json.dumps({'file':p.name,'bytes':p.stat().st_size,'sha256':sha(p)}))
