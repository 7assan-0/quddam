import { afterEach, describe, expect, it } from "vitest";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openNativePostgresFixture, validateDatabaseIdentity, validateFixture, validateMigrationRows, validateRetainedMarker } from "./e2e-native-postgres.mjs";

const fixture = {
  formatVersion: 1, synthetic: true, purpose: "quddam-pr17-category-board", fixtureId: "a".repeat(48),
  databaseUrl: "postgresql://quddam_pr17_test:test-only-password@127.0.0.1:56547/quddam_pr17_test?sslmode=disable",
  expectedDatabase: "quddam_pr17_test", expectedUser: "quddam_pr17_test", expectedSystemIdentifier: "123456789", expectedPort: 56547,
};
const inventory = [{ name: "20261016000000_test", hash: "a".repeat(64) }];
const identity = { database: fixture.expectedDatabase, user: fixture.expectedUser,
  systemIdentifier: fixture.expectedSystemIdentifier, serverPort: 5432, versionNumber: 170011 };
const marker = { fixture_id: fixture.fixtureId, purpose: fixture.purpose, state: "READY", migrations: inventory };
const directories = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

describe("native PostgreSQL 17 E2E fixture guard", () => {
  it("accepts only the explicit synthetic loopback fixture", () => {
    expect(validateFixture(fixture)).toBe(fixture);
  });
  it.each([null, [], {}, { ...fixture, synthetic: false }, { ...fixture, expectedDatabase: "production" }])(
    "rejects absent or unsupported fixture metadata %#", value => {
      expect(() => validateFixture(value)).toThrow("invalid synthetic fixture metadata");
    });
  it.each([
    "postgresql://quddam_pr17_test:test-only-password@db.example.test:56547/quddam_pr17_test?sslmode=disable",
    fixture.databaseUrl.replace("127.0.0.1", "localhost"),
    fixture.databaseUrl.replace(":56547/", ":5432/"),
    fixture.databaseUrl.replace("/quddam_pr17_test?", "/existing_db?"),
    fixture.databaseUrl.replace("sslmode=disable", "sslmode=disable&options=-csearch_path=other"),
  ])("rejects remote, mismatched, or additional URL routing %#", databaseUrl => {
    expect(() => validateFixture({ ...fixture, databaseUrl })).toThrow("loopback identity");
  });
  it("checks native PostgreSQL major and immutable server identity", () => {
    expect(() => validateDatabaseIdentity(fixture, identity)).not.toThrow();
    for (const change of [{ versionNumber: 160015 }, { systemIdentifier: "999" }, { database: "existing" }, { user: "other" }, { serverPort: 6432 }])
      expect(() => validateDatabaseIdentity(fixture, { ...identity, ...change })).toThrow("server identity");
  });
  it("requires a completed retained marker and preserves JSONB key-order independence", () => {
    expect(() => validateRetainedMarker(fixture, inventory, [{ ...marker, migrations: [{ hash: inventory[0].hash, name: inventory[0].name }] }])).not.toThrow();
    for (const markers of [[], [marker, marker], [{ ...marker, state: "INITIALIZING" }], [{ ...marker, fixture_id: "other" }], [{ ...marker, migrations: [] }]])
      expect(() => validateRetainedMarker(fixture, inventory, markers)).toThrow("retained synthetic marker");
  });
  it("rejects missing, changed, repeated, rolled-back, and unfinished migrations", () => {
    const row = { migration_name: inventory[0].name, checksum: inventory[0].hash, finished_at: new Date(), rolled_back_at: null };
    expect(() => validateMigrationRows(inventory, [row])).not.toThrow();
    for (const rows of [[], [row, row], [{ ...row, checksum: "changed" }], [{ ...row, finished_at: null }], [{ ...row, rolled_back_at: new Date() }]])
      expect(() => validateMigrationRows(inventory, rows)).toThrow("migration");
  });
  it("rejects a private fixture inside the checkout before connecting", async () => {
    await expect(openNativePostgresFixture(join(process.cwd(), "fixture.private.json"))).rejects.toThrow("outside the checkout");
  });
  it("rejects a readable-by-others fixture before connecting", async () => {
    const directory = await mkdtemp(join(tmpdir(), "quddam-pr17-guard-test-")); directories.push(directory);
    await chmod(directory, 0o700);
    const path = join(directory, "fixture.private.json");
    await writeFile(path, JSON.stringify(fixture), { mode: 0o644 });
    await chmod(path, 0o644);
    await expect(openNativePostgresFixture(path)).rejects.toThrow("owned 0600 file");
  });
  it("reports malformed JSON without disclosing private input", async () => {
    const directory = await mkdtemp(join(tmpdir(), "quddam-pr17-guard-test-")); directories.push(directory);
    await chmod(directory, 0o700);
    const path = join(directory, "fixture.private.json");
    await writeFile(path, "private-value-that-must-not-be-echoed", { mode: 0o600 });
    await expect(openNativePostgresFixture(path)).rejects.toThrow(/^Native PostgreSQL test fixture rejected: malformed private fixture$/);
  });
});
