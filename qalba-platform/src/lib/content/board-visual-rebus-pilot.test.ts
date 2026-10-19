import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  rebusPilotArtworkRoot,
  rebusPilotProvenance,
  visualRebusPilot,
} from "../../../prisma/board-expansion/visual-rebus-pilot";

describe("isolated original visual rebus pilot", () => {
  it("contains eight distinct review-only candidates with all human gates pending", () => {
    expect(visualRebusPilot).toHaveLength(8);
    expect(new Set(visualRebusPilot.map((item) => item.id)).size).toBe(8);
    expect(new Set(visualRebusPilot.map((item) => item.answer)).size).toBe(8);
    expect(rebusPilotProvenance.publicActivation).toBe(false);
    expect(rebusPilotProvenance.externalAssets).toBe(0);
    for (const item of visualRebusPilot) {
      expect(item.categorySlug).toBe("guess-picture");
      expect(item.alternatives).toEqual([]);
      expect(item.review).toEqual({
        factual: "PENDING", alternatives: "PENDING", ambiguity: "PENDING",
        visualApproval: "PENDING", rightsApproval: "PENDING",
        humanPlaytest: "NOT_RUN", difficultyCalibration: "NOT_RUN",
      });
      expect(item.pieces.filter((piece) => piece.kind === "picture").length).toBeGreaterThanOrEqual(2);
    }
  });

  it("derives every answer exactly from visible operations, allowing spaces only", () => {
    for (const item of visualRebusPilot) {
      for (const piece of item.pieces) {
        if (piece.kind === "text") {
          expect(piece.text.replace(/ـ/g, "")).toBe(piece.fragment);
        } else if (piece.deleteFinal) {
          expect(piece.reviewerReading.endsWith(piece.deleteFinal)).toBe(true);
          expect(piece.reviewerReading.slice(0, -piece.deleteFinal.length)).toBe(piece.fragment);
        } else {
          expect(piece.reviewerReading).toBe(piece.fragment);
        }
      }
      expect(item.pieces.map((piece) => piece.fragment).join("")).toBe(item.answer.replace(/ /g, ""));
    }
    expect(visualRebusPilot[0].pieces[0]).toMatchObject({ reviewerReading: "ضب", deleteFinal: "ب" });
  });

  it("uses all sixteen local original SVG drawings without external assets", () => {
    const artwork = visualRebusPilot.flatMap((item) => item.pieces.flatMap((piece) => piece.kind === "picture" ? [piece.artwork] : []));
    expect(new Set(artwork).size).toBe(16);
    expect(readdirSync(resolve(rebusPilotArtworkRoot)).sort()).toEqual([...artwork].sort());
    for (const file of artwork) {
      const svg = readFileSync(resolve(rebusPilotArtworkRoot, file), "utf8");
      expect(svg).toContain('viewBox="0 0 240 180"');
      expect(svg).not.toMatch(/<(?:script|image|foreignObject)\b|(?:href|src)=|<title\b/i);
    }
  });

  it("keeps the standalone preview synchronized with the manifest and play answers hidden", () => {
    const html = readFileSync(resolve("docs/evidence/rebus-pilot-20261020/index.html"), "utf8");
    const payload = html.match(/<script id="rebus-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
    expect(payload).toBeDefined();
    expect(JSON.parse(payload!)).toEqual(visualRebusPilot);
    expect(html).toContain('lang="ar" dir="rtl"');
    expect(html).toContain('min-height:44px');
    expect(html).toContain("answer.hidden=true");
    expect(html).toContain("review.hidden=true");
    expect(html).toContain("img.alt='الرسم '");
    expect(html).not.toMatch(/<img[^>]+alt="(?:ضباب|بطيخ|قرنفل|كرة طائرة|بيت شعر|رأس مال|عين شمس|قنديل البحر)"/);
  });

  it("records zero human attempts and no reviewer signatures in every ledger row", () => {
    const csv = readFileSync(resolve("content-review/2026-10-20/Board_Rebus_Pilot_Review.csv"), "utf8").replace(/^\ufeff/, "");
    const records = csv.trim().split(/\r?\n/).map(line => (line.match(/"(?:[^"]|"")*"/g) ?? []).map(cell => cell.slice(1, -1).replace(/""/g, '"')));
    expect(records).toHaveLength(9);
    const [headers, ...rows] = records;
    for (const [index, row] of rows.entries()) {
      const entry = Object.fromEntries(headers.map((header, column) => [header, row[column]]));
      expect(entry.item_id).toBe(visualRebusPilot[index].id);
      expect(entry.proposed_answer).toBe(visualRebusPilot[index].answer);
      expect(entry.human_attempt_count).toBe("0");
      expect(entry.human_playtest_status).toBe("NOT_RUN");
      expect(entry.difficulty_calibration_status).toBe("NOT_RUN");
      expect(entry.reviewer).toBe("");
      expect(entry.reviewed_at).toBe("");
      expect(entry.accepted_alternatives).toBe("");
      for (const gate of ["factual_review_status", "alternatives_review_status", "ambiguity_review_status", "visual_approval_status", "rights_approval_status"]) expect(entry[gate]).toBe("PENDING");
    }
  });
});
