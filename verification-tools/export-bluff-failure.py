from pathlib import Path
import json, zipfile, hashlib, re, urllib.parse, datetime

root = Path(__file__).resolve().parent.parent
receipt = root / 'verification/canonical/017-native.json'
trace = next((root / 'verification/canonical/017-artifacts').rglob('trace.zip'))
data = json.loads(receipt.read_text())
specs = []
def walk(suites):
    for suite in suites:
        specs.extend(suite.get('specs', []))
        walk(suite.get('suites', []))
walk(data['suites'])
assert len(specs) == 1
result = specs[0]['tests'][0]['results'][0]
assert result['status'] == 'failed' and result['retry'] == 0

views = []
host_phases = []
with zipfile.ZipFile(trace) as archive:
    for name in archive.namelist():
        if not name.endswith('.network'):
            continue
        for line in archive.read(name).decode().splitlines():
            snapshot = json.loads(line).get('snapshot', {})
            request, response = snapshot.get('request', {}), snapshot.get('response', {})
            path = urllib.parse.urlsplit(request.get('url', '')).path
            parts = path.split('/')
            if len(parts) < 4 or parts[1:3] != ['api', 'bluff']:
                continue
            sha = response.get('content', {}).get('_sha1')
            resource = 'resources/' + sha if sha else ''
            if resource not in archive.namelist():
                continue
            try:
                body = json.loads(archive.read(resource))
                view = body.get('session', body)
            except (ValueError, TypeError, AttributeError):
                continue
            if isinstance(view, dict) and 'phase' in view:
                views.append({
                    'traceChannel': name,
                    'method': request.get('method'),
                    'route': '/api/bluff/[id]' + ('/' + '/'.join(parts[4:]) if len(parts) > 4 else ''),
                    'status': response.get('status'),
                    'startedAt': snapshot.get('startedDateTime'),
                    'view': {k: view.get(k) for k in ['version', 'phase', 'serverNow', 'deadlineAt', 'roundNumber', 'matchNumber', 'submissionCount']},
                })
    def find_host(node):
        if isinstance(node, list):
            if len(node) > 1 and isinstance(node[1], dict) and 'bluff-host' in node[1].get('class', ''):
                return {k: node[1].get(k) for k in ['data-phase', 'data-live-ready']}
            for item in node:
                found = find_host(item)
                if found:
                    return found
        elif isinstance(node, dict):
            for item in node.values():
                found = find_host(item)
                if found:
                    return found
        return None
    for line in archive.read('4-trace.trace').decode().splitlines():
        event = json.loads(line)
        if event.get('type') == 'frame-snapshot':
            snapshot = event.get('snapshot', {})
            attrs = find_host(snapshot.get('html'))
            if attrs:
                host_phases.append({'traceMonotonicMs': snapshot.get('timestamp'), **attrs})

out = {
    'phase': '5.0J-2',
    'failureId': 'J2-RG-02',
    'canonicalOrdinal': 17,
    'identity': 'tests/e2e/bluff-game.spec.ts::' + specs[0]['title'],
    'sourceFingerprint': json.loads((root / 'Source-Manifest.json').read_text())['sourceFingerprint'],
    'classification': 'Release-critical canonical fixture/publication mismatch; a normal production deadline defect is not demonstrated',
    'expectedPhase': 'VOTING',
    'actualPhase': 'FAKE_SUBMISSION',
    'assertionTimeoutMs': 5000,
    'durationMs': result['duration'],
    'retry': result['retry'],
    'stats': data['stats'],
    'error': re.sub(r'\x1b\[[0-9;]*m', '', result['error']['message']),
    'location': result['error'].get('location'),
    'originalReceiptSha256': hashlib.sha256(receipt.read_bytes()).hexdigest(),
    'originalTraceSha256': hashlib.sha256(trace.read_bytes()).hexdigest(),
    'safeAuthoritativeResponseTimeline': sorted(views, key=lambda x: x['startedAt'] or ''),
    'safeHostDomTimeline': host_phases,
    'rawCookiesHeadersRequestBodiesScreenshotsSecretsExcluded': True,
    'canonicalFailureRerun': False,
    'sourceChangedAfterFailure': False,
    'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
}
(root / 'Bluff-Failure-Evidence.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'failureId': out['failureId'], 'safeResponseViews': len(views), 'safeHostDomSnapshots': len(host_phases), 'rawSecretsExcluded': True}))
