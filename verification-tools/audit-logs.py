from pathlib import Path
import json,re,zipfile,hashlib
r=Path(__file__).resolve().parent.parent;needles=set();private_files=[]
def visit(x,key=''):
 if isinstance(x,dict):
  for k,v in x.items():visit(v,k)
 elif isinstance(x,list):
  for v in x:visit(v,key)
 elif isinstance(x,str) and len(x)>=16 and re.search(r'token|password|secret',key,re.I) and not re.search(r'hash|fingerprint|reference',key,re.I):needles.add(x)
for p in (r/'verification').rglob('*private*.json'):
 try:visit(json.loads(p.read_text()));private_files.append(p.relative_to(r).as_posix())
 except (ValueError,UnicodeError):pass
for p in (r/'verification').rglob('trace.zip'):
 with zipfile.ZipFile(p) as z:
  for n in z.namelist():
   if not n.endswith('.network'):continue
   for line in z.read(n).decode().splitlines():
    s=json.loads(line).get('snapshot',{});req=s.get('request',{})
    for h in req.get('headers',[]):
     name=h.get('name','').lower();value=h.get('value','')
     if name=='cookie':
      for part in value.split(';'):
       value=part.partition('=')[2].strip()
       if len(value)>=16:needles.add(value)
     elif name=='authorization' and value.lower().startswith('bearer '):needles.add(value[7:])
    for v in re.findall(r'[?&]token=([^&]+)',req.get('url','')):
     if len(v)>=16:needles.add(v)
    try:visit(json.loads(req.get('postData',{}).get('text','{}')))
    except (ValueError,TypeError):pass
needles.update(['e2e-admin-password-123','e2e-player-password-123','synthetic-admin-123456','synthetic-user-123456'])
files=list((r/'verification').rglob('*.log'))+list((r/'verification').rglob('Browser-Console.ndjson'));hits=[]
for p in files:
 text=p.read_text(errors='replace')
 if any(v in text for v in needles):hits.append({'file':p.relative_to(r).as_posix(),'classification':'Literal synthetic credential exposure requires investigation; value omitted'})
report={'phase':'5.0J-2','scannedLogFiles':len(files),'knownSyntheticSensitiveValuesCompared':len(needles),'matchedFiles':hits,'rawValuesNeverSerialized':True,'privateFixtureSourcesUsedOnlyInMemory':True,'scope':'Server/runner/browser logs, including preserved first-attempt logs. Source test fixtures are code, not runtime secret exports. Raw private traces and DB backups are never packaged.','result':'PASS' if not hits else 'INVESTIGATE'}
(r/'Log-Secret-Audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
