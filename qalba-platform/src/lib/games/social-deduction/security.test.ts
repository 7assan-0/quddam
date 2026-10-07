import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { tokenHash } from "@/lib/auth/crypto";
import { initialState, type SocialState } from "./module";
const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/billing/credits", () => ({ consumeGameCredit: vi.fn() }));
vi.mock("@/lib/analytics/events", () => ({ recordEvent: vi.fn() }));
import { applySocialCommand, getSocialView, type SocialAction } from "./service";
const token = "a".repeat(43), other = "b".repeat(43);
let now: number;
let session: ReturnType<typeof fixture>;
let tx: ReturnType<typeof client>;
function fixture() {
  return { id: "game", hostId: "host", gameType: { slug: "out-of-the-loop" }, stateVersion: 7,
    state: { ...initialState(30), phase: "DISCUSSION", deadlineAt: new Date(now + 30000).toISOString() } as SocialState,
    room: { sessionId: "game", code: "ABCDEF", expiresAt: new Date(now + 10000) },
    socialParticipants: [token, other].map((t, i) => ({ id: "p" + i, sessionId: "game", position: i, name: "لاعب " + i, tokenHash: tokenHash(t) })),
    socialRounds: [{ id: "round", outsiderId: "p0", wordSnapshot: "الكلمة الأصلية", alternativesSnapshot: ["البديل الأصلي"], guess: null, votes: [] }],
    displayAccesses: [], currentRoundNumber: 1, status: "IN_PROGRESS" };
}
function client() {
  return { $queryRaw: vi.fn(), gameSession: { findUnique: vi.fn(async () => session), updateMany: vi.fn(async () => ({ count: 1 })) },
    gameCommand: { findUnique: vi.fn(async () => null), create: vi.fn() },
    socialRound: { update: vi.fn() }, socialVote: { upsert: vi.fn(), findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    secretWord: { findUnique: vi.fn(), findMany: vi.fn() } };
}
beforeEach(() => { now = Date.now(); vi.spyOn(Date, "now").mockImplementation(() => now); session = fixture(); tx = client(); mocks.db.mockReturnValue({ ...tx, $transaction: async (fn: (c: typeof tx) => unknown) => fn(tx) }); });
afterEach(() => vi.restoreAllMocks());
function send(action: SocialAction, value = token) { return applySocialCommand("game", { kind: "PLAYER", token: value }, "key", 7, action); }
function noWrites() {
  expect(tx.gameCommand.findUnique).not.toHaveBeenCalled(); expect(tx.gameCommand.create).not.toHaveBeenCalled();
  expect(tx.gameSession.updateMany).not.toHaveBeenCalled(); expect(tx.socialVote.upsert).not.toHaveBeenCalled(); expect(tx.socialRound.update).not.toHaveBeenCalled();
}
for (const action of [{ type: "FINISH_TURN" }, { type: "SUBMIT_VOTE", roundId: "round", ballot: 1, targetId: "p1" }, { type: "SUBMIT_GUESS", guess: "الكلمة الأصلية" }] as SocialAction[]) {
  it(`expired ${action.type} fails before receipt or gameplay writes`, async () => {
    session.room.expiresAt = new Date(now - 1); const before = structuredClone(session);
    await expect(send(action)).rejects.toMatchObject({ status: 403, code: "PLAYER_ACCESS_DENIED" }); noWrites(); expect(session).toEqual(before);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2); // session lock, then room lock
  });
}
it("exact expiry boundary is invalid", async () => { session.room.expiresAt = new Date(now); await expect(send({ type: "FINISH_TURN" })).rejects.toMatchObject({ status: 403 }); noWrites(); });
it("format validation occurs while session locked", async () => { await expect(send({ type: "FINISH_TURN" }, "malformed")).rejects.toMatchObject({ status: 403 }); expect(tx.$queryRaw).toHaveBeenCalledTimes(1); noWrites(); });
it("removed token remains invalid", async () => { session.socialParticipants.shift(); await expect(send({ type: "FINISH_TURN" })).rejects.toMatchObject({ status: 403 }); noWrites(); });
it("different-session token cannot authorize", async () => { session.socialParticipants[0].sessionId = "other"; await expect(send({ type: "FINISH_TURN" })).rejects.toMatchObject({ status: 403 }); noWrites(); });
it("mismatched room cannot authorize", async () => { session.room.sessionId = "other"; await expect(send({ type: "FINISH_TURN" })).rejects.toMatchObject({ status: 403 }); noWrites(); });
it("duplicate expired keys never reach receipt lookup", async () => { session.room.expiresAt = new Date(now - 1); for (let i = 0; i < 2; i++) await expect(send({ type: "FINISH_TURN" })).rejects.toMatchObject({ status: 403 }); noWrites(); });
it("expiry is evaluated after waiting on locks", async () => { tx.$queryRaw.mockImplementation(async () => { now += 6000; }); await expect(send({ type: "FINISH_TURN" })).rejects.toMatchObject({ status: 403 }); noWrites(); });
it("valid player still finishes their turn", async () => { await send({ type: "FINISH_TURN" }); expect(tx.gameCommand.create).toHaveBeenCalledOnce(); expect(tx.gameSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: expect.objectContaining({ turnIndex: 1 }) }) })); });
it("reconnect and reveal use snapshot without bank read", async () => {
  session.socialRounds[0].outsiderId = "p1";
  expect((await getSocialView("game", { kind: "PLAYER", token })).self?.secretWord).toBe("الكلمة الأصلية");
  expect((await getSocialView("game", { kind: "PLAYER", token: other })).self?.secretWord).toBeNull();
  const host = await getSocialView("game", { kind: "HOST", id: "host" }); expect(host.self).toBeNull(); expect(host.reveal).toBeNull(); expect(JSON.stringify(host)).not.toContain("الكلمة الأصلية");
  session.state.phase = "RESULTS";
  expect((await getSocialView("game", { kind: "HOST", id: "host" })).reveal?.secretWord).toBe("الكلمة الأصلية");
  expect(tx.secretWord.findUnique).not.toHaveBeenCalled(); expect(tx.secretWord.findMany).not.toHaveBeenCalled();
});
for (const [guess, winner] of [["البديل الأصلي", "OUTSIDER"], ["بديل جديد", "PLAYERS"]]) {
  it(`guess ${guess} is judged solely from snapshot`, async () => {
    session.state.phase = "OUTSIDER_GUESS"; await send({ type: "SUBMIT_GUESS", guess });
    expect(tx.gameSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: expect.objectContaining({ winner }) }) }));
    expect(tx.secretWord.findUnique).not.toHaveBeenCalled();
  });
}
