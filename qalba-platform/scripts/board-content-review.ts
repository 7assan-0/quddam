/** Local review export. Never writes source ledgers, the database, or approval decisions. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { loadInventory, screenInventory, pilotAssignments, blindPack, analyzeResponses, parseCsv, csv } from "./lib/board-content-review";

const items = loadInventory(), report = screenInventory(items);
const command = process.argv[2];
if (command === "--analyze") {
  if (!process.argv[3]) throw Error("Usage: --analyze <private completed judge CSV>");
  console.log(JSON.stringify(analyzeResponses(items, parseCsv(readFileSync(resolve(process.argv[3]), "utf8"))), null, 2));
} else if (command === "--export") {
  if (!process.argv[3]) throw Error("Usage: --export <local output directory> [participant P01..P12] [session 1..44]");
  const output = resolve(process.argv[3]); mkdirSync(output, { recursive: true });
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const data = { sourceCommit, generatedAt: new Date().toISOString(), ...report, items };
  writeFileSync(join(output, "inventory.csv"), csv(Object.keys(items[0]), items));
  writeFileSync(join(output, "triage.csv"), csv(["id", "kind", "related", "note"], report.flags));
  writeFileSync(join(output, "summary.json"), JSON.stringify({ sourceCommit, generatedAt: data.generatedAt, ...report.summary }, null, 2) + "\n");
  const template = readFileSync(new URL("./templates/board-content-review.html", import.meta.url), "utf8");
  writeFileSync(join(output, "review.html"), template.replace("/*__REVIEW_DATA__*/null", JSON.stringify(data).replaceAll("<", "\\u003c")));
  const assignments = pilotAssignments(items);
  writeFileSync(join(output, "private-pilot-roster.csv"), csv(["participant_id", "group", "session", "blind_id", "item_id", "content_hash"], assignments));
  const empty = assignments.map(a => ({ participant_id: a.participant_id, session: a.session, blind_id: a.blind_id, content_hash: a.content_hash,
    correct: "", seconds_elapsed: "", judge_flag: "" }));
  writeFileSync(join(output, "judge-responses-EMPTY.csv"), csv(["participant_id", "session", "blind_id", "content_hash", "correct", "seconds_elapsed", "judge_flag"], empty));
  const participant = process.argv[4] || "P01", session = process.argv[5] || "1";
  const pack = blindPack(items, participant, session);
  const pilotTemplate = readFileSync(new URL("./templates/board-pilot.html", import.meta.url), "utf8");
  writeFileSync(join(output, `participant-${participant}-session-${session}.html`), pilotTemplate.replace("/*__PILOT_DATA__*/null", JSON.stringify(pack).replaceAll("<", "\\u003c")));
  writeFileSync(join(output, "README.txt"), [
    "Quddam local review package — not deployed, not approved.",
    `Inventory: ${items.length}; fingerprint: ${report.summary.inventoryDigest}; base commit: ${sourceCommit}.`,
    "The inventory fingerprint covers current working source, including uncommitted changes; base commit is NOT an exact-head CI claim.",
    "review.html is for reviewers and contains answers. Never share it with blind-pilot participants.",
    "Give only participant-Pxx-session-N.html to that participant. It contains no answers or point tiers.",
    "Pilot questions are 24/session, 44 sessions/person, 12 pseudonymous participants in 2 groups, 6 independent attempts/question.",
    "private-pilot-roster.csv and inventory.csv are facilitator-only. Do not give players the private roster or answer key.",
    "Do not collect participant names/emails. Local exports are private; keep any real response files out of Git.",
    "A real facilitator must judge answers and fill correct, seconds_elapsed, and judge_flag in the blank judge CSV.",
    "Blank CSVs yield NOT_RUN. AI simulations, test fixtures and scripted answers never count as actual human evidence.",
    "Source hashes must match; edited questions invalidate prior responses. The analyzer NEVER grants approval.",
    "Review decisions exported by the dashboard are proposed local decisions only; original source ledgers remain unchanged.",
  ].join("\n") + "\n");
  console.log(JSON.stringify({ ...report.summary, humanResponses: 0, expectedPilotAttempts: assignments.length,
    participantPack: pack.questions.length, output }, null, 2));
} else throw Error("Expected --export <private directory> [P01] [1] or --analyze <judge CSV>");
