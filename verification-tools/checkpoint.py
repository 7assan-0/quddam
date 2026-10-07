from pathlib import Path
import json,hashlib,zipfile,datetime
root=Path(__file__).resolve().parent.parent;app=root/'qalba-platform';source=json.loads((root/'Source-Manifest.json').read_text())
for n,h in source['files'].items():assert hashlib.sha256((app/n).read_bytes()).hexdigest()==h,n
files={app/n:'qalba-platform/'+n for n in source['files']}
for p in root.glob('*.json'):files[p]=p.name
files[root/'CSS-Patch.diff']='CSS-Patch.diff'
for name in ['Harness-Isolation-Patch.diff','Authorized-Test-Name-Patch.diff','Authorized-Bluff-Fixture-Patch.diff','Native-Harness-Completion-Patch.diff','Quddam-Phase-5.0J-2-BLOCKED-Report.md','Quddam-Phase-5.0J-2-Final-Report.md']:
 p=root/name
 if p.exists():files[p]=name
for p in (root/'verification-tools').iterdir():
 if p.suffix in ['.mjs','.py','.ts'] and not p.name.startswith('write-') and p.name!='package-blocked-evidence.py':files[p]=p.relative_to(root).as_posix()
for d in ['quality-gates','target-preparation']:
 directory=root/'verification'/d
 if directory.exists():
  for p in directory.iterdir():
   if p.name in ['Content-Audit.json','Run-Completion.json','build.log','content-validation.log','lint.log','ops-validation.log','migrate.log','test.log','typecheck.log','typecheck-restored-baseline.log']:files[p]=p.relative_to(root).as_posix()
for d in ['targeted','bluff-targeted','canonical']:
 directory=root/'verification'/d
 for n in ['Buzzer-Measurements.json','Neighbor-Control-Measurements.json','Execution-Results.json','Run-Completion.json']:
  p=directory/n
  if p.exists():files[p]=p.relative_to(root).as_posix()
for d in ['native','lifecycle','content-browser','launch-low-browser','security-headers']:
 p=root/'verification'/d/'Run-Completion.json'
 if p.exists():files[p]=p.relative_to(root).as_posix()
p=root/'verification/attempt-01/canonical/088-native.json'
if p.exists():files[p]=p.relative_to(root).as_posix()
verdict=json.loads((root/'Release-Verdict.json').read_text())['verdict'] if (root/'Release-Verdict.json').exists() else None
progress={'phase':'5.0J-2','approvedFixtureOnlyRerun':True,'sourceFingerprint':source['sourceFingerprint'],'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceFiles':source['fileCount'],'changesSinceStoppedJ2':['tests/e2e/bluff-game.spec.ts'],'productSourceChangedInAuthorizedRerun':False,'previousPassClaimsInherited':False,'finalGate':verdict or 'INCOMPLETE; not a release candidate'}
(root/'Progress-Status.json').write_text(json.dumps(progress,indent=2));files[root/'Progress-Status.json']='Progress-Status.json'
p=root/'Quddam-Phase-5.0J-2-pre-final-regression-checkpoint.zip'
with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f,n in sorted(files.items(),key=lambda i:i[1]):z.write(f,n)
with zipfile.ZipFile(p) as z:
 assert z.testzip() is None
 for n,h in source['files'].items():assert hashlib.sha256(z.read('qalba-platform/'+n)).hexdigest()==h
print(json.dumps({'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceFingerprint':source['sourceFingerprint']}))
