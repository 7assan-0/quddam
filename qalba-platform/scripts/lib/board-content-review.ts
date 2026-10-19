import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { boardSamples } from "../../prisma/core-content";
import { geographyCandidate } from "../../prisma/board-expansion/geography-candidate";
import { currenciesCandidate } from "../../prisma/board-expansion/currencies-candidate";
import { sportsCandidate } from "../../prisma/board-expansion/sports-candidate";
import { historyCandidate } from "../../prisma/board-expansion/history-candidate";
import { arabicCandidate } from "../../prisma/board-expansion/arabic-candidate";
import { cultureCandidate } from "../../prisma/board-expansion/culture-candidate";
import { foodCandidate } from "../../prisma/board-expansion/food-candidate";
import { placesCandidate } from "../../prisma/board-expansion/places-candidate";
import { animalsCandidate } from "../../prisma/board-expansion/animals-candidate";
import { moviesCandidate } from "../../prisma/board-expansion/movies-candidate";
import { seriesCandidate } from "../../prisma/board-expansion/series-candidate";
import { gamesCandidate } from "../../prisma/board-expansion/games-candidate";
import { carsCandidate } from "../../prisma/board-expansion/cars-candidate";
import { peopleCandidate } from "../../prisma/board-expansion/people-candidate";
import { riddlesCandidate } from "../../prisma/board-expansion/riddles-candidate";
import { whoAmICandidate } from "../../prisma/board-expansion/who-am-i-candidate";

export type ReviewItem = {
  id: string; category: string; tier: string; question: string; answer: string;
  contentHash: string; source: string; proposedVariants: string; notes: string;
  factualReview: string; editorialReview: string; difficultyPilot: string;
};
type Pack = Readonly<Record<"200" | "400" | "600", readonly (readonly [string, string])[]>>;
export type PilotAssignment = { participant_id: string; group: string; session: string; blind_id: string; item_id: string; content_hash: string };
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
/** Bind responses and proposed decisions to both the authored item and its review evidence. */
export function hashReviewItem(item: Omit<ReviewItem, "contentHash">): string {
  return digest(JSON.stringify([
    item.id, item.category, item.tier, item.question, item.answer,
    item.source, item.proposedVariants, item.notes,
    item.factualReview, item.editorialReview, item.difficultyPilot,
  ]));
}
export const normalize = (value: string) => value.normalize("NFKC")
  .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu, "")
  .replace(/[أإآٱ]/gu, "ا").replace(/ى/gu, "ي").replace(/[^\p{L}\p{N} ]/gu, " ")
  .replace(/\s+/gu, " ").trim().toLocaleLowerCase("ar");

export function parseCsv(text: string): Record<string, string>[] {
  const lines: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  const input = text.replace(/^\uFEFF/u, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') { if (quoted && input[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\r" || c === "\n") && !quoted) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(cell); if (row.some(Boolean)) lines.push(row); row = []; cell = "";
    } else cell += c;
  }
  assert.equal(quoted, false, "Unclosed CSV quote");
  if (cell || row.length) { row.push(cell); lines.push(row); }
  const header = lines.shift(); assert.ok(header?.length, "Missing CSV header");
  assert.equal(new Set(header).size, header.length, "Duplicate CSV heading");
  return lines.map((values, i) => {
    assert.equal(values.length, header.length, `CSV column mismatch at row ${i + 2}`);
    return Object.fromEntries(header.map((h, k) => [h, values[k]]));
  });
}
export function csv(header: readonly string[], rows: readonly Record<string, unknown>[]) {
  const line = (values: unknown[]) => values.map(x => '"' + String(x ?? "").replaceAll('"', '""') + '"').join(",");
  return [line([...header]), ...rows.map(row => line(header.map(h => row[h])))].join("\n") + "\n";
}

