import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ user: vi.fn(), list: vi.fn(), create: vi.fn(), view: vi.fn(),
  invite: vi.fn(), attach: vi.fn(), archive: vi.fn(), leave: vi.fn(), revoke: vi.fn(), preview: vi.fn(), accept: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentUser: m.user }));
vi.mock("@/lib/shillatak/service", () => ({
  listMyShillas: m.list, createShilla: m.create, getShillaView: m.view, createShillaInvite: m.invite,
  attachShillaNight: m.attach, archiveShilla: m.archive, leaveShilla: m.leave, revokeShillaInvite: m.revoke,
  previewShillaInvite: m.preview, acceptShillaInvite: m.accept,
}));
import { GET as list, POST as create } from "./route";
import { GET as detail, POST as action } from "./[id]/route";
import { GET as preview, POST as accept } from "./join/[code]/route";
const id = "00000000-0000-4000-8000-000000000001", nightId = "00000000-0000-4000-8000-000000000002";
const code = "a".repeat(64);
const groupCtx = { params: Promise.resolve({ id }) }, inviteCtx = { params: Promise.resolve({ code }) };
const groupData = { name: "أصدقاؤنا", teams: ["البرق", "الموج"] };
function req(path: string, method = "GET", body?: unknown, origin = "http://localhost:3000") {
  return new NextRequest(`http://localhost:3000${path}`, {
    method, headers: { origin, host: "localhost:3000", "content-type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
  });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true"); vi.stubEnv("ENABLE_SHILLATAK", "true");
  vi.stubEnv("APP_URL", "http://localhost:3000");
  m.user.mockResolvedValue({ id: "owner" });
  m.list.mockResolvedValue([]); m.create.mockResolvedValue({ id }); m.view.mockResolvedValue({ id });
  m.invite.mockResolvedValue({ path: `/shillatak/join/${code}` }); m.attach.mockResolvedValue({ id });
  m.archive.mockResolvedValue({ id, status: "archived" }); m.leave.mockResolvedValue({ left: true });
  m.revoke.mockResolvedValue({ id, activeInvites: [] });
  m.preview.mockResolvedValue({ name: "أصدقاؤنا", open: true, alreadyMember: false });
  m.accept.mockResolvedValue({ shillaId: id });
});
afterEach(() => vi.unstubAllEnvs());
describe("Shillatak owner/member-only HTTP boundaries", () => {
  it("disables all endpoints unless both private flags are on before auth or body reads", async () => {
    for (const [nightFlag, shillaFlag] of [["false", "true"], ["true", "false"]]) {
      vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", nightFlag); vi.stubEnv("ENABLE_SHILLATAK", shillaFlag);
      for (const response of [await list(), await create(req("/api/shillatak", "POST", groupData)),
        await detail(req(`/api/shillatak/${id}`), groupCtx),
        await action(req(`/api/shillatak/${id}`, "POST", { op: "INVITE" }), groupCtx),
        await preview(req(`/api/shillatak/join/${code}`), inviteCtx),
        await accept(req(`/api/shillatak/join/${code}`, "POST"), inviteCtx)])
        expect(response.status).toBe(404);
      expect(m.user).not.toHaveBeenCalled();
    }
  });
  it("requires account for group listing, membership and private invite preview", async () => {
    m.user.mockResolvedValue(null);
    for (const response of [await list(), await create(req("/api/shillatak", "POST", groupData)),
      await detail(req(`/api/shillatak/${id}`), groupCtx),
      await preview(req(`/api/shillatak/join/${code}`), inviteCtx)])
      expect(response.status).toBe(401);
    expect(m.view).not.toHaveBeenCalled(); expect(m.preview).not.toHaveBeenCalled();
  });
  it("checks same-origin before group write and joining and rejects browser-supplied authority/points", async () => {
    expect((await create(req("/api/shillatak", "POST", groupData, "https://evil.invalid"))).status).toBe(403);
    expect((await action(req(`/api/shillatak/${id}`, "POST", { op: "INVITE" }, "https://evil.invalid"), groupCtx)).status).toBe(403);
    expect((await accept(req(`/api/shillatak/join/${code}`, "POST", {}, "https://evil.invalid"), inviteCtx)).status).toBe(403);
    expect((await create(req("/api/shillatak", "POST", { ...groupData, ownerId: "attacker" }))).status).toBe(400);
    expect((await action(req(`/api/shillatak/${id}`, "POST", { op: "ATTACH", nightId, points: 9000 }), groupCtx)).status).toBe(400);
    expect((await action(req(`/api/shillatak/${id}`, "POST", { op: "INVITE", host: true }), groupCtx)).status).toBe(400);
    expect(m.attach).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
  });
  it("always passes current authenticated user, never a browser-submitted account", async () => {
    expect((await create(req("/api/shillatak", "POST", groupData))).status).toBe(201);
    expect(m.create).toHaveBeenCalledWith("owner", groupData);
    expect((await detail(req(`/api/shillatak/${id}`), groupCtx)).status).toBe(200);
    expect(m.view).toHaveBeenCalledWith("owner", id);
    expect((await action(req(`/api/shillatak/${id}`, "POST", { op: "ATTACH", nightId }), groupCtx)).status).toBe(200);
    expect(m.attach).toHaveBeenCalledWith("owner", id, nightId);
    expect((await preview(req(`/api/shillatak/join/${code}`), inviteCtx)).status).toBe(200);
    expect((await accept(req(`/api/shillatak/join/${code}`, "POST"), inviteCtx)).status).toBe(200);
    expect(m.accept).toHaveBeenCalledWith("owner", code);
  });
  it("never caches membership data or invite URLs and does not echo DB errors", async () => {
    const invitation = await action(req(`/api/shillatak/${id}`, "POST", { op: "INVITE" }), groupCtx);
    expect(invitation.status).toBe(201); expect(invitation.headers.get("cache-control")).toBe("private, no-store");
    expect(invitation.headers.get("referrer-policy")).toBe("no-referrer");
    m.view.mockRejectedValueOnce(new Error("PRIVATE_DB_CONNECTION_STRING"));
    const bad = await detail(req(`/api/shillatak/${id}`), groupCtx);
    expect(bad.status).toBe(500); expect(await bad.text()).not.toContain("PRIVATE_DB_CONNECTION_STRING");
  });
  it("supports owner archive and member leave without exposing deletion of immutable history", async () => {
    expect((await action(req(`/api/shillatak/${id}`, "POST", { op: "ARCHIVE" }), groupCtx)).status).toBe(200);
    expect((await action(req(`/api/shillatak/${id}`, "POST", { op: "LEAVE" }), groupCtx)).status).toBe(200);
    expect(m.archive).toHaveBeenCalledWith("owner", id);
    expect(m.leave).toHaveBeenCalledWith("owner", id);
    const inviteId = "00000000-0000-4000-8000-000000000003";
    expect((await action(req(`/api/shillatak/${id}`, "POST", { op: "REVOKE", inviteId }), groupCtx)).status).toBe(200);
    expect(m.revoke).toHaveBeenCalledWith("owner", id, inviteId);
  });
});
