#!/usr/bin/env node
/**
 * Real Google Chrome acceptance harness. Start the loopback app separately, then:
 * CHROME_EXECUTABLE=/absolute/path/to/chrome BASE_URL=http://localhost:3000 \
 *   node scripts/player-hosted-nine-chrome.mjs --evidence-dir /tmp/nine-chrome
 * Optional: --clock-boundary (synthetic browser time, native RTC unchanged),
 * --soakMinutes 60 (a separate real one-hour room lifecycle; nine players after joining).
 * No traces, video, network dumps, credentials, SDP, ICE, or invitation identifiers
 * are written. Only allowlisted observations are serialized. Failed steps produce
 * a sanitized failure code; raw Playwright errors can contain secret URLs.
 */
import { chromium } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, appendFile, realpath, readFile, lstat, readlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute, dirname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkoutRoot = resolve(appRoot, '..');
const playwrightVersion = createRequire(import.meta.url)('@playwright/test/package.json').version;
const execFileAsync = promisify(execFile);
const letters = 'ABCDEFGHI';
const args = process.argv.slice(2);
let evidenceDirectory;
let evidenceReady = false;
let soakMinutes = 0;
let clockBoundary = false;
let stage = 'configuration';
let browser;
const sessions = [];
const report = {
  schema: 1, startedAt: new Date().toISOString(),
  nativeRtc: true, isolatedStorageContexts: true,
  transport: 'Google Chrome native RTCPeerConnection and reliable ordered RTCDataChannel; no ICE servers',
  artifacts: 'allowlisted JSON, counts, and invitation-masked screenshots; no trace/video/network log',
  assertions: [], checkpoints: [], measurements: [],
};

function check(condition, code) {
  if (!condition) { const error = new Error(code); error.assertionCode = code; throw error; }
}
function assertion(code) { report.assertions.push({ code, passed: true }); }
function sleep(milliseconds) { return new Promise(done => setTimeout(done, milliseconds)); }
async function persist() {
  if (evidenceReady) await writeFile(resolve(evidenceDirectory, 'results.json'), JSON.stringify(report, null, 2) + '\n');
}
async function progress(event, details = {}) {
  const entry = { at: new Date().toISOString(), event, ...details };
  if (evidenceReady) await appendFile(resolve(evidenceDirectory, 'progress.ndjson'), JSON.stringify(entry) + '\n');
  process.stdout.write(JSON.stringify(entry) + '\n');
  await persist();
}