export function loadInventory(): ReviewItem[] {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const ledgers = [
    "2026-10-17/Board_576_Item_Review.csv", "2026-10-18/Board_Geography_96_Review.csv",
    "2026-10-18/Board_Currencies_96_Review.csv", "2026-10-18/Board_Knowledge_7x96_Review.csv",
    "2026-10-19/Board_Entertainment_7x96_Review.csv",
  ].flatMap(path => parseCsv(readFileSync(resolve(root, "content-review", path), "utf8")));
  const ledger = new Map(ledgers.map(r => [r.stable_id || r.draft_id, r]));
  assert.equal(ledgers.length, 2112); assert.equal(ledger.size, 2112, "Duplicate review ID");
  const authored = boardSamples.map((row, index) => ({ id: `seed-category-${index + 1}`,
    category: row[0], question: row[1], answer: row[2], tier: String(row[4]) }));
  const packs: Record<string, Pack> = {
    geography: geographyCandidate, currencies: currenciesCandidate, sports: sportsCandidate,
    history: historyCandidate, arabic: arabicCandidate, culture: cultureCandidate, food: foodCandidate,
    places: placesCandidate, animals: animalsCandidate, movies: moviesCandidate, series: seriesCandidate,
    games: gamesCandidate, cars: carsCandidate, people: peopleCandidate, riddles: riddlesCandidate,
    "who-am-i": whoAmICandidate,
  };
  for (const [category, pack] of Object.entries(packs)) for (const tier of ["200", "400", "600"] as const) {
    assert.equal(pack[tier].length, 32, `Wrong quota: ${category}/${tier}`);
    pack[tier].forEach(([question, answer], index) => {
      const ordinal = ["200", "400", "600"].indexOf(tier) * 32 + index + 1;
      const id = category === "geography" ? `geo-draft-${String(ordinal).padStart(3, "0")}`
        : category === "currencies" ? `currency-draft-${String(ordinal).padStart(3, "0")}`
        : `${category}-${tier}-${String(index + 1).padStart(3, "0")}`;
      authored.push({ id, category, tier, question, answer });
    });
  }
  assert.equal(authored.length, 2112);
  return authored.map(item => {
    const row = ledger.get(item.id); assert.ok(row, `Missing review row: ${item.id}`);
    assert.deepEqual([row.category_slug, row.point_value, row.question, row.answer],
      [item.category, item.tier, item.question, item.answer], `Stale ledger: ${item.id}`);
    const reviewItem = { ...item,
      source: row.source_reference_for_reviewer || row.verification_reference || "",
      proposedVariants: row.proposed_answer_variants_not_approved || "", notes: row.notes || row.review_reason || "",
      factualReview: row.factual_review, editorialReview: row.editorial_review || row.editorial_status,
      difficultyPilot: row.difficulty_pilot || row.difficulty_review,
    };
    return { ...reviewItem, contentHash: hashReviewItem(reviewItem) };
  });
}

export function screenInventory(items: readonly ReviewItem[]) {
  const flags: { id: string; kind: string; related: string; note: string }[] = [];
  const questionGroups = new Map<string, ReviewItem[]>(), answerGroups = new Map<string, ReviewItem[]>();
  for (const item of items) {
    const q = normalize(item.question), a = normalize(item.answer);
    const qs = questionGroups.get(q) || []; qs.push(item); questionGroups.set(q, qs);
    const as = answerGroups.get(a) || []; as.push(item); answerGroups.set(a, as);
    if (a.length >= 5 && q.includes(a)) flags.push({ id: item.id, kind: "POSSIBLE_ANSWER_LEAK", related: "",
      note: "Literal answer occurs in prompt; a reviewer must distinguish a genuine leak from legitimate terminology." });
    if (!item.source) flags.push({ id: item.id, kind: "ITEM_REFERENCE_MISSING", related: "",
      note: "Needs a precise claim-level primary source; a source URL alone never constitutes approval." });
  }
  for (const group of questionGroups.values()) if (group.length > 1) for (const item of group) flags.push({
    id: item.id, kind: "EXACT_NORMALIZED_DUPLICATE", related: group.filter(x => x.id !== item.id).map(x => x.id).join(";"), note: "Same normalized prompt." });
  for (const group of answerGroups.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      const a = group[i], b = group[j];
      const left = new Set(normalize(a.question).split(" ").filter(w => w.length > 2));
      const right = new Set(normalize(b.question).split(" ").filter(w => w.length > 2));
      const overlap = [...left].filter(w => right.has(w)).length / Math.max(1, new Set([...left, ...right]).size);
      if (overlap >= 0.35) flags.push({ id: a.id, kind: "POSSIBLE_SAME_FACT", related: b.id,
        note: `Same normalized answer and word overlap ${overlap.toFixed(2)}. Triage only; repeated answers can be legitimate.` });
    }
  }
  const summary = { authored: items.length, categories: new Set(items.map(i => i.category)).size,
    target: 2592, missingFullBankItems: 2592 - items.length, humanApprovalsGrantedByTool: 0,
    pilotStatus: "NOT_RUN", verdict: "REVIEW_REQUIRED_NO_ACTIVATION", flags: flags.length,
    exactDuplicateFlags: flags.filter(f => f.kind === "EXACT_NORMALIZED_DUPLICATE").length,
    inventoryDigest: digest(items.map(i => `${i.id}:${i.contentHash}`).join("\n")) };
  return { summary, flags };
}

