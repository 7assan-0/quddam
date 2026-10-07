from pathlib import Path
import json,hashlib,collections,datetime
r=Path(__file__).resolve().parent.parent;a=r/'qalba-platform';m=json.loads((r/'Quddam-Phase-5.0J-2-Test-Manifest.json').read_text());source=json.loads((r/'Source-Manifest.json').read_text())
for n,h in source['files'].items():assert hashlib.sha256((a/n).read_bytes()).hexdigest()==h,n
for group in ['browserApi','nativePostgres']:
 for c in m[group]['cases']:
  for k in list(c):
   if k.startswith('execution'):c.pop(k)
  c['execution']='NOT_EXECUTED'
def specs(x):
 out=[]
 def walk(ss):
  for s in ss:
   out.extend(s.get('specs',[]));walk(s.get('suites',[]))
 walk(x.get('suites',[]));return out
def setbrowser(file,title,status,report,retries=0):
 candidates=[c for c in m['browserApi']['cases'] if c['file']==file and c['title']==title];assert len(candidates)==1,(file,title)
 c=candidates[0];assert c['execution']=='NOT_EXECUTED',c['identity'];c.update(execution=status,executionEvidence=report,executedRetries=retries)
p=r/'verification/canonical/Execution-Results.json'
if p.exists():
 x=json.loads(p.read_text())
 for run in x['runs']:
  c=next(c for c in m['browserApi']['cases'] if c['identity']==run['identity']);report='verification/canonical/'+run['report'];pw=json.loads((r/report).read_text());matching=[s for s in specs(pw) if s['title']==run['title']];assert len(matching)==1
  test=matching[0]['tests'][0];results=test['results'];assert len(results)==1
  result=results[0];status='PASSED' if result['status']=='passed' and not result.get('retry',0) and not pw['stats']['unexpected'] and not pw['stats']['skipped'] and not pw['stats']['flaky'] else 'FAILED';setbrowser(c['file'],c['title'],status,report,result.get('retry',0))
for sub,file in [('lifecycle','tests/database-lifecycle/production.browser.ts'),('content-browser','tests/content/content.browser.ts'),('launch-low-browser','tests/launch-low/launch-low.browser.ts')]:
 p=r/'verification'/sub/'browser-native.json'
 if not p.exists():continue
 x=json.loads(p.read_text())
 for s in specs(x):
  results=s['tests'][0]['results'];assert len(results)==1
  result=results[0];status='PASSED' if result['status']=='passed' and not result.get('retry',0) else 'SKIPPED' if result['status']=='skipped' else 'FAILED';setbrowser(file,s['title'],status,p.relative_to(r).as_posix(),result.get('retry',0))
p=r/'verification/security-headers/Browser-Results.json'
if p.exists():
 for c in json.loads(p.read_text())['tests']:setbrowser('tests/security-headers/compatibility.browser.ts',c['title'],'PASSED' if c['status']=='passed' and not c['retry'] else 'FAILED',p.relative_to(r).as_posix(),c['retry'])
reports={'billing-settlement':'B01.json','billing-recovery':'M01-M02.json','billing-refunds':'M03.json','auth-abuse':'M05.json','realtime':'M06-M07.json','command-boundary':'M08-M09.json','history-content':'M10-M11.json','data-retention':'M12.json','content':'content/content-native.json','launch-low':'launch-low/launch-low-native.json'};coverage=[]
for name,path in reports.items():
 p=r/'verification/native'/path
 if not p.exists():continue
 x=json.loads(p.read_text());rows=x.get('cases',x.get('results',[]));sourcefile='scripts/'+name+'-postgres.ts';assert x.get('failed',0)==0
 completion=r/'verification/native/Execution-Results.json';completed={z['source']:z['status'] for z in json.loads(completion.read_text())['runs']} if completion.exists() else {}
 if completed.get(sourcefile)!='passed':continue
 assert x['passed']==len(rows),(name,x['passed'],len(rows))
 for row in rows:
  c=next(c for c in m['nativePostgres']['cases'] if c['source']==sourcefile and c['title']==row['name']);assert row.get('passed',True) and row.get('status','passed')=='passed';c.update(execution='PASSED',executionEvidence=p.relative_to(r).as_posix());coverage.append({'identity':c['identity'],'source':sourcefile,'title':c['title'],'status':'passed','report':p.relative_to(r).as_posix()})
for p in (r/'verification/lifecycle').glob('native-*.json'):
 stage=p.stem[len('native-'):];x=json.loads(p.read_text())
 if stage not in ['fixture','verify-upgrade','continue-active','prepare-offline','verify-offline','resume-jobs','failure-mvcc','restore-check']:continue
 assert x.get('failed',0)==0 and x['passed']==len(x['cases'])
 for row in x['cases']:
  c=next(c for c in m['nativePostgres']['cases'] if c['source']=='scripts/database-lifecycle-postgres.ts' and c.get('stage')==stage and c['title']==row['name']);assert row.get('passed',True);c.update(execution='PASSED',executionEvidence=p.relative_to(r).as_posix());coverage.append({'identity':c['identity'],'source':c['source'],'title':c['title'],'status':'passed','report':p.relative_to(r).as_posix()})
assert len({c['identity'] for c in coverage})==len(coverage)
counts={g:dict(collections.Counter(c['execution'] for c in m[g]['cases'])) for g in ['browserApi','nativePostgres']};counts['canonical']=dict(collections.Counter(c['execution'] for c in m['browserApi']['cases'] if c['file'].startswith('tests/e2e/')));counts['supplemental']=dict(collections.Counter(c['execution'] for c in m['browserApi']['cases'] if not c['file'].startswith('tests/e2e/')));m['finalCounts']=counts;m['automaticRetries']=sum(c.get('executedRetries',0) for c in m['browserApi']['cases']);m['previousOutcomesInherited']=False;m['diagnosticsAndTargetedRunsExcludedFromFinalIdentityCounts']=True
(r/'Quddam-Phase-5.0J-2-Test-Manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2));(r/'Native-Execution-Coverage.json').write_text(json.dumps({'phase':'5.0J-2','passedUnique':len(coverage),'previousPassClaimsInherited':False,'cases':coverage},ensure_ascii=False,indent=2));(r/'Final-Execution-Counts.json').write_text(json.dumps(counts,indent=2));print(json.dumps(counts))
