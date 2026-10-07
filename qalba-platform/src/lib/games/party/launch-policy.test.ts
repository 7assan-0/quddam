import { beforeEach, describe, expect, it, vi } from "vitest";
import { partySlugs, type PartyState } from "./types";
const m = vi.hoisted(() => ({ find: vi.fn(), db: vi.fn(), debit: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: m.db }));
vi.mock("@/lib/billing/credits", () => ({ consumeGameCredit: m.debit }));
import { createPartySession, getPartySession } from "./service";

function existing(slug: typeof partySlugs[number]) {
  const state: PartyState = { schemaVersion: 1, slug, cards: [{ id: "old-question", question: "سؤال محفوظ", answer: "جواب محفوظ", alternativeAnswers: ["مرادف"], type: "TEXT", options: null, pointValue: 100 }],
    index: 0, phase: "DONE", revealed: true, teamIds: ["a", "b"], playerIds: [], timerSeconds: 30, deadlineAt: null, remainingMs: 0,
    turn: 0, owners: [], selected: null, found: [], strikes: 0, fakes: {}, votes: {}, clues: [], winnerId: "a", lastCapture: null };
  return { id: "old-session", hostId: "host", gameType: { slug, title: "عنوان تاريخي", enabled: false }, state, status: "COMPLETED", stateVersion: 8,
    teams: [{ id: "a", name: "ألف", color: "coral", score: 300 }, { id: "b", name: "باء", color: "turquoise", score: 100 }], players: [], createdAt: new Date(0), endedAt: new Date(1) };
}
describe("service-level legacy creation isolation and existing reads", () => {
  beforeEach(() => { vi.clearAllMocks(); m.db.mockImplementation(() => { throw new Error("Unexpected database access"); }); });
  it.each(partySlugs)("rejects direct %s creation before database, receipt or debit access", async slug => {
    await expect(createPartySession("host", slug, { teamNames: ["ألف", "باء"], playerNames: ["زيد", "عمر", "هند"], timerSeconds: 30 })).rejects.toMatchObject({ status: 404 });
    expect(m.db).not.toHaveBeenCalled(); expect(m.debit).not.toHaveBeenCalled();
  });
  it.each(partySlugs)("keeps disabled historical %s readable with scores and snapshots intact", async slug => {
    const row = existing(slug), before = structuredClone(row);
    m.db.mockReturnValue({ gameSession: { findUnique: m.find } }); m.find.mockResolvedValue(row);
    const view = await getPartySession("host", row.id);
    expect(view).toMatchObject({ id: row.id, slug, status: "COMPLETED", version: 8, teams: [{ score: 300 }, { score: 100 }] });
    expect(view.state.cards[0].answer).toBe("جواب محفوظ"); expect(row).toEqual(before); expect(m.debit).not.toHaveBeenCalled();
  });
  it.each(["bluff", "top-list", "secret-word", "survey-show"] as const)("cannot read a dedicated %s session as a legacy variant", async slug => {
    const row = { ...existing(slug), state: { schemaVersion: 1, module: "DEDICATED", phase: "FINAL_RESULTS" } };
    m.db.mockReturnValue({ gameSession: { findUnique: m.find } }); m.find.mockResolvedValue(row);
    await expect(getPartySession("host", row.id)).rejects.toMatchObject({ status: 404 });
  });
  it("retains ownership checks for existing legacy results", async () => {
    m.db.mockReturnValue({ gameSession: { findUnique: m.find } }); m.find.mockResolvedValue(existing("party-court"));
    await expect(getPartySession("another-host", "old-session")).rejects.toMatchObject({ status: 403 });
  });
});
