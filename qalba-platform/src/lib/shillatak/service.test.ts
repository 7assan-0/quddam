import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ database: vi.fn(), tx: {
  $queryRawUnsafe: vi.fn(), shilla: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn() },
  shillaInvite: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  shillaMembership: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  shillaNight: { findUnique: vi.fn(), create: vi.fn() },
} }));
vi.mock("@/lib/db", () => ({ db: mocks.database }));
import { acceptShillaInvite, archiveShilla, attachShillaNight, createShilla,
  createShillaInvite, getShillaView, leaveShilla, listMyShillas,
  previewShillaInvite, revokeShillaInvite } from "./service";

const groupId = "00000000-0000-4000-8000-000000000001";
const inviteId = "00000000-0000-4000-8000-000000000002";
const nightId = "00000000-0000-4000-8000-000000000003";
const token = "a".repeat(64);
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true"); vi.stubEnv("ENABLE_SHILLATAK", "true");
  mocks.database.mockReturnValue({ ...mocks.tx, $transaction: async (run: (tx: typeof mocks.tx) => unknown) => run(mocks.tx) });
  mocks.tx.shilla.findUnique.mockResolvedValue({ id: groupId, ownerId: "owner", status: "active", _count: { members: 1 } });
  mocks.tx.shillaInvite.count.mockResolvedValue(0);
  mocks.tx.shillaInvite.create.mockResolvedValue({});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("Shillatak service authorization and locked invitation clock", () => {
  it("guards every service before DB access when either feature is disabled", async () => {
    for (const [night, shilla] of [["false", "true"], ["true", "false"]]) {
      vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", night); vi.stubEnv("ENABLE_SHILLATAK", shilla);
      const operations = [() => listMyShillas("owner"), () => getShillaView("owner", groupId),
        () => createShilla("owner", { name: "جمعتنا", teams: ["البرق", "الموج"] }),
        () => createShillaInvite("owner", groupId), () => previewShillaInvite("owner", token),
        () => acceptShillaInvite("owner", token), () => revokeShillaInvite("owner", groupId, inviteId),
        () => attachShillaNight("owner", groupId, nightId), () => archiveShilla("owner", groupId),
        () => leaveShilla("owner", groupId)];
      for (const run of operations) await expect(run()).rejects.toMatchObject({ status: 404, code: "FEATURE_DISABLED" });
    }
    expect(mocks.database).not.toHaveBeenCalled();
  });
  it("starts a new invite's full seven days and active-limit check after acquiring the group lock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    const afterLock = new Date("2030-01-01T00:00:02.000Z");
    mocks.tx.$queryRawUnsafe.mockImplementationOnce(async () => { vi.setSystemTime(afterLock); return []; });
    const invite = await createShillaInvite("owner", groupId);
    expect(mocks.tx.shillaInvite.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ expiresAt: { gt: afterLock } }),
    }));
    expect(invite.expiresAt).toBe("2030-01-08T00:00:02.000Z");
    expect(mocks.tx.shillaInvite.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ expiresAt: new Date(invite.expiresAt) }),
    }));
  });
  it("does not count links that expired while invite creation waited for the lock", async () => {
    vi.useFakeTimers();
    const started = new Date("2030-01-01T00:00:00.000Z"); vi.setSystemTime(started);
    const oldExpiry = new Date(started.getTime() + 1_000);
    mocks.tx.$queryRawUnsafe.mockImplementationOnce(async () => { vi.setSystemTime(started.getTime() + 2_000); return []; });
    mocks.tx.shillaInvite.count.mockImplementation(async ({ where }: { where: { expiresAt: { gt: Date } } }) =>
      oldExpiry > where.expiresAt.gt ? 5 : 0);
    await expect(createShillaInvite("owner", groupId)).resolves.toMatchObject({ expiresAt: "2030-01-08T00:00:02.000Z" });
    expect(mocks.tx.shillaInvite.create).toHaveBeenCalledTimes(1);
  });
  it("rejects owner-only mutations for a member before any write", async () => {
    for (const run of [() => createShillaInvite("member", groupId),
      () => revokeShillaInvite("member", groupId, inviteId),
      () => attachShillaNight("member", groupId, nightId), () => archiveShilla("member", groupId)]) {
      await expect(run()).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    }
    expect(mocks.tx.shillaInvite.create).not.toHaveBeenCalled();
    expect(mocks.tx.shillaInvite.update).not.toHaveBeenCalled();
    expect(mocks.tx.shillaNight.create).not.toHaveBeenCalled();
  });
  it("rejects archived and full groups before issuing another capability", async () => {
    mocks.tx.shilla.findUnique.mockResolvedValueOnce({ id: groupId, ownerId: "owner", status: "archived", _count: { members: 1 } });
    await expect(createShillaInvite("owner", groupId)).rejects.toMatchObject({ code: "ARCHIVED" });
    mocks.tx.shilla.findUnique.mockResolvedValueOnce({ id: groupId, ownerId: "owner", status: "active", _count: { members: 20 } });
    await expect(createShillaInvite("owner", groupId)).rejects.toMatchObject({ code: "FULL" });
    expect(mocks.tx.shillaInvite.create).not.toHaveBeenCalled();
  });
  it("rechecks expiry after acquiring the group lock and never consumes an expired token", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    mocks.tx.shillaInvite.findUnique.mockResolvedValueOnce({ id: inviteId, shillaId: groupId })
      .mockResolvedValueOnce({ id: inviteId, shillaId: groupId, consumedAt: null, revokedAt: null,
        expiresAt: new Date("2030-01-01T00:00:01.000Z") });
    mocks.tx.$queryRawUnsafe.mockImplementationOnce(async () => { vi.setSystemTime(new Date("2030-01-01T00:00:02.000Z")); return []; });
    await expect(acceptShillaInvite("member", token)).rejects.toMatchObject({ code: "INVITE_CLOSED" });
    expect(mocks.tx.shillaMembership.create).not.toHaveBeenCalled();
    expect(mocks.tx.shillaInvite.update).not.toHaveBeenCalled();
  });
  it.each(["revoked", "consumed", "expired", "archived"])(
    "does not disclose a private group name to a nonmember holding a %s invite", async closed => {
      mocks.tx.shillaInvite.findUnique.mockResolvedValueOnce({
        consumedAt: closed === "consumed" ? new Date() : null,
        revokedAt: closed === "revoked" ? new Date() : null,
        expiresAt: new Date(Date.now() + (closed === "expired" ? -1_000 : 60_000)),
        shilla: { name: "مجموعة خاصة", status: closed === "archived" ? "archived" : "active",
          _count: { members: 2 }, members: [] },
      });
      await expect(previewShillaInvite("outsider", token)).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    });
  it("allows an existing member to recognize their group from a consumed invite without reusing it", async () => {
    mocks.tx.shillaInvite.findUnique.mockResolvedValueOnce({ shillaId: groupId, consumedAt: new Date(), revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000), shilla: { name: "مجموعة خاصة", status: "active",
        _count: { members: 2 }, members: [{ id: "membership" }] } });
    await expect(previewShillaInvite("member", token)).resolves.toEqual({ name: "مجموعة خاصة", open: false, alreadyMember: true, shillaId: groupId });
  });
  it("does not silently remove the owner or create a membership for an existing member", async () => {
    await expect(leaveShilla("owner", groupId)).rejects.toMatchObject({ code: "OWNER_CANNOT_LEAVE" });
    mocks.tx.shillaInvite.findUnique.mockResolvedValueOnce({ id: inviteId, shillaId: groupId })
      .mockResolvedValueOnce({ id: inviteId, shillaId: groupId, consumedAt: null, revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000) });
    mocks.tx.shillaMembership.findUnique.mockResolvedValueOnce({ id: "existing-member" });
    await expect(acceptShillaInvite("member", token)).rejects.toMatchObject({ code: "ALREADY_MEMBER" });
    expect(mocks.tx.shillaMembership.create).not.toHaveBeenCalled();
    expect(mocks.tx.shillaMembership.delete).not.toHaveBeenCalled();
  });
});
