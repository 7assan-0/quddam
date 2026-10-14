// Isolated GitHub-hosted native ARM64/PostgreSQL 17 acceptance fixture.
// Deliberately rejects all non-local / non-synthetic targets; never modifies OCI.
// CI only: the workflow supplies an ephemeral service and no repository secrets.
import assert from "node:assert/strict";
import { readdirSync, existsSync } from "node:fs";
import pg from "pg";
const { Client } = pg;

const phase = process.argv[2];
if (!["before-backup", "after-restore"].includes(phase)) {
  console.error("ARM64_FIXTURE_UNKNOWN_PHASE");
  process.exit(1);
}
assert.equal(process.arch, "arm64", "Native ARM64 runner required, not cross-compilation");
assert.equal(process.platform, "linux");
assert.equal(process.env.ARM64_STAGING_TEST_DATABASE, "1", "Explicit ephemeral CI opt-in required");
const url = new URL(process.env.DATABASE_URL ?? "");
assert.equal(url.protocol, "postgresql:");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "55468");
assert.equal(url.username, "quddam_arm_ci");
assert.equal(url.pathname, "/quddam_arm64_ci");
assert.equal(url.search, "");
assert.equal(url.hash, "");
assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.GITHUB_EVENT_NAME, "pull_request");
assert.equal(process.env.GITHUB_REPOSITORY, "7assan-0/quddam");

const expected = readdirSync(new URL("../prisma/migrations/", import.meta.url), { withFileTypes: true })
  .filter(item => item.isDirectory() &&
    existsSync(new URL("../prisma/migrations/" + item.name + "/migration.sql", import.meta.url)))
  .map(item => item.name).sort();
assert.equal(expected.length, 24, "Review the migration count if the inventory changes");

const ciMarker = "arm64-pg17-restore-fixture";
const connect = async dbName => {
  assert.ok(["quddam_arm64_ci", "quddam_arm64_ci_restore"].includes(dbName));
  const target = new URL(process.env.DATABASE_URL);
  target.pathname = "/" + dbName;
  const client = new Client({ connectionString: target.toString(),
    connectionTimeoutMillis: 5000, statement_timeout: 30000 });
  await client.connect();
  return client;
};
const fingerprint = async client => {
  const version = Number((await client.query("SHOW server_version_num")).rows[0].server_version_num);
  assert.ok(version >= 170000 && version < 180000, "Must be native PostgreSQL 17");
  const rows = (await client.query('SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name')).rows;
  assert.deepEqual(rows.map(row => row.migration_name).sort(), expected, "All original forward migrations must be present");
  assert.ok(rows.every(row => row.finished_at !== null && row.rolled_back_at === null),
    "No incomplete or rolled-back migration");
  const tables = (await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  )).rows.map(row => row.tablename);
  assert.ok(tables.includes("FeatureFlag") && tables.includes("GameSession") && tables.includes("PurchaseRefund"));
  const marker = await client.query('SELECT key, enabled, config FROM "FeatureFlag" WHERE key = $1', [ciMarker]);
  return { version, migrations: rows.map(row => row.migration_name).sort(), tables, marker: marker.rows };
};

const original = await connect("quddam_arm64_ci");
try {
  const baseline = await fingerprint(original);
  if (phase === "before-backup") {
    await original.query("BEGIN");
    try {
      await original.query(
        'INSERT INTO "FeatureFlag" ("key", "enabled", "config", "updatedAt") VALUES ($1, false, $2::jsonb, now())',
        [ciMarker + "-rollback", JSON.stringify({ synthetic: true })]
      );
      await original.query("ROLLBACK");
    } catch (err) { await original.query("ROLLBACK"); throw err; }
    const afterRollback = await original.query('SELECT count(*)::int AS n FROM "FeatureFlag" WHERE key = $1', [ciMarker + "-rollback"]);
    assert.equal(afterRollback.rows[0].n, 0, "Rollback must not persist");
    await original.query(
      'INSERT INTO "FeatureFlag" ("key", "enabled", "config", "updatedAt") VALUES ($1, false, $2::jsonb, now())',
      [ciMarker, JSON.stringify({ synthetic: true, pgMajor: 17 })]
    );
    const withMarker = await fingerprint(original);
    assert.equal(withMarker.marker.length, 1);
    assert.equal(withMarker.marker[0].enabled, false);
    console.log(JSON.stringify({ phase, architecture: process.arch, postgresMajor: 17,
      migrationCount: expected.length, tableCount: withMarker.tables.length,
      syntheticRollback: "PASS", markerInserted: true }));
  } else {
    const clone = await connect("quddam_arm64_ci_restore");
    try {
      const restored = await fingerprint(clone);
      const current = await fingerprint(original);
      assert.deepEqual(restored, current, "Restore must reproduce schema, migration metadata and synthetic marker");
      assert.equal(restored.marker.length, 1, "Synthetic marker must survive backup/restore");
      assert.equal(restored.marker[0].enabled, false);
      console.log(JSON.stringify({ phase, architecture: process.arch, postgresMajor: 17,
        migrationCount: expected.length, tableCount: restored.tables.length, isolatedCloneRestore: "PASS" }));
    } finally { await clone.end(); }
  }
} finally { await original.end(); }