const sha256 = value => createHash('sha256').update(value).digest('hex');
async function sourceSnapshot() {
  const git = async parameters => (await execFileAsync('git', parameters, { cwd: checkoutRoot, maxBuffer: 8 * 1024 * 1024 })).stdout;
  const [sourceHeadText, trackedText, dirtyText] = await Promise.all([
    git(['rev-parse', 'HEAD']), git(['ls-files', '--stage', '-z']), git(['diff', '--name-only', '-z', 'HEAD']),
  ]);
  const sourceHead = sourceHeadText.trim();
  check(/^[a-f0-9]{40,64}$/.test(sourceHead), 'source_head_valid');
  const generated = /(?:^|\/)(?:\.git|node_modules|\.next|generated|dist|build|out|coverage|playwright-report|test-results)(?:\/|$)|(?:^|\/)next-env\.d\.ts$|\.tsbuildinfo$/;
  const entries = trackedText.split('\0').filter(Boolean).map(record => {
    const separator = record.indexOf('\t');
    return { path: record.slice(separator + 1), indexMode: record.slice(0, separator).split(' ')[0] };
  }).filter(entry => !generated.test(entry.path));
  const files = [];
  for (let offset = 0; offset < entries.length; offset += 32) {
    const batch = await Promise.all(entries.slice(offset, offset + 32).map(async entry => {
      const filename = resolve(checkoutRoot, entry.path);
      try {
        const stat = await lstat(filename);
        const mode = stat.isSymbolicLink() ? '120000' : stat.isDirectory() ? '160000' : (stat.mode & 0o111) ? '100755' : '100644';
        const bytes = stat.isSymbolicLink() ? Buffer.from(await readlink(filename)) : stat.isFile() ? await readFile(filename) : Buffer.alloc(0);
        return { path: entry.path, mode, sha256: sha256(bytes) };
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return { path: entry.path, mode: entry.indexMode, sha256: null, missing: true };
      }
    }));
    files.push(...batch);
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const nextEnv = await readFile(resolve(appRoot, 'next-env.d.ts'));
  const normalizedNextEnv = nextEnv.toString('utf8').replaceAll('./.next/dev/types/', './.next/types/');
  return {
    at: new Date().toISOString(), sourceHead,
    dirtyTracked: dirtyText.split('\0').filter(Boolean).sort(),
    inventorySha256: sha256(JSON.stringify(files)), files,
    excluded: 'Git metadata, node_modules, generated/build/test-output directories, tsbuildinfo, and generated next-env.d.ts',
    generatedNextEnvironment: { path: 'qalba-platform/next-env.d.ts', sha256: sha256(nextEnv), normalizedSha256: sha256(normalizedNextEnv),
      normalization: 'Only ./.next/dev/types/ versus ./.next/types/ import prefixes are treated as equivalent.' },
    harness: { path: 'qalba-platform/scripts/player-hosted-nine-chrome.mjs', sha256: sha256(await readFile(fileURLToPath(import.meta.url))) },
  };
}
function compareSource(before, after) {
  // Documentation changes are recorded in the complete inventory; these paths
  // determine the running application, transport, dependencies, and harness.
  const relevant = path => /^qalba-platform\/(?:src\/|public\/|prisma\/|scripts\/|package(?:-lock)?\.json$|next\.config\.|tsconfig\.json$|middleware\.)/.test(path);
  const previous = new Map(before.files.filter(entry => relevant(entry.path)).map(entry => [entry.path, JSON.stringify(entry)]));
  const current = new Map(after.files.filter(entry => relevant(entry.path)).map(entry => [entry.path, JSON.stringify(entry)]));
  const changedRelevantPaths = [...new Set([...previous.keys(), ...current.keys()])].filter(path => previous.get(path) !== current.get(path)).sort();
  const generatedNextEnvEquivalent = before.generatedNextEnvironment.normalizedSha256 === after.generatedNextEnvironment.normalizedSha256;
  return { trackedInventoryUnchanged: before.inventorySha256 === after.inventorySha256,
    sourceHeadUnchanged: before.sourceHead === after.sourceHead,
    relevantApplicationFilesUnchanged: changedRelevantPaths.length === 0,
    changedRelevantPaths, generatedNextEnvEquivalent,
    harnessUnchanged: before.harness.sha256 === after.harness.sha256 };
}

// The proxy constructs and returns the original native object. It does not
// replace SDP/ICE, signaling, timers, RTC state, channel methods, or messages.
function installNativeObservation() {
  const Native = window.RTCPeerConnection;
  const peers = [];
  const channels = [];
  let duplicatePacketsSent = 0;
  let rejectedProbePacketsSent = 0;
  const history = [];
  let regression = false;
  let scoreRegression = false;
  let last;
  const read = () => {
    const roundText = document.querySelector('[data-testid="round"]')?.textContent || '';
    const match = roundText.match(/الجولة (\d+) · الحالة (waiting|open|locked|result) · الإصدار (\d+)/);
    const scores = [...document.querySelectorAll('[data-testid="scores"] strong')].map(node => Number(node.textContent));
    const scoreRows = [...document.querySelectorAll('[data-testid="scores"] > p')];
    const slot = scoreRows.findIndex(node => node.getAttribute('aria-current') === 'true');
    const connection = document.querySelector('[data-testid="connection"]')?.textContent || '';
    const winnerText = document.querySelector('[data-testid="winner"]')?.textContent || '';
    const winnerMatch = winnerText.match(/أول ضغطة مقبولة: (?:الهوست A|اللاعب ([B-I]))/);
    const button = document.querySelector('[data-testid="player-buzz"]');
    return {
      slot, round: match ? Number(match[1]) : null,
      phase: match ? match[2] : null, version: match ? Number(match[3]) : null,
      scores, winner: winnerMatch ? (winnerMatch[1] ? winnerMatch[1].charCodeAt(0) - 65 : 0) : null,
      connected: connection.includes(' · متصل'), closed: connection.includes('الجلسة مغلقة'),
      buzzDisabled: !button || button.disabled,
      hasAdministration: !!document.querySelector('section[aria-label="إدارة الجولة"]'),
      capacityRejected: [...document.querySelectorAll('[role="status"]')].some(node => node.textContent.includes('الغرفة مكتملة')),
    };
  };
  const observe = () => {
    const state = read();
    if (state.version === null) return;
    const key = JSON.stringify([state.round, state.phase, state.version, state.scores]);
    if (last?.key === key) return;
    if (last && state.version < last.version) regression = true;
    if (last && state.scores.some((score, index) => score < last.scores[index])) scoreRegression = true;
    history.push({ round: state.round, phase: state.phase, version: state.version, scores: state.scores });
    last = { ...state, key };
  };
  window.RTCPeerConnection = new Proxy(Native, {
    construct(target, parameters, newTarget) {
      const peer = Reflect.construct(target, parameters, newTarget);
      peers.push(peer);
      peer.addEventListener('datachannel', event => channels.push(event.channel));
      return peer;
    },
  });
  new MutationObserver(observe).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  window.__nineChrome = {
    read,
    duplicateBuzz(round, count) {
      const channel = channels.find(value => value.readyState === 'open');
      if (!channel) return 0;
      for (let index = 0; index < count; index++) {
        channel.send(JSON.stringify({ type: 'BUZZ', round }));
        duplicatePacketsSent++;
      }
      return count;
    },
    rejectedProbes(oldRound, currentRound) {
      const channel = channels.find(value => value.readyState === 'open');
      if (!channel) return 0;
      for (const raw of [JSON.stringify({ type: 'BUZZ', round: oldRound }), 'invalid-json', JSON.stringify({ type: 'BUZZ', round: currentRound, slot: 0 })]) {
        channel.send(raw);
        rejectedProbePacketsSent++;
      }
      return 3;
    },
    history: () => ({ snapshots: history, versionRegression: regression, scoreRegression }),
    async native() {
      const result = {
        constructorIsNative: Function.prototype.toString.call(Native).includes('[native code]'),
        peerCount: peers.length, connectedPeerCount: 0, iceServerCount: 0,
        nativeInstances: peers.every(peer => peer instanceof Native),
        dataChannelCount: 0, openDataChannelCount: 0,
        messagesSent: 0, messagesReceived: 0, bytesSent: 0, bytesReceived: 0,
        duplicatePacketsSent, rejectedProbePacketsSent, states: [],
      };
      for (const peer of peers) {
        result.states.push(peer.connectionState);
        if (peer.connectionState === 'connected') result.connectedPeerCount++;
        result.iceServerCount += peer.getConfiguration().iceServers?.length || 0;
        if (peer.connectionState === 'closed') continue;
        const stats = await peer.getStats();
        stats.forEach(value => {
          if (value.type !== 'data-channel') return;
          result.dataChannelCount++;
          if (value.state === 'open') result.openDataChannelCount++;
          for (const key of ['messagesSent', 'messagesReceived', 'bytesSent', 'bytesReceived']) result[key] += value[key] || 0;
        });
      }
      return result;
    },
  };
}

async function pageFor(label, options = {}) {
  const context = await browser.newContext({ viewport: label.endsWith('A') ? { width: 1120, height: 1000 } : { width: 430, height: 1000 } });
  await context.addInitScript(installNativeObservation);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const counts = { error: 0, warning: 0, log: 0, info: 0, debug: 0, other: 0, pageError: 0, requestFailed: 0 };
  const requestFailureReasons = {}, requestFailureStages = {};
  const signalingHttpStatuses = {}, signalingHttpStages = {};
  page.on('console', message => {
    const kind = message.type() === 'warn' ? 'warning' : message.type();
    counts[Object.hasOwn(counts, kind) ? kind : 'other']++;
  });
  page.on('pageerror', () => counts.pageError++);
  page.on('requestfailed', request => {
    counts.requestFailed++;
    const text = request.failure()?.errorText || '';
    const reason = /^net::ERR_[A-Z0-9_]+$/.test(text) ? text : 'unknown';
    requestFailureReasons[reason] = (requestFailureReasons[reason] || 0) + 1;
    const stageCounts = requestFailureStages[stage] ||= {};
    stageCounts[reason] = (stageCounts[reason] || 0) + 1;
  });
  if (options.clock) await page.clock.install({ time: new Date() });
  const session = { label, context, page, counts, requestFailureReasons, requestFailureStages,
    signalingHttpStatuses, signalingHttpStages, expires: undefined };
  // Keep only the numeric expiry; response bodies are never logged or persisted.
  page.on('response', async response => {
    if (!response.url().endsWith('/api/labs/player-hosted-rooms')) return;
    const status = response.status();
    const statusKey = Number.isInteger(status) && status >= 100 && status <= 599 ? String(status) : 'unknown';
    signalingHttpStatuses[statusKey] = (signalingHttpStatuses[statusKey] || 0) + 1;
    const stageCounts = signalingHttpStages[stage] ||= {};
    stageCounts[statusKey] = (stageCounts[statusKey] || 0) + 1;
    if (!response.ok()) return;
    try {
      const value = await response.json();
      if (Number.isSafeInteger(value?.credentials?.expires)) session.expires = value.credentials.expires;
    } catch { /* An aborted response during page close carries no evidence. */ }
  });
  sessions.push(session);
  return session;
}
async function ui(session) { return session.page.evaluate(() => window.__nineChrome.read()); }
async function eventually(predicate, code, timeout = 35_000) {
  const end = performance.now() + timeout;
  while (performance.now() < end) {
    if (await predicate()) return;
    await sleep(100);
  }
  check(false, code);
}
async function checkpoint(name, room, expected, options = {}) {
  stage = name;
  await eventually(async () => {
    const states = await Promise.all(room.map(ui));
    return states.every(state => Object.entries(expected).every(([key, value]) => JSON.stringify(state[key]) === JSON.stringify(value)));
  }, `${name}_state_converged`, options.timeout || 35_000);
  const players = await Promise.all(room.map(async session => ({ player: session.label, ...await ui(session), native: await session.page.evaluate(() => window.__nineChrome.native()) })));
  for (const player of players) {
    check(player.native.constructorIsNative && player.native.nativeInstances, `${name}_native_rtc`);
    check(player.native.iceServerCount === 0, `${name}_no_ice_servers`);
  }
  report.checkpoints.push({ name, at: new Date().toISOString(), players });
  assertion(name);
  await progress('checkpoint', { name, players: players.length });
  return players;
}
async function screenshot(session, name) {
  await session.page.locator('details').evaluateAll(nodes => nodes.forEach(node => { node.open = false; }));
  await session.page.screenshot({ path: resolve(evidenceDirectory, `${name}.png`), fullPage: true,
    mask: [session.page.getByTestId('invite-code'), session.page.locator('#share-link'), session.page.locator('#room-code')] });
}
async function createRoom(prefix, count = 8, options = {}) {
  const host = await pageFor(`${prefix}A`, options);
  await host.page.goto(`${process.env.BASE_URL}/labs/player-hosted-rooms`);
  await host.page.getByRole('button', { name: 'إنشاء غرفة', exact: true }).click();
  const invitation = host.page.getByTestId('invite-code');
  await invitation.waitFor({ state: 'visible' });
  const code = (await invitation.innerText()).trim();
  check(/^[A-F0-9]{32}$/.test(code), 'invitation_shape');
  const room = [host];
  for (let slot = 1; slot <= count; slot++) {
    const guest = await pageFor(`${prefix}${letters[slot]}`);
    if (slot % 2) await guest.page.goto(`${process.env.BASE_URL}/labs/player-hosted-rooms#room=${code}`);
    else {
      await guest.page.goto(`${process.env.BASE_URL}/labs/player-hosted-rooms`);
      await guest.page.locator('#room-code').fill(code);
      await guest.page.getByRole('button', { name: 'انضمام للغرفة', exact: true }).click();
    }
    await eventually(async () => (await ui(guest)).connected, `${prefix}_guest_${letters[slot]}_connected`);
    check((await ui(guest)).slot === slot, `${prefix}_guest_${letters[slot]}_seat`);
    room.push(guest);
  }
  return { room, code };
}
async function clickHost(host, name) { await host.page.getByRole('button', { name, exact: true }).click(); }
async function repeatedButton(session, selector, count = 3) {
  await session.page.evaluate(({ selector, count }) => {
    const button = document.querySelector(selector);
    for (let index = 0; index < count; index++) button.click();
  }, { selector, count });
}
async function repeatAward(host) {
  await host.page.getByRole('button', { name: 'احتساب نقطة للفائز', exact: true }).evaluate(button => {
    for (let index = 0; index < 3; index++) button.click();
  });
}
async function measure(session, name) {
  if (!session.cdp) {
    session.cdp = await session.context.newCDPSession(session.page);
    await session.cdp.send('Performance.enable', { timeDomain: 'threadTicks' });
  }
  const result = await session.cdp.send('Performance.getMetrics');
  const permitted = ['ThreadTime', 'ProcessTime', 'TaskDuration', 'JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'Documents'];
  const values = Object.fromEntries(result.metrics.filter(metric => permitted.includes(metric.name)).map(metric => [metric.name, metric.value]));
  const sample = { name, at: new Date().toISOString(), monotonicSeconds: performance.now() / 1000,
    scope: 'host page CDP target; ProcessTime is the renderer process reported for this target, possibly shared; not full browser or machine CPU',
    values };
  report.measurements.push(sample);
  const before = session.lastMeasurement;
  if (before) {
    const elapsed = sample.monotonicSeconds - before.monotonicSeconds;
    sample.intervalSeconds = elapsed;
    for (const key of ['ThreadTime', 'ProcessTime']) {
      if (Number.isFinite(values[key]) && Number.isFinite(before.values[key])) {
        sample[`${key}DeltaSeconds`] = values[key] - before.values[key];
        sample[`${key}CpuPercentOfOneCore`] = (values[key] - before.values[key]) / elapsed * 100;
      }
    }
    if (!Number.isFinite(values.ProcessTime) && !Number.isFinite(values.ThreadTime)) sample.cpuLimitation = 'Browser did not expose ThreadTime or ProcessTime; TaskDuration is task occupancy, not measured CPU.';
  }
  session.lastMeasurement = sample;
}
async function collectHistory(room, name) {
  const values = await Promise.all(room.map(async session => ({ player: session.label, ...await session.page.evaluate(() => window.__nineChrome.history()) })));
  check(values.every(value => !value.versionRegression && !value.scoreRegression), `${name}_monotonic`);
  (report.histories ||= []).push({ name, players: values });
  assertion(`${name}_versions_and_scores_monotonic`);
}
async function verifyStorage(room, name) {
  const players = await Promise.all(room.map(async session => ({ player: session.label,
    ...await session.page.evaluate(() => {
      const ownSlot = window.__nineChrome.read().slot;
      const guestRecords = [];
      let hostCredentialObjects = 0;
      for (let index = 0; index < sessionStorage.length; index++) {
        const key = sessionStorage.key(index);
        let value;
        try { value = JSON.parse(sessionStorage.getItem(key)); } catch { value = null; }
        if (value?.role === 'host') hostCredentialObjects++;
        if (key.startsWith('quddam-guest-room-v3:')) guestRecords.push(value);
      }
      return { ownSlot, totalEntries: sessionStorage.length, guestRoomEntries: guestRecords.length,
        guestRoleOnly: guestRecords.every(value => value?.role === 'guest'),
        ownGuestSlotOnly: guestRecords.every(value => ownSlot > 0 && value?.slot === ownSlot),
        hostCredentialObjects };
    }) })));
  check(players.every(player => player.hostCredentialObjects === 0), `${name}_no_stored_host_credentials`);
  check(players.filter(player => player.ownSlot === 0).every(player => player.guestRoomEntries === 0), `${name}_host_has_no_guest_credentials`);
  check(players.filter(player => player.ownSlot > 0).every(player => player.guestRoomEntries === 1 && player.guestRoleOnly && player.ownGuestSlotOnly), `${name}_guest_only_own_saved_seat`);
  (report.storageEvidence ||= []).push({ name, players });
  assertion(`${name}_storage_has_only_own_guest_credentials_and_no_host_credentials`);
}

async function acceptance() {
  stage = 'nine_player_join';
  const { room, code } = await createRoom('acceptance-');
  const host = room[0], guestB = room[1], guestI = room[8];
  const zeros = Array(9).fill(0);
  const full = await checkpoint('nine_native_players_connected', room, { connected: true, round: 0, phase: 'waiting', version: 0, scores: zeros });
  check(full[0].native.connectedPeerCount === 8, 'host_has_eight_native_peers');
  check(full.slice(1).every(value => value.native.connectedPeerCount === 1 && !value.hasAdministration), 'eight_guests_one_native_peer_no_admin');
  assertion('host_eight_native_peers_and_guests_no_admin');
  await verifyStorage(room, 'nine_connected');
  await measure(host, 'nine_connected');
  await sleep(3_000);
  await measure(host, 'nine_connected_idle_three_seconds');
  await screenshot(host, 'nine-connected-host');

  stage = 'reject_ninth_guest';
  const overflow = await pageFor('overflow-guest');
  await overflow.page.goto(`${process.env.BASE_URL}/labs/player-hosted-rooms#room=${code}`);
  await eventually(async () => (await ui(overflow)).capacityRejected, 'ninth_guest_capacity_rejected');
  check((await overflow.page.evaluate(() => window.__nineChrome.native())).peerCount === 0, 'rejected_guest_no_native_peer');
  await checkpoint('overflow_preserves_all_nine', room, { connected: true, version: 0, scores: zeros });
  await overflow.context.close();

  await clickHost(host, 'فتح جولة');
  await checkpoint('round_one_open', room, { connected: true, round: 1, phase: 'open', version: 1, scores: zeros });
  await repeatedButton(host, '[data-testid="player-buzz"]');
  await checkpoint('host_A_wins_as_player', room, { round: 1, phase: 'locked', version: 2, winner: 0, scores: zeros });
  await guestB.page.evaluate(() => window.__nineChrome.duplicateBuzz(1, 3));
  await repeatAward(host);
  const aPoint = [1, 0, 0, 0, 0, 0, 0, 0, 0];
  await checkpoint('host_A_awarded_once_despite_repeats', room, { phase: 'result', version: 3, winner: 0, scores: aPoint });
  await screenshot(host, 'host-A-won-point');

  await clickHost(host, 'فتح جولة');
  await checkpoint('round_two_open', room, { round: 2, phase: 'open', version: 4, scores: aPoint });
  await repeatedButton(guestB, '[data-testid="player-buzz"]');
  await checkpoint('guest_B_wins_before_host', room, { round: 2, phase: 'locked', version: 5, winner: 1, scores: aPoint });
  // Real channel sends exercise server-independent host arbitration after lock.
  const duplicates = await guestB.page.evaluate(() => window.__nineChrome.duplicateBuzz(2, 3));
  check(duplicates === 3, 'duplicate_buzz_sent_over_native_channel');
  await repeatedButton(host, '[data-testid="player-buzz"]');
  await sleep(250);
  await checkpoint('late_host_and_duplicate_guest_cannot_override_B', room, { round: 2, phase: 'locked', version: 5, winner: 1, scores: aPoint });
  await repeatAward(host);
  const abPoints = [1, 1, 0, 0, 0, 0, 0, 0, 0];
  await checkpoint('guest_B_awarded_once', room, { phase: 'result', version: 6, winner: 1, scores: abPoints });
  await repeatAward(host);
  await sleep(250);
  await checkpoint('duplicate_award_does_not_change_scores_or_version', room, { phase: 'result', version: 6, scores: abPoints });

  await clickHost(host, 'فتح جولة');
  await checkpoint('round_three_open', room, { round: 3, phase: 'open', version: 7 });
  check(await guestB.page.evaluate(() => window.__nineChrome.rejectedProbes(2, 3)) === 3, 'bounded_native_rejection_probes_sent');
  await sleep(250);
  await checkpoint('bounded_stale_malformed_identity_packets_ignored', room, { connected: true, phase: 'open', version: 7, winner: null, scores: abPoints });
  await guestI.page.getByTestId('player-buzz').click();
  await checkpoint('guest_I_wins', room, { phase: 'locked', version: 8, winner: 8, scores: abPoints });
  await clickHost(host, 'احتساب نقطة للفائز');
  const abiPoints = [1, 1, 0, 0, 0, 0, 0, 0, 1];
  const awarded = await checkpoint('all_nine_agree_on_scores', room, { phase: 'result', version: 9, scores: abiPoints });
  check(awarded[0].native.messagesSent > 0 && awarded[0].native.messagesReceived > 0 && awarded.slice(1).every(value => value.native.messagesReceived > 0), 'native_data_messages_observed');
  assertion('native_channel_messages_observed');
  await screenshot(host, 'three-winners-host');
  // Complete the scoreboard: A, B, I, then C through H each win one round.
  let completedRound = 3;
  const completeScores = [...abiPoints];
  for (const slot of [2, 3, 4, 5, 6, 7]) {
    completedRound++;
    await clickHost(host, 'فتح جولة');
    await checkpoint(`round_${completedRound}_open`, room, { round: completedRound, phase: 'open', version: completedRound * 3 - 2 });
    await room[slot].page.getByTestId('player-buzz').click();
    await checkpoint(`guest_${letters[slot]}_wins`, room, { phase: 'locked', version: completedRound * 3 - 1, winner: slot, scores: completeScores });
    await clickHost(host, 'احتساب نقطة للفائز');
    completeScores[slot]++;
    await checkpoint(`guest_${letters[slot]}_awarded_once`, room, { phase: 'result', version: completedRound * 3, scores: completeScores });
  }
  const finalScores = Array(9).fill(1);
  await checkpoint('all_nine_players_each_scored_once', room, { connected: true, round: 9, phase: 'result', version: 27, scores: finalScores });
  await screenshot(host, 'all-nine-score-one-host');
  await screenshot(guestI, 'winner-I-before-reload');
  await collectHistory(room, 'before_reload');

  stage = 'guest_I_reload';
  await guestI.page.reload();
  await checkpoint('reloaded_I_retains_slot_score_and_no_admin', room, { connected: true, phase: 'result', version: 27, scores: finalScores });
  const restored = await ui(guestI);
  check(restored.slot === 8 && !restored.hasAdministration, 'guest_I_same_seat_no_host_controls');
  assertion('guest_I_same_seat_and_no_host_controls');
  await verifyStorage(room, 'after_I_reload');
  await screenshot(guestI, 'winner-I-after-reload');
  await measure(host, 'nine_rounds_gameplay_and_guest_I_reconnection');
  await collectHistory(room, 'after_reload');

  stage = 'close_single_guest';
  await room[7].context.close();
  const survivors = room.filter((_, index) => index !== 7);
  await checkpoint('one_guest_close_preserves_other_eight', survivors, { connected: true, version: 27, scores: finalScores });
  await eventually(async () => (await host.page.evaluate(() => window.__nineChrome.native())).connectedPeerCount === 7, 'host_has_seven_surviving_native_peers');
  assertion('host_has_seven_surviving_native_peers');
  await clickHost(host, 'فتح جولة');
  await checkpoint('open_round_before_host_close', survivors, { round: 10, phase: 'open', version: 28, buzzDisabled: false });
  await host.context.close();
  const remainingGuests = survivors.slice(1);
  await checkpoint('host_close_disables_all_remaining_guests', remainingGuests, { connected: false, buzzDisabled: true }, { timeout: 20_000 });
  check((await Promise.all(remainingGuests.map(ui))).every(value => !value.hasAdministration), 'host_close_never_promotes_guest');
  assertion('host_close_never_promotes_guest');
  await screenshot(guestI, 'host-closed-guest-I');
  for (const guest of remainingGuests) await guest.context.close();

  stage = 'fresh_room';
  const fresh = await createRoom('fresh-', 1);
  check(fresh.code !== code, 'fresh_room_has_new_invitation');
  await checkpoint('fresh_room_zero_scores_no_previous_winner', fresh.room, { connected: true, round: 0, phase: 'waiting', version: 0, winner: null, scores: zeros });
  const [freshHost, freshGuest] = fresh.room;
  await clickHost(freshHost, 'فتح جولة');
  await checkpoint('fresh_room_open_before_same_page_reset', fresh.room, { connected: true, round: 1, phase: 'open', version: 1 });
  await freshHost.page.getByTestId('player-buzz').click();
  await checkpoint('fresh_host_wins_before_same_page_reset', fresh.room, { phase: 'locked', version: 2, winner: 0 });
  await clickHost(freshHost, 'احتساب نقطة للفائز');
  await checkpoint('fresh_host_scored_before_same_page_reset', fresh.room, { phase: 'result', version: 3, scores: aPoint });
  stage = 'same_page_reset_and_recreate';
  for (const session of fresh.room) await session.page.getByRole('button', { name: 'إغلاق وإعادة التجربة', exact: true }).click();
  await freshHost.page.getByRole('button', { name: 'إنشاء غرفة', exact: true }).click();
  await freshHost.page.getByTestId('invite-code').waitFor({ state: 'visible' });
  const resetCode = (await freshHost.page.getByTestId('invite-code').innerText()).trim();
  check(/^[A-F0-9]{32}$/.test(resetCode) && resetCode !== fresh.code && resetCode !== code, 'same_page_reset_generates_new_invitation');
  await freshGuest.page.locator('#room-code').fill(resetCode);
  await freshGuest.page.getByRole('button', { name: 'انضمام للغرفة', exact: true }).click();
  await checkpoint('same_pages_recreated_room_zero_scores_no_winner', fresh.room, { connected: true, round: 0, phase: 'waiting', version: 0, winner: null, scores: zeros });
  check((await ui(freshGuest)).slot === 1 && !(await ui(freshGuest)).hasAdministration, 'same_page_reset_guest_seat_without_administration');
  assertion('same_page_reset_guest_seat_without_administration');
  await screenshot(freshHost, 'same-page-reset-fresh-host');
  for (const session of fresh.room) await session.context.close();
  report.fastAcceptance = { passed: true, realWallSeconds: (performance.now() - runStart) / 1000 };
  await progress('fast_acceptance_passed');
}

async function browserClockBoundary() {
  stage = 'synthetic_browser_clock_boundary';
  const { room } = await createRoom('clock-', 1, { clock: true });
  const host = room[0], guest = room[1];
  check(Number.isSafeInteger(host.expires), 'clock_expiry_available');
  await clickHost(host, 'فتح جولة');
  await checkpoint('clock_room_open_native_rtc', room, { connected: true, phase: 'open', version: 1 });
  // This is browser clock advancement only; server Date.now and native RTC are real.
  await host.page.clock.pauseAt(new Date(host.expires - 1));
  const before = await ui(host);
  check(before.connected && !before.closed && !before.buzzDisabled, 'browser_clock_59_59_999_still_open');
  assertion('browser_clock_59_59_999_still_open');
  await host.page.clock.fastForward(1);
  await eventually(async () => (await ui(host)).closed && (await ui(host)).buzzDisabled, 'browser_clock_60_00_host_closed');
  await eventually(async () => !(await ui(guest)).connected && (await ui(guest)).buzzDisabled, 'browser_clock_expiry_disables_guest');
  assertion('browser_clock_60_00_closes_native_links');
  report.browserClockBoundary = { passed: true, scope: 'synthetic browser clock at server-issued expiry minus 1ms and expiry; server clock unchanged; not a real-hour soak', nativeRtc: true };
  for (const session of room) await session.context.close();
  await progress('synthetic_browser_clock_boundary_passed');
}

async function realTimeSoak() {
  stage = 'real_time_soak';
  const beforeCreate = performance.now();
  const { room } = await createRoom('soak-');
  const host = room[0];
  check(Number.isSafeInteger(host.expires), 'soak_expiry_available');
  const connectedAt = performance.now();
  await checkpoint('soak_nine_connected', room, { connected: true, phase: 'waiting', version: 0, scores: Array(9).fill(0) });
  await measure(host, 'soak_start');
  await screenshot(host, 'soak-nine-connected');
  const requestedSeconds = soakMinutes * 60;
  const remainingRoomMilliseconds = host.expires - Date.now();
  const stopAt = soakMinutes === 60 ? performance.now() + remainingRoomMilliseconds + 10_000 : connectedAt + requestedSeconds * 1000;
  let heartbeat = 0;
  let firstDisconnect;
  let lastAllNineConnectedElapsedSeconds = (connectedAt - beforeCreate) / 1000;
  while (performance.now() < stopAt) {
    await sleep(Math.min(30_000, Math.max(1, stopAt - performance.now())));
    const elapsedSeconds = (performance.now() - beforeCreate) / 1000;
    const states = await Promise.all(room.map(ui));
    const connectedPlayers = states.filter(value => value.connected).length;
    if (connectedPlayers === 9) lastAllNineConnectedElapsedSeconds = elapsedSeconds;
    const expectedExpiryWindow = Date.now() >= host.expires - 1_000;
    if (connectedPlayers !== 9 && firstDisconnect === undefined) firstDisconnect = elapsedSeconds;
    if (!expectedExpiryWindow) check(connectedPlayers === 9, 'real_soak_all_nine_remain_connected_before_expiry');
    for (const state of states) {
      check(state.version === 0 && state.scores.every(score => score === 0), 'real_soak_snapshot_stable');
      check(!state.hasAdministration || state.slot === 0, 'real_soak_no_guest_promotion');
    }
    await measure(host, `soak_heartbeat_${++heartbeat}`);
    const native = await host.page.evaluate(() => window.__nineChrome.native());
    (report.soakHeartbeats ||= []).push({ at: new Date().toISOString(), elapsedSeconds, connectedPlayers, hostNativeConnectedPeers: native.connectedPeerCount });
    await progress('real_soak_heartbeat', { elapsedSeconds, connectedPlayers, hostNativeConnectedPeers: native.connectedPeerCount });
  }
  const finalStates = await Promise.all(room.map(ui));
  if (soakMinutes === 60) check(finalStates.every(value => !value.connected && value.buzzDisabled), 'real_hour_expiry_disables_all_nine');
  else check(finalStates.every(value => value.connected), 'short_real_soak_remains_connected');
  await collectHistory(room, 'real_soak');
  report.realTimeSoak = { passed: true, requestedMinutes: soakMinutes,
    measuredWallSeconds: (performance.now() - beforeCreate) / 1000,
    connectionSetupSeconds: (connectedAt - beforeCreate) / 1000,
    observationSecondsAfterAllNineConnected: (performance.now() - connectedAt) / 1000,
    lastAllNineConnectedElapsedSeconds,
    firstObservedDisconnectSeconds: firstDisconnect ?? null,
    fullHourRoomLifecycle: soakMinutes === 60, clock: 'real Node monotonic elapsed time; no browser clock installed',
    expiryObserved: soakMinutes === 60 };
  assertion(soakMinutes === 60 ? 'real_hour_expiry_disables_all_nine' : 'short_real_soak_remains_connected');
  await screenshot(host, 'soak-final-host');
  for (const session of room) await session.context.close();
  await progress('real_soak_passed', { measuredWallSeconds: report.realTimeSoak.measuredWallSeconds });
}

const runStart = performance.now();
try {
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--evidence-dir') evidenceDirectory = args[++index];
    else if (args[index] === '--soakMinutes') soakMinutes = Number(args[++index]);
    else if (args[index] === '--clock-boundary') clockBoundary = true;
    else check(false, 'unknown_argument');
  }
  check(process.env.BASE_URL === 'http://localhost:3000', 'base_url_must_be_exact_approved_loopback');
  check(typeof process.env.CHROME_EXECUTABLE === 'string' && isAbsolute(process.env.CHROME_EXECUTABLE), 'absolute_chrome_executable_required');
  check(typeof evidenceDirectory === 'string' && isAbsolute(evidenceDirectory), 'absolute_external_evidence_directory_required');
  check(Number.isFinite(soakMinutes) && soakMinutes >= 0 && soakMinutes <= 60, 'soak_minutes_between_zero_and_sixty');
  await mkdir(evidenceDirectory, { recursive: true });
  evidenceDirectory = await realpath(evidenceDirectory);
  const pathFromCheckout = relative(await realpath(checkoutRoot), evidenceDirectory);
  check(pathFromCheckout === '..' || pathFromCheckout.startsWith(`..${sep}`) || isAbsolute(pathFromCheckout), 'evidence_must_remain_outside_checkout');
  evidenceReady = true;
  report.sourceStart = await sourceSnapshot();
  report.sourceHead = report.sourceStart.sourceHead;
  await persist();
  const versionResult = await execFileAsync(process.env.CHROME_EXECUTABLE, ['--version']);
  const versionMatch = versionResult.stdout.trim().match(/^(Google Chrome(?: for Testing)?) (\d+\.\d+\.\d+\.\d+)$/);
  check(!!versionMatch, 'actual_google_chrome_distribution_required');
  browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  report.browser = { distribution: versionMatch[1], executableVersion: versionMatch[2], playwrightVersion,
    actualBrowserVersion: browser.version(), headless: true, sandboxDisabledForContainer: true };
  check(browser.version() === versionMatch[2], 'launched_chrome_version_matches_executable');
  await progress('browser_started', { version: browser.version() });
  await acceptance();
  if (clockBoundary) await browserClockBoundary();
  else report.browserClockBoundary = { run: false };
  if (soakMinutes > 0) await realTimeSoak();
  else report.realTimeSoak = { run: false, fullHourRoomLifecycle: false };
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = { stage, code: error.assertionCode || 'browser_operation_failed', errorType: ['TimeoutError', 'Error', 'TypeError'].includes(error.name) ? error.name : 'Error' };
  process.exitCode = 1;
} finally {
  if (report.sourceStart) {
    try {
      report.sourceEnd = await sourceSnapshot();
      report.sourceVerification = compareSource(report.sourceStart, report.sourceEnd);
      const verified = report.sourceVerification;
      check(verified.sourceHeadUnchanged && verified.relevantApplicationFilesUnchanged && verified.generatedNextEnvEquivalent && verified.harnessUnchanged, 'application_source_unchanged_during_browser_run');
      assertion('application_source_unchanged_during_browser_run');
    } catch {
      report.passed = false;
      report.sourceVerificationFailed = true;
      report.failure ||= { stage: 'source_verification', code: 'application_source_verification_failed', errorType: 'Error' };
      process.exitCode = 1;
    }
  }
  report.finishedAt = new Date().toISOString();
  report.wallSeconds = (performance.now() - runStart) / 1000;
  await browser?.close().catch(() => {});
  report.consoleCounts = sessions.map(session => ({ player: session.label, ...session.counts }));
  report.requestDiagnostics = sessions.map(session => ({ player: session.label,
    requestFailureReasons: session.requestFailureReasons, requestFailureStages: session.requestFailureStages,
    signalingHttpStatuses: session.signalingHttpStatuses, signalingHttpStages: session.signalingHttpStages }));
  await persist().catch(() => {
    report.artifactWriteFailed = true;
    report.passed = false;
    process.exitCode = 1;
  });
  process.stdout.write(JSON.stringify({ event: 'completed', passed: report.passed, assertionsPassed: report.assertions.length, failure: report.failure || null, wallSeconds: report.wallSeconds }) + '\n');
}
