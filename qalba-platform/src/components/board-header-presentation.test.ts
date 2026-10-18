import { describe, expect, it } from "vitest";
import { boardHeaderPresentation } from "./board-header-presentation";

const teams = [
  { id: "a", name: "فريق البرق", score: 0, color: "#4CC9B0" },
  { id: "b", name: "فريق الموج", score: 0, color: "#E57A93" },
];
const cells = Array.from({ length: 36 }, (_, index) => ({ completed: index < 4 }));
const base = { status: "IN_PROGRESS", round: 2, turnTeamId: "a", active: null, teams, cells };

describe("Board's live heading is derived from the authoritative session", () => {
  it("shows preparation and never invents a leader from an opening zero-zero tie", () => {
    const header = boardHeaderPresentation({ ...base, status: "LOBBY", round: 0, cells: cells.map(() => ({ completed: false })) });
    expect(header.roundLabel).toBe("قبل الجولة الأولى");
    expect(header.phaseLabel).toBe("بانتظار بداية المباراة");
    expect(header.isTie).toBe(true);
    expect(header.leadingScore).toBe(0);
    expect(header.completed).toBe(0);
    expect(header.total).toBe(36);
  });
  it("uses the real choosing team and correct leader after a completed cell", () => {
    const result = boardHeaderPresentation({ ...base, teams: [{ ...teams[0], score: 400 }, { ...teams[1], score: 200 }], turnTeamId: "b" });
    expect(result.phaseLabel).toContain("فريق الموج");
    expect(result.leaderLabel).toBe("فريق البرق");
    expect(result.leadingScore).toBe(400);
    expect(result.isTie).toBe(false);
    expect(result.completed).toBe(4);
    expect(result.progressPercent).toBe(11);
  });
  it("reflects stealing, challenges, pause, an earned tie and a finished game", () => {
    const steal = boardHeaderPresentation({ ...base, active: { phase: "STEAL", answeringTeamId: "b" } });
    expect(steal.phaseLabel).toContain("فرصة السرقة · فريق الموج");
    expect(boardHeaderPresentation({ ...base, active: { phase: "CHALLENGE", answeringTeamId: "b" } }).phaseLabel).toBe("اعتراض على الحكم");
    expect(boardHeaderPresentation({ ...base, status: "PAUSED" }).phaseLabel).toBe("المباراة متوقفة مؤقتًا");
    const tied = boardHeaderPresentation({ ...base, teams: teams.map(team => ({ ...team, score: 600 })) });
    expect(tied.leaderLabel).toContain("فريق البرق");
    expect(tied.leaderLabel).toContain("فريق الموج");
    expect(tied.isTie).toBe(true);
    const completed = boardHeaderPresentation({ ...base, status: "COMPLETED", cells: cells.map(() => ({ completed: true })) });
    expect(completed.roundLabel).toBe("النتيجة النهائية");
    expect(completed.phaseLabel).toBe("انتهت المباراة");
    expect(completed.progressPercent).toBe(100);
  });
});
