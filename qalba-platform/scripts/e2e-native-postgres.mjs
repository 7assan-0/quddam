import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import pg from "pg";

const purpose = "quddam-pr17-category-board";
const fail = (reason) => { throw new Error(`Native PostgreSQL test fixture rejected: ${reason}`); };

// This opt-in test helper never accepts an arbitrary DATABASE_URL. The private
// fixture is created for a new, disposable local container outside the checkout.
export function validateFixture(value) {
  if (!value || Array.isArray(value) || typeof value !== "object" || value.formatVersion !== 1 ||
      value.synthetic !== true || value.purpose !== purpose || !/^[a-f0-9]{48}$/.test(value.fixtureId ?? "") ||
      !/^quddam_pr17_[a-z0-9_]+$/.test(value.expectedDatabase ?? "") ||
      !/^quddam_pr17_[a-z0-9_]+$/.test(value.expectedUser ?? "") ||
      !/^[0-9]+$/.test(value.expectedSystemIdentifier ?? "") ||
      !Number.isInteger(value.expectedPort) || value.expectedPort < 1024 || value.expectedPort > 65535)
    fail("invalid synthetic fixture metadata");
  let url;
  try { url = new URL(value.databaseUrl); } catch { fail("invalid local database URL"); }
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" ||
      Number(url.port) !== value.expectedPort || decodeURIComponent(url.username) !== value.expectedUser ||
      !url.password || url.pathname !== `/${value.expectedDatabase}` || url.hash ||
      url.search !== "?sslmode=disable") fail("database URL does not match the isolated loopback identity");
  return value;
}

export function validateDatabaseIdentity(fixture, actual) {
  if (actual.database !== fixture.expectedDatabase || actual.user !== fixture.expectedUser ||
      actual.systemIdentifier !== fixture.expectedSystemIdentifier ||
      actual.serverPort !== 5432 || Math.floor(Number(actual.versionNumber) / 10000) !== 17)
    fail("connected server identity or PostgreSQL major does not match the new fixture");
}

export function validateMigrationRows(inventory, rows) {
  if (rows.length !== inventory.length) fail("applied migration inventory differs from checked-out SQL");
  const expected = new Map(inventory.map(item => [item.name, item.hash]));
  const seen = new Set();
  for (const row of rows) {
    if (!row.finished_at || row.rolled_back_at || row.checksum !== expected.get(row.migration_name) || seen.has(row.migration_name))
      fail("migration state or checksum differs from checked-out SQL");
    seen.add(row.migration_name);
  }
}

export function validateRetainedMarker(fixture, inventory, markers) {
  const canonical = items => JSON.stringify(items.map(item => ({ name: item.name, hash: item.hash })));
  if (markers.length !== 1 || markers[0].fixture_id !== fixture.fixtureId || markers[0].purpose !== purpose ||
      markers[0].state !== "READY" || !Array.isArray(markers[0].migrations) ||
      canonical(markers[0].migrations) !== canonical(inventory))
    fail("retained synthetic marker is incomplete or does not match this source");
}

export async function migrationInventory(directory = resolve("prisma/migrations")) {
  const names = (await readdir(directory, { withFileTypes: true })).filter(item => item.isDirectory()).map(item => item.name).sort();
  return Promise.all(names.map(async name => ({ name,
    hash: createHash("sha256").update(await readFile(resolve(directory, name, "migration.sql"))).digest("hex") })));
}

export async function openNativePostgresFixture(path, { reuse = false } = {}) {
  if (!isAbsolute(path) || relative(process.cwd(), path) === "" || !relative(process.cwd(), path).startsWith(".."))
    fail("private fixture must be outside the checkout");
  const [file, parent] = await Promise.all([lstat(path), lstat(dirname(path))]);
  if (!file.isFile() || file.isSymbolicLink() || !parent.isDirectory() || parent.isSymbolicLink() ||
      (file.mode & 0o777) !== 0o600 || (parent.mode & 0o777) !== 0o700 ||
      typeof process.getuid === "function" && (file.uid !== process.getuid() || parent.uid !== process.getuid()))
    fail("private fixture requires an owned 0600 file in an owned 0700 directory");
  let fixture;
  try { fixture = validateFixture(JSON.parse(await readFile(path, "utf8"))); }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("Native PostgreSQL test fixture rejected:")) throw error;
    fail("malformed private fixture");
  }
  const client = new pg.Client({ connectionString: fixture.databaseUrl, application_name: "quddam-pr17-synthetic-e2e-guard" });
  try {
    await client.connect();
    const actual = (await client.query(`select current_database() as database, current_user as "user",
      current_setting('server_version_num')::int as "versionNumber", inet_server_addr()::text as "serverAddress",
      inet_server_port() as "serverPort", (select system_identifier::text from pg_control_system()) as "systemIdentifier"`)).rows[0];
    validateDatabaseIdentity(fixture, actual);
    if (!(await client.query("select pg_try_advisory_lock(1818717, 17) as locked")).rows[0].locked)
      fail("another native test invocation already owns the fixture");
    const exists = (await client.query("select to_regclass('quddam_e2e_fixture.identity') is not null as present")).rows[0].present;
    const inventory = await migrationInventory();
    if (reuse) {
      if (!exists) fail("reuse requires a previously completed synthetic fixture");
      const markers = (await client.query("select fixture_id, purpose, state, migrations from quddam_e2e_fixture.identity")).rows;
      validateRetainedMarker(fixture, inventory, markers);
      validateMigrationRows(inventory, (await client.query("select migration_name, checksum, finished_at, rolled_back_at from public._prisma_migrations")).rows);
    } else {
      const tables = Number((await client.query("select count(*) as count from information_schema.tables where table_schema = 'public'")).rows[0].count);
      if (exists || tables !== 0) fail("initialization requires a brand-new database with zero public tables");
      await client.query("create schema quddam_e2e_fixture");
      await client.query("create table quddam_e2e_fixture.identity (fixture_id text primary key, purpose text not null, state text not null, migrations jsonb not null)");
      await client.query("insert into quddam_e2e_fixture.identity values ($1, $2, 'INITIALIZING', $3::jsonb)",
        [fixture.fixtureId, purpose, JSON.stringify(inventory)]);
    }
    return {
      databaseUrl: fixture.databaseUrl,
      needsInitialization: !reuse,
      async completeInitialization() {
        validateMigrationRows(inventory, (await client.query("select migration_name, checksum, finished_at, rolled_back_at from public._prisma_migrations")).rows);
        const result = await client.query("update quddam_e2e_fixture.identity set state = 'READY' where fixture_id = $1 and state = 'INITIALIZING'", [fixture.fixtureId]);
        if (result.rowCount !== 1) fail("synthetic initialization marker changed unexpectedly");
      },
      async close() { await client.end(); },
    };
  } catch (error) {
    await client.end().catch(() => {});
    if (error instanceof Error && error.message.startsWith("Native PostgreSQL test fixture rejected:")) throw error;
    fail("connection or guarded initialization failed; inspect private local diagnostics");
  }
}
