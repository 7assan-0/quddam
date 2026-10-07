import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

// Diagnostic only. Execute the unchanged production helper with controlled
// clock/marker/read dependencies; never rerun or alter the canonical scenario.
const root = path.resolve(import.meta.dirname, '..');
const app = path.join(root, 'qalba-platform');
const sourcePath = 'src/lib/realtime/view-poll.ts';
const source = fs.readFileSync(path.join(app, sourcePath), 'utf8');
const requireFromApp = createRequire(path.join(app, 'package.json'));
const ts = requireFromApp('typescript');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const base = Date.parse('2026-10-06T12:00:00Z');
const iso = ms => new Date(base + ms).toISOString();
const records = [];

async function diagnose(name, { initialVersion = 7, markerVersion = 7, rawExpiry = true, ticks = [1000, 2000, 3000, 4000, 5000, 10000] } = {}) {
  let now = base, marker = markerVersion, markerReads = 0, projectionReads = 0;
  class ControlledDate extends Date { static now() { return now; } }
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: module.exports, module, Date: ControlledDate,
    require: id => {
      if (id === '@/lib/db') return { db: () => ({ gameSession: { findUnique: async () => { markerReads++; return { stateVersion: marker }; } } }) };
      if (id === './errors') return { RealtimeAccessError: class extends Error {} };
      throw new Error('Unexpected diagnostic dependency');
    },
  }, { filename: sourcePath });
  const { createViewPoll, HOST_REFRESH_MS } = module.exports;
  assert.equal(HOST_REFRESH_MS, 10000);
  const read = async () => {
    projectionReads++;
    // Simulated authorized projection: timeout resolution itself is not tested
    // by this diagnostic. The canonical browser failure is retained separately.
    const due = rawExpiry || now >= base + 45000;
    if (due) marker++;
    return { version: marker, phase: due ? 'VOTING' : 'FAKE_SUBMISSION', deadlineAt: due ? iso(90000) : iso(45000) };
  };
  const poll = createViewPoll({ id: 'synthetic-room', initial: { version: initialVersion, phase: 'FAKE_SUBMISSION', deadlineAt: iso(45000) }, host: true, read });
  const observations = [];
  for (const ms of ticks) {
    now = base + ms;
    const result = await poll();
    observations.push({ elapsedMs: ms, emittedPhase: result?.phase ?? null, projectionReads, markerReads });
  }
  records.push({ name, initialVersion, markerVersion, rawFixtureDeadlineChangedWithoutMarker: rawExpiry && initialVersion === markerVersion, observations });
  return observations;
}

const stale = await diagnose('Unversioned fixture mutation after Host cached current marker');
assert.equal(stale.find(x => x.elapsedMs === 5000).projectionReads, 0);
assert.equal(stale.find(x => x.elapsedMs === 10000).emittedPhase, 'VOTING');
const marker = await diagnose('A published marker change is observed at the next probe', { markerVersion: 8, ticks: [1000] });
assert.equal(marker[0].emittedPhase, 'VOTING');
const known = await diagnose('An unchanged known authoritative deadline is resolved when due', { rawExpiry: false, ticks: [44999, 45000] });
assert.equal(known[1].emittedPhase, 'VOTING');
const race = await diagnose('Fixture happens before Host catches the prior command marker', { initialVersion: 6, markerVersion: 7, ticks: [1000] });
assert.equal(race[0].emittedPhase, 'VOTING');
const result = {
  purpose: 'Read-only failure classification; not a canonical rerun or native database proof',
  countedAsReleaseIdentities: false,
  canonicalScenarioRerun: false,
  productOrTestSourceChanged: false,
  sourcePath,
  sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
  dependenciesControlled: ['Date.now', 'GameSession marker lookup', 'authorized projection result'],
  hostRefreshMs: 10000,
  originalCanonicalAssertionMs: 5000,
  conclusion: 'Direct SQL changes deadlineAt without changing stateVersion. The existing marker-aware Host poll cannot see that unpublished deadline before its full refresh when it has already cached the current marker. Whether the prior command marker was observed first changes the fixture result. A normal known deadline remains a due trigger.',
  scenarios: records,
};
fs.writeFileSync(path.join(root, 'Bluff-Poll-Diagnostic.json'), JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify({ diagnosticOnly: true, countedAsReleaseIdentities: false, scenarios: records.length, productOrTestSourceChanged: false }) + '\n');
