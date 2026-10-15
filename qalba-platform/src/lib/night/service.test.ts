import { afterEach, describe, expect, it, vi } from "vitest";
const database = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: database }));
import { applyNightCommand, createNightSession, findNightForSource, getNightView } from "./service";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("Night is disabled by default at the service boundary", () => {
  it.each([undefined, "false", "TRUE", "1"])("rejects all writes/reads before database access for flag %s", async flag => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", flag);
    await expect(createNightSession("owner", { key: "ce1c4819-b9b1-43c9-bc5a-788d9f6b08e8", teams: ["الأول", "الثاني"], games: ["top-list", "ordering-challenge", "survey-show"] })).rejects.toMatchObject({ status: 404, code: "FEATURE_DISABLED" });
    await expect(getNightView("owner", "night-1")).rejects.toMatchObject({ status: 404, code: "FEATURE_DISABLED" });
    await expect(applyNightCommand("owner", "night-1", { key: "ce1c4819-b9b1-43c9-bc5a-788d9f6b08e8", expectedVersion: 0, op: "START" })).rejects.toMatchObject({ status: 404, code: "FEATURE_DISABLED" });
    expect(await findNightForSource("owner", "top-list", "source-1")).toBeNull();
    expect(database).not.toHaveBeenCalled();
  });
  it("rejects caller-provided results, identities and points even at the internal service boundary", async () => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true");
    const valid = { key: "ce1c4819-b9b1-43c9-bc5a-788d9f6b08e8", games: ["top-list", "ordering-challenge", "survey-show"], teams: ["الأول", "الثاني"] };
    for (const extra of [{ totals: { forged: 999 } }, { results: [] }, { ownerId: "other" }, { sourceSessionId: "external" }]) {
      await expect(createNightSession("owner", { ...valid, ...extra } as unknown as Parameters<typeof createNightSession>[1])).rejects.toMatchObject({ status: 400, code: "INVALID_INPUT" });
      await expect(applyNightCommand("owner", "night-1", { key: valid.key, expectedVersion: 0, op: "IMPORT", ...extra })).rejects.toMatchObject({ status: 400, code: "INVALID_INPUT" });
    }
    expect(database).not.toHaveBeenCalled();
  });
  it("bounds MVP to the verified three distinct games and exactly two stable teams", async () => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true");
    const valid = { key: "ce1c4819-b9b1-43c9-bc5a-788d9f6b08e8", games: ["top-list", "ordering-challenge", "survey-show"], teams: ["الأول", "الثاني"] };
    for (const changed of [{ games: ["top-list", "top-list", "survey-show"] }, { games: ["lightning-quiz", "ordering-challenge", "survey-show"] }, { teams: ["واحد", "اثنان", "ثلاثة"] }, { teams: ["نفس", "نفس"] }, { teams: ["bad\nname", "team"] }]) {
      await expect(createNightSession("owner", { ...valid, ...changed } as Parameters<typeof createNightSession>[1])).rejects.toMatchObject({ status: 400 });
    }
    expect(database).not.toHaveBeenCalled();
  });
});
