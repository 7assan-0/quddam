import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

const port = 55000 + Math.floor(Math.random() * 1000);
const database = await PGlite.create();
const server = new PGLiteSocketServer({ db: database, host: "127.0.0.1", port, maxConnections: 4 });
await server.start();
const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
const env = { ...process.env, DATABASE_URL: url, E2E_DATABASE_URL: url, DATABASE_POOL_MAX: "1",
  APP_URL: "http://127.0.0.1:3000", AUTH_RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
  SEED_ADMIN_EMAIL: "admin@example.test", SEED_ADMIN_PASSWORD: "e2e-admin-password-123",
  SEED_USER_EMAIL: "player@example.test", SEED_USER_PASSWORD: "e2e-player-password-123" };

async function run(binary, args, additionalEnv = {}) {
  // Each Playwright dev server is a separate process. Interrupted persistence
  // writes left an invalid SST cache that prevented later servers starting.
  // Start each test invocation with a fresh generated dev compiler cache; keep
  // filesystem persistence enabled for the existing memory eviction policy.
  const isBrowserRun = binary.endsWith("playwright") && args[0] === "test";
  if (isBrowserRun) {
    await rm(resolve(".next/dev/cache/turbopack"), {recursive:true, force:true});
    // A stopped dev server can leave a partially overwritten route validator.
    // Next regenerates these types for the next server; never reuse truncated
    // generated validators across isolated browser invocations.
    await rm(resolve(".next/dev/types"), {recursive:true, force:true});
  }
  return new Promise((resolve, reject) => {
    // Each invocation owns an independent test server, while seed accounts and
    // the DB are shared. Scope auth counters to that server so unrelated specs
    // do not exhaust a shared account's eight-attempt window. The production
    // limiter and all attempts within one invocation remain unchanged.
    const childEnv = { ...env, ...additionalEnv,
      ...(isBrowserRun ? { AUTH_RATE_LIMIT_SECRET: randomBytes(32).toString("hex") } : {}) };
    const child = spawn(binary, args, { env: childEnv, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${binary} ${args.join(" ")} failed: ${code}`)));
  });
}

// Ask Playwright for exact case locations. No source parsing, retries, changed
// assertions or skipped cases: every discovered Survey Battle and Forbidden Word case runs once.
async function isolatedCases(spec) {
  const listing = await new Promise((resolveListing, reject) => {
    const child = spawn("./node_modules/.bin/playwright", ["test", `tests/e2e/${spec}`, "--list", "--reporter=json"],
      { env, stdio: ["ignore", "pipe", "inherit"] });
    let output = "";
    child.stdout.on("data", data => { output += data; });
    child.once("error", reject);
    child.once("close", code => {
      if (code !== 0) return reject(new Error("Isolated case discovery failed: " + code));
      try { resolveListing(JSON.parse(output)); } catch (error) { reject(error); }
    });
  });
  const cases = [];
  const visit = suites => { for (const suite of suites) {
    for (const test of suite.specs || []) cases.push({ title: test.title, line: test.line, id: test.id });
    visit(suite.suites || []);
  } };
  visit(listing.suites);
  if (!cases.length || listing.errors.length) throw new Error("Isolated case discovery was not clean");
  return cases;
}

// Continuation is explicit and only accepts native, clean, complete reports
// from identical runtime source/tests. It never retries a failed case.
async function sourceFingerprint() {
  const files = [];
  const walk = async directory => {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = `${directory}/${item.name}`;
      if (item.isDirectory() && item.name !== "generated") await walk(path);
      else if (item.isFile()) files.push(path);
    }
  };
  for (const directory of ["src", "prisma", "tests"]) await walk(directory);
  files.push("package.json", "package-lock.json", "next.config.ts", "playwright.config.ts", "scripts/e2e-warmup.ts");
  const hash = createHash("sha256");
  for (const path of files.sort()) hash.update(path).update("\0").update(await readFile(path)).update("\0");
  return { fingerprint: hash.digest("hex"), sourceFiles: files.length };
}

function validateReport(report, expectedIds, requireClean = false) {
  const ids = [];
  const tests = [];
  const visit = suites => { for (const suite of suites) {
    for (const spec of suite.specs || []) { ids.push(spec.id); tests.push(...spec.tests); }
    visit(suite.suites || []);
  } };
  visit(report.suites);
  const stats = report.stats;
  if (stats.expected + stats.unexpected + stats.skipped + stats.flaky !== expectedIds.length ||
      JSON.stringify(ids.sort()) !== JSON.stringify([...expectedIds].sort()))
    throw new Error("Native report did not contain exactly the discovered case identities");
  if (requireClean && (report.errors.length || stats.expected !== expectedIds.length || stats.unexpected || stats.skipped || stats.flaky ||
      tests.some(test => test.results.length !== 1 || test.results[0].status !== "passed")))
    throw new Error("Continuation cannot reuse a failed, retried or incomplete report");
}

try {
  await run("./node_modules/.bin/prisma", ["migrate", "deploy"]);
  await run("npm", ["run", "db:seed"]);
  // The production build also typechecks any generated dev validators retained
  // by prior browser runs. Regenerate dev types instead of validating stale bytes.
  await rm(resolve(".next/dev/types"), {recursive:true, force:true});
  await run("npm", ["run", "build"]);
  const filters = process.argv.slice(2);
  // Existing browser/API fixtures use HTTP loopback. Keep production secure-cookie
  // policy intact and exercise them in dev. Old specs get a fresh server; the
  // survey and forbidden cases each get one to bound measured compiler memory pressure.
  // Warm-up is limited to the handlers used by that case. Every test runs once;
  // failed specs are recorded, never retried. JSON reports preserve exact totals.
  // The production build is separately validated above; no old test is weakened.
  if (filters.length) await run("./node_modules/.bin/playwright", ["test", ...filters]);
  else {
    const failures = [];
    const results = [];
    const testRuns = [];
    const reportDir = resolve(process.env.E2E_REPORT_DIR || "playwright-report/db-e2e");
    await mkdir(reportDir, { recursive: true });
    const integrity = await sourceFingerprint();
    const continuing = process.env.E2E_CONTINUE === "1";
    if (continuing) {
      if (process.env.E2E_ONLY_SPEC || process.env.E2E_ONLY_CASES) throw new Error("Full-suite continuation cannot use test filters");
      const previous = JSON.parse(await readFile(resolve(reportDir, "run-integrity.json"), "utf8"));
      if (previous.fingerprint !== integrity.fingerprint) throw new Error("Runtime source/tests changed since the interrupted run");
    } else await writeFile(resolve(reportDir, "run-integrity.json"), JSON.stringify(integrity, null, 2));
    let completedReports = 0, completedTests = 0;
    // Opt-in seven-game browser smoke: one exact, pre-existing full-flow case per game.
    // Normal full-suite and single-spec behavior remain unchanged. This mode never
    // treats unselected cases as passing, and it cannot reuse earlier reports.
    const sevenGameSmoke = process.env.E2E_SEVEN_GAME_SMOKE === "1";
    const sevenCaseTitles = {
      "bluff-game.spec.ts": "Bluff: full five-round match has exact leaderboard, winner and score audit counts",
      "court-game.spec.ts": "Court: full five round match role rotation exact scores winner completion",
      "forbidden-word.spec.ts": "Forbidden Word: six-round match has exact ordered turns winner and final scores",
      "ordering-challenge.spec.ts": "Ordering: full seven round match exact scores winner immutable snapshots and completion duplicate",
      "ranked-list.spec.ts": "Ranked List: full five-round match has alternating starters exact totals winner and complete duplicate",
      "social-deduction.spec.ts": "four phones receive private roles; correct vote and wrong guess let players win",
      "survey-battle.spec.ts": "Survey Battle: full five-round winner, completion and free rematch are clean",
    };
    if (sevenGameSmoke && (continuing || process.env.E2E_ONLY_SPEC || process.env.E2E_ONLY_CASES))
      throw new Error("Seven-game smoke cannot combine with continuation or other E2E filters");
    const discoveredSpecs = (await readdir("tests/e2e")).filter(name => name.endsWith(".spec.ts")).sort();
    const specs = sevenGameSmoke ? discoveredSpecs.filter(name => Object.hasOwn(sevenCaseTitles, name)) : process.env.E2E_ONLY_SPEC ? discoveredSpecs.filter(name => name === process.env.E2E_ONLY_SPEC) : discoveredSpecs;
    if (sevenGameSmoke && specs.length !== 7) throw new Error("Seven-game smoke specs are incomplete");
    if (!specs.length) throw new Error("No E2E specs selected");
    for (const spec of specs) {
      const group = spec.startsWith("court-game") ? "court" : spec.startsWith("ordering-challenge") ? "ordering" : spec.startsWith("lightning-quiz") ? "lightning" : spec.startsWith("ranked-list") ? "ranked" : spec.startsWith("bluff-game") ? "bluff" : spec.startsWith("forbidden-word") ? "forbidden" : spec.startsWith("survey-battle") ? "survey" : spec.startsWith("letter-network") ? "letter" : spec.startsWith("social-deduction") ? "social"
        : /^(board-hardening|category-board|rooms)/.test(spec) ? "board" : spec.startsWith("party") ? "party" : "platform";
      const discoveredCases = await isolatedCases(spec);
      const cases = sevenGameSmoke ? discoveredCases.filter(test => test.title === sevenCaseTitles[spec]) : /^(court-game|survey-battle|forbidden-word|bluff-game|ranked-list|lightning-quiz|ordering-challenge)/.test(spec) ? discoveredCases : [null];
      if (sevenGameSmoke && cases.length !== 1) throw new Error("Seven-game smoke title missing or ambiguous: " + spec);
      const stats = [];
      for (const [index, test] of cases.entries()) {
        if (process.env.E2E_ONLY_CASES && !process.env.E2E_ONLY_CASES.split(",").map(Number).includes(index + 1)) continue;
        const reportFile = resolve(reportDir, spec + (test ? "." + String(index + 1).padStart(2, "0") : "") + ".json");
        const caseGroup = spec.startsWith("court-game") ? (test?.title.includes("admin create") ? "court-admin" : test?.title.includes("rematch") ? "court-history" : "court") : spec.startsWith("ordering-challenge") ? (test?.title.includes("admin create") ? "ordering-admin" : test?.title.includes("rematch preserves") ? "ordering-history" : "ordering") : spec.startsWith("lightning-quiz") ? (test?.title.includes("admin create") ? "lightning-admin" : test?.title.includes("rematch preserves") ? "lightning-history" : "lightning") : spec.startsWith("ranked-list") ? (test?.title.includes("admin create") ? "ranked-admin" : test?.title.includes("rematch preserves") ? "ranked-history" : "ranked") : spec.startsWith("bluff-game") ? (test?.title.includes("admin create") ? "bluff-admin" : test?.title.includes("rematch preserves") ? "bluff-history" : "bluff") : spec.startsWith("forbidden-word") ? (test?.title.includes("admin create") ? "forbidden-admin"
          : test?.title.includes("rematch resets") ? "forbidden-history"
          : test?.title.includes("duplicate Start") ? "forbidden-policy"
          : test?.title.includes("responsive") || test?.title.includes("TV JSON") ? "forbidden-phone" : "forbidden")
          : test?.title.includes("admin creates") ? "survey-admin"
          : test?.title.includes("duplicate Start") ? "survey-policy"
          : test?.title.includes("full five-round") ? "survey-history" : group;
        const filter = `tests/e2e/${spec}` + (test ? ":" + test.line : "");
        const expectedIds = test ? [test.id] : discoveredCases.map(item => item.id);
        let completed = false;
        if (continuing) {
          let previous;
          try { previous = await readFile(reportFile, "utf8"); }
          catch (error) { if (error.code !== "ENOENT") throw error; }
          if (previous !== undefined) {
            validateReport(JSON.parse(previous), expectedIds, true);
            completed = true; completedReports++; completedTests += expectedIds.length;
            console.log(`Validated completed native report: ${filter} (${expectedIds.length} passed); no rerun`);
          }
        }
        if (!completed) {
          try { await run("./node_modules/.bin/playwright", ["test", filter, ...(process.env.E2E_TRACE === "on" ? ["--trace", "on", "--output", resolve(reportDir, spec + "." + String(index + 1).padStart(2,"0") + "-trace")] : [])], { E2E_WARMUP_GROUP: caseGroup, E2E_REPORT_FILE: reportFile }); }
          catch (error) { failures.push(error); }
        }
        try {
          const report = JSON.parse(await readFile(reportFile, "utf8"));
          validateReport(report, expectedIds);
          stats.push(report.stats);
          testRuns.push({ spec, title: test?.title, reportFile, completedBeforeContinuation: completed, ...report.stats });
        } catch (error) { failures.push(new Error("Missing or invalid E2E JSON report for " + filter, { cause: error })); }
      }
      results.push({ spec, startTime: stats[0]?.startTime, ...stats.reduce((sum, item) => ({
        duration: sum.duration + item.duration, expected: sum.expected + item.expected, skipped: sum.skipped + item.skipped,
        unexpected: sum.unexpected + item.unexpected, flaky: sum.flaky + item.flaky,
      }), { duration: 0, expected: 0, skipped: 0, unexpected: 0, flaky: 0 }) });
    }
    const totals = results.reduce((sum, result) => ({ passed: sum.passed + result.expected, failed: sum.failed + result.unexpected,
      skipped: sum.skipped + result.skipped, flaky: sum.flaky + result.flaky }), { passed: 0, failed: 0, skipped: 0, flaky: 0 });
    await writeFile(resolve(reportDir, "summary.json"), JSON.stringify({ sevenGameSmoke, selectedSpec: process.env.E2E_ONLY_SPEC || null, selectedSpecs: specs, selectedCases: process.env.E2E_ONLY_CASES || null, continuing, completedReports, completedTests, ...integrity, discoveredSpecs, results, totals, testRuns }, null, 2));
    console.log(`E2E totals: ${totals.passed} passed, ${totals.failed} failed, ${totals.skipped} skipped, ${totals.flaky} flaky`);
    if (failures.length || totals.skipped || totals.flaky || (sevenGameSmoke && (totals.passed !== 7 || testRuns.length !== 7 || totals.failed))) throw new AggregateError(failures, "E2E run was not clean or smoke coverage incomplete");
  }
} finally {
  await server.stop();
  await database.close();
}
