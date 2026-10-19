import { describe, expect, it } from "vitest";
import { loadInventory, screenInventory, pilotAssignments, blindPack, analyzeResponses, parseCsv, csv, hashReviewItem } from "../../../scripts/lib/board-content-review";

const inventory = loadInventory();
describe("All-bank review tooling preserves source identity and human approval boundaries", () => {
  it("binds every baseline and draft row to current source without approving it", () => {
    expect(inventory).toHaveLength(2112);
    expect(new Set(inventory.map(i => i.id)).size).toBe(2112);
    expect(new Set(inventory.map(i => i.category)).size).toBe(22);
    expect(inventory.every(i => i.factualReview === "PENDING_INDEPENDENT_FACTCHECK")).toBe(true);
    expect(inventory.every(i => i.editorialReview === "PENDING_INDEPENDENT_ITEM_REVIEW")).toBe(true);
    const report = screenInventory(inventory);
    expect(report.summary.humanApprovalsGrantedByTool).toBe(0);
    expect(report.summary.exactDuplicateFlags).toBe(0);
    expect(report.summary.missingFullBankItems).toBe(480);
  });
  it("treats semantic-similarity candidates as review flags and does not reject legitimate repeated answers", () => {
    const samples = [
      { ...inventory[0], id: "one", question: "ما عاصمة دولة فرنسا الحالية؟", answer: "باريس" },
      { ...inventory[0], id: "two", question: "ما عاصمة دولة فرنسا الأوروبية؟", answer: "باريس" },
    ];
    const report = screenInventory(samples);
    expect(report.flags.some(f => f.kind === "POSSIBLE_SAME_FACT" && f.related === "two")).toBe(true);
    expect(report.summary.verdict).toBe("REVIEW_REQUIRED_NO_ACTIVATION");
    expect(report.summary.humanApprovalsGrantedByTool).toBe(0);
  });
  it("invalidates existing pilot evidence when authored content or review context changes", () => {
    const item = inventory[0];
    const assignment = pilotAssignments([item])[0];
    const blank = { participant_id: assignment.participant_id, session: assignment.session,
      blind_id: assignment.blind_id, content_hash: assignment.content_hash,
      correct: "", seconds_elapsed: "", judge_flag: "" };
    expect(hashReviewItem(item)).toBe(item.contentHash);
    expect(analyzeResponses([item], [blank]).status).toBe("NOT_RUN");
    for (const field of ["id", "category", "tier", "question", "answer", "source", "proposedVariants",
      "notes", "factualReview", "editorialReview", "difficultyPilot"] as const) {
      const changed = { ...item, [field]: `${item[field]} revised` };
      changed.contentHash = hashReviewItem(changed);
      expect(changed.contentHash, field).not.toBe(item.contentHash);
      expect(() => analyzeResponses([changed], [blank]), field).toThrow(/Unknown or stale|Source changed/);
    }
  });
  it("assigns six distinct anonymous attempts per question across two groups without exposing tier or answer in player packs", () => {
    const assignments = pilotAssignments(inventory);
    expect(assignments).toHaveLength(12672);
    const sample = assignments.filter(a => a.item_id === inventory[100].id);
    expect(new Set(sample.map(a => a.participant_id)).size).toBe(6);
    expect(sample.filter(a => a.group === "A")).toHaveLength(3);
    expect(sample.filter(a => a.group === "B")).toHaveLength(3);
    const player = blindPack(inventory, "P01", "1");
    expect(player.questions).toHaveLength(24);
    for (const q of player.questions) {
      expect(Object.keys(q).sort()).toEqual(["blind_id", "question"]);
      expect(q.blind_id).toMatch(/^[a-f0-9]{16}$/);
    }
    expect(assignments.filter(a => a.participant_id === "P01")).toHaveLength(1056);
    expect(new Set(assignments.filter(a => a.participant_id === "P01").map(a => a.session)).size).toBe(44);
  });
  it("reports a blank plan as NOT_RUN and rejects fabricated-roster duplicates and source drift", () => {
    const assigned = pilotAssignments(inventory)[0];
    const blank = { participant_id: assigned.participant_id, session: assigned.session, blind_id: assigned.blind_id,
      content_hash: assigned.content_hash, correct: "", seconds_elapsed: "", judge_flag: "" };
    expect(analyzeResponses(inventory, [blank])).toMatchObject({ status: "NOT_RUN", answered: 0, approval: "NEVER_AUTOMATIC" });
    expect(() => analyzeResponses(inventory, [blank, blank])).toThrow("Duplicate response");
    expect(() => analyzeResponses(inventory, [{ ...blank, content_hash: "stale" }])).toThrow("Source changed");
    expect(() => analyzeResponses(inventory, [{ ...blank, blind_id: "unknown" }])).toThrow("Unknown or stale");
    expect(() => analyzeResponses(inventory, [{ ...blank, correct: "1", seconds_elapsed: "0", judge_flag: "CLEAR" }])).toThrow("Time must");
    // Synthetic fixture exercises parser logic only; it is never stored as human evidence.
    expect(analyzeResponses(inventory, [{ ...blank, correct: "0", seconds_elapsed: "15", judge_flag: "DISPUTED" }]))
      .toMatchObject({ status: "INCOMPLETE_NO_APPROVAL", answered: 1, approval: "NEVER_AUTOMATIC" });
  });
  it("roundtrips quoted, multiline Arabic CSV and refuses malformed records", () => {
    const rows = [{ id: "أ", note: 'قال "نعم"،\nثم توقف' }];
    expect(parseCsv(csv(["id", "note"], rows))).toEqual(rows);
    expect(() => parseCsv('"a","b"\n"unterminated')).toThrow("Unclosed CSV quote");
    expect(() => parseCsv('"a","a"\n"x","y"')).toThrow("Duplicate CSV heading");
  });
});