export function pilotAssignments(items: readonly ReviewItem[]): PilotAssignment[] {
  const assignments: PilotAssignment[] = [];
  const categories = [...new Set(items.map(i => i.category))];
  for (const category of categories) items.filter(i => i.category === category).forEach((item, index) => {
    for (const [group, start] of [["A", 1], ["B", 7]] as const) for (let offset = 0; offset < 3; offset++) {
      assignments.push({ participant_id: `P${String(start + (index + offset) % 6).padStart(2, "0")}`,
        group, session: "", blind_id: digest(item.id + ":" + item.contentHash).slice(0, 16),
        item_id: item.id, content_hash: item.contentHash });
    }
  });
  assignments.sort((a, b) => a.participant_id.localeCompare(b.participant_id) ||
    digest(a.participant_id + a.blind_id).localeCompare(digest(b.participant_id + b.blind_id)));
  const count = new Map<string, number>();
  for (const row of assignments) { const n = count.get(row.participant_id) || 0; row.session = String(Math.floor(n / 24) + 1); count.set(row.participant_id, n + 1); }
  return assignments;
}
export function blindPack(items: readonly ReviewItem[], participant: string, session: string) {
  const selected = pilotAssignments(items).filter(a => a.participant_id === participant && a.session === session);
  assert.ok(selected.length, "Unknown participant/session");
  const byId = new Map(items.map(i => [i.id, i]));
  return { participant, session, questions: selected.map(a => ({ blind_id: a.blind_id, question: byId.get(a.item_id)!.question })) };
}
export function analyzeResponses(items: readonly ReviewItem[], responses: readonly Record<string, string>[]) {
  const expected = pilotAssignments(items), assignmentKey = (r: Record<string, string>) => `${r.participant_id}|${r.session}|${r.blind_id}`;
  const roster = new Map(expected.map(r => [assignmentKey(r), r]));
  const seen = new Set<string>(); const results: { item: ReviewItem; correct: number; seconds: number; flag: string; group: string }[] = [];
  const byId = new Map(items.map(i => [i.id, i]));
  for (const row of responses) {
    const key = assignmentKey(row), assigned = roster.get(key);
    assert.ok(assigned, "Unknown or stale participant/session/question"); assert.ok(!seen.has(key), "Duplicate response"); seen.add(key);
    assert.equal(row.content_hash, assigned.content_hash, "Source changed: responses cannot approve revised content");
    if (!row.correct && !row.seconds_elapsed && !row.judge_flag) continue;
    assert.ok(["0", "1"].includes(row.correct), "correct must be 0 or 1");
    const seconds = Number(row.seconds_elapsed); assert.ok(row.seconds_elapsed && Number.isFinite(seconds) && seconds > 0 && seconds <= 180, "Time must be 1..180 seconds");
    assert.ok(["CLEAR", "AMBIGUOUS", "DISPUTED"].includes(row.judge_flag), "Judge flag required");
    results.push({ item: byId.get(assigned.item_id)!, correct: Number(row.correct), seconds, flag: row.judge_flag, group: assigned.group });
  }
  const stats = ["200", "400", "600"].map(tier => {
    const rows = results.filter(r => r.item.tier === tier), sorted = rows.map(r => r.seconds).sort((a, b) => a - b);
    return { tier, answers: rows.length, correctRate: rows.length ? rows.reduce((n, r) => n + r.correct, 0) / rows.length : null,
      medianSeconds: sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : null };
  });
  return { status: results.length === 0 ? "NOT_RUN" : results.length === expected.length ? "COMPLETE_DATA_REQUIRES_HUMAN_DECISION" : "INCOMPLETE_NO_APPROVAL",
    expected: expected.length, answered: results.length, submittedRows: responses.length, approval: "NEVER_AUTOMATIC", stats,
    disputed: results.filter(r => r.flag !== "CLEAR").map(r => r.item.id),
    note: "Data completeness is not authenticity or editorial approval. Verify real independent participants and review item/group results before assigning tiers." };
}
