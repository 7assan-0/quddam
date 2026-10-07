export const ROUND_COUNT = 7;
export const ORDER_MS = 45_000;
export const orderingTypes = ["CHRONOLOGICAL_ASC", "CHRONOLOGICAL_DESC", "NUMERIC_ASC", "NUMERIC_DESC", "SIZE_ASC", "SIZE_DESC", "DISTANCE_ASC", "DISTANCE_DESC", "CUSTOM"] as const;
export type Phase = "LOBBY" | "READY" | "ROUND_INTRO" | "ORDERING" | "REVEAL" | "ROUND_RESULTS" | "PAUSED" | "FINAL_RESULTS" | "COMPLETED" | "ABANDONED";
export type Item = { id: string; label: string; correctPosition: number; acceptedAliases: string[]; displayValue: string | null };
export type Question = { title: string; instruction: string; category: string; difficulty: "EASY" | "MEDIUM" | "HARD"; locale: "ar-SA"; orderingType: typeof orderingTypes[number]; factual: boolean; sourceLabel: string | null; sourceUrl: string | null; sourceDate: string | null; explanation: string | null; items: Item[]; presentation: string[] };
export type Metrics = { exactMatches: number; perfectBonus: number; totalPoints: number; positionError: number };
export type Result = { roundNumber: number; orders: string[][]; metrics: Metrics[]; winner: "TEAM_A" | "TEAM_B" | "TIE"; reason: "SUBMITTED" | "TIMEOUT" | "MANUAL_END"; voided: boolean };
export type State = { module: "ORDERING"; schemaVersion: 1; phase: Phase; pausedPhase: Phase | null; remainingMs: number | null; deadlineAt: number | null; matchNumber: number; roundIndex: number; roundCount: number; teamIds: string[]; scores: number[]; useIds: string[]; orders: string[][]; revisions: number[]; submitted: boolean[]; results: Result[]; lastEvent: string[] };
export type HostAction = { type: "START" | "START_ROUND" | "SHOW_RESULT" | "NEXT_ROUND" | "PAUSE" | "RESUME" | "REVEAL" | "VOID_RESULT" | "END_GAME" | "COMPLETE" | "REMATCH" | "ABANDON" } | { type: "REOPEN_ORDER"; teamId: string };
export type TeamAction = { type: "SAVE_ORDER" | "SUBMIT_ORDER"; roundNumber: number; order: string[] };
export class OrderingError extends Error { constructor(message: string, public status = 409, public code = "INVALID_ACTION") { super(message); } }
export function normalize(text: string) { return text.normalize("NFC").replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu, "").replace(/[أإآٱ]/gu, "ا").replace(/ى/gu, "ي").trim().replace(/\s+/gu, " ").toLocaleLowerCase("ar"); }
export function bounded(text: string, max: number) { if (/[\p{Cc}\p{Cf}]/u.test(text) || !normalize(text) || text.length > max) throw new OrderingError("نص غير صالح أو أطول من المسموح", 400, "INVALID_TEXT"); return text.normalize("NFC").trim().replace(/\s+/gu, " "); }
export function validateQuestion(q: Omit<Question, "presentation">, now = Date.now()) {
  bounded(q.title, 200); bounded(q.instruction, 500); bounded(q.category, 100);
  if (q.locale !== "ar-SA" || !["EASY", "MEDIUM", "HARD"].includes(q.difficulty) || !orderingTypes.includes(q.orderingType) || q.items.length < 4 || q.items.length > 8) throw new OrderingError("بيانات التحدي غير صالحة؛ يلزم ٤–٨ عناصر", 400, "INVALID_QUESTION");
  const positions = q.items.map(i => i.correctPosition).sort((a, b) => a - b);
  if (positions.some((p, i) => p !== i + 1)) throw new OrderingError("المواضع يجب أن تكون فريدة ومتتالية من ١", 400, "INVALID_POSITIONS");
  const seen = new Set<string>();
  for (const item of q.items) {
    if (item.acceptedAliases.length > 8) throw new OrderingError("بدائل كثيرة", 400);
    for (const label of [item.label, ...item.acceptedAliases]) { const key = normalize(bounded(label, 160)); if (seen.has(key)) throw new OrderingError("اسم أو بديل مكرر بين العناصر", 400, "ALIAS_COLLISION"); seen.add(key); }
    if (item.displayValue) bounded(item.displayValue, 160);
  }
  if (q.explanation) bounded(q.explanation, 1000);
  if (q.factual && (!q.sourceLabel || !q.sourceUrl || !q.sourceDate)) throw new OrderingError("التحدي الواقعي يحتاج اسم مصدر ورابطه وتاريخه", 400, "SOURCE_REQUIRED");
  if (q.sourceLabel) bounded(q.sourceLabel, 200);
  if (q.sourceUrl) { let u: URL; try { u = new URL(q.sourceUrl); } catch { throw new OrderingError("رابط المصدر غير صالح", 400); } if (u.protocol !== "https:" || u.username || u.password || q.sourceUrl.length > 500) throw new OrderingError("المصدر يجب أن يستخدم HTTPS", 400); }
  if (q.sourceDate && (!/^\d{4}-\d{2}-\d{2}$/.test(q.sourceDate) || Number.isNaN(Date.parse(q.sourceDate)) || new Date(q.sourceDate).toISOString().slice(0, 10) !== q.sourceDate || q.sourceDate > new Date(now).toISOString().slice(0, 10))) throw new OrderingError("تاريخ المصدر غير صالح أو في المستقبل", 400, "INVALID_SOURCE_DATE");
  return true;
}
export function shuffle<T>(items: T[], random: (max: number) => number) { const n = [...items]; for (let i = n.length - 1; i > 0; i--) { const j = random(i + 1); [n[i], n[j]] = [n[j], n[i]]; } return n; }
export function recentPool<T extends { id: string }>(items: T[], recent: string[], random: (max: number) => number) { const seen = new Set(recent); return [...shuffle(items.filter(i => !seen.has(i.id)), random), ...shuffle(items.filter(i => seen.has(i.id)), random)]; }
export function validateOrder(order: string[], items: Item[]) { if (order.length !== items.length || new Set(order).size !== items.length || order.some(id => !items.some(i => i.id === id))) throw new OrderingError("الترتيب يجب أن يحتوي كل عناصر الجولة مرة واحدة", 400, "INVALID_ORDER"); }
export function scoreOrder(order: string[], items: Item[]): Metrics { validateOrder(order, items); let exactMatches = 0, positionError = 0; order.forEach((id, i) => { const p = items.find(item => item.id === id)!.correctPosition; if (p === i + 1) exactMatches++; positionError += Math.abs(p - i - 1); }); const perfectBonus = exactMatches === items.length ? 2 : 0; return { exactMatches, perfectBonus, totalPoints: exactMatches * 2 + perfectBonus, positionError }; }
export function lobby(): State { return { module: "ORDERING", schemaVersion: 1, phase: "LOBBY", pausedPhase: null, remainingMs: null, deadlineAt: null, matchNumber: 0, roundIndex: 0, roundCount: ROUND_COUNT, teamIds: [], scores: [0, 0], useIds: [], orders: [[], []], revisions: [0, 0], submitted: [false, false], results: [], lastEvent: [] }; }
export function assertPhase(s: State, ...phases: Phase[]) { if (!phases.includes(s.phase)) throw new OrderingError("الإجراء غير متاح في هذه المرحلة", 409, "INVALID_PHASE"); }
export function fresh(s: State, teamIds: string[], useIds: string[]): State { if (teamIds.length !== 2 || new Set(teamIds).size !== 2 || ![5, 7, 10].includes(useIds.length) || new Set(useIds).size !== useIds.length) throw new OrderingError("تجهيز المباراة غير صالح", 400); return { ...lobby(), teamIds: [...teamIds], useIds: [...useIds], roundCount: useIds.length, matchNumber: s.matchNumber + 1, phase: "READY", lastEvent: ["ORDER_GAME_STARTED"] }; }
export function expired(s: State, now: number) { return s.phase === "ORDERING" && s.deadlineAt !== null && now >= s.deadlineAt; }
export function startRound(s: State, q: Question, now: number): State { validateOrder(q.presentation, q.items); return { ...s, phase: "ORDERING", deadlineAt: now + ORDER_MS, remainingMs: null, orders: [[...q.presentation], [...q.presentation]], revisions: [0, 0], submitted: [false, false], lastEvent: ["ORDER_ROUND_STARTED"] }; }
export function reveal(s: State, q: Question, reason: Result["reason"]): State {
  assertPhase(s, "ORDERING"); const metrics = s.orders.map(o => scoreOrder(o, q.items));
  const winner = metrics[0].totalPoints === metrics[1].totalPoints ? "TIE" : metrics[0].totalPoints > metrics[1].totalPoints ? "TEAM_A" : "TEAM_B";
  return { ...s, phase: "REVEAL", submitted: [true, true], deadlineAt: null, remainingMs: null, scores: s.scores.map((n, i) => n + metrics[i].totalPoints), results: [...s.results, { roundNumber: s.roundIndex + 1, orders: s.orders.map(o => [...o]), metrics, winner, reason, voided: false }], lastEvent: [...(reason === "TIMEOUT" ? ["ORDER_TIMER_EXPIRED"] : reason === "SUBMITTED" ? ["ORDER_TEAM_SUBMITTED"] : []), "ORDER_REVEAL_STARTED"] };
}
export function teamTransition(s: State, q: Question, index: number, expectedRevision: number, action: TeamAction, now: number): State {
  if (index !== 0 && index !== 1) throw new OrderingError("غير مصرح للفريق", 403, "CONTROLLER_ACCESS_DENIED");
  assertPhase(s, "ORDERING"); if (expired(s, now)) throw new OrderingError("انتهت المهلة", 409, "TIMER_EXPIRED");
  if (action.roundNumber !== s.roundIndex + 1) throw new OrderingError("هذه جولة مختلفة", 409, "STALE_ROUND");
  if (s.submitted[index]) throw new OrderingError("تم تسليم ترتيب الفريق", 409, "ORDER_FINALIZED");
  if (expectedRevision !== s.revisions[index]) throw new OrderingError("تغير ترتيب فريقك؛ حدّث البطاقة", 409, "STALE_TEAM_ORDER");
  validateOrder(action.order, q.items); const n = structuredClone(s); n.orders[index] = [...action.order]; n.revisions[index]++;
  n.submitted[index] = action.type === "SUBMIT_ORDER"; n.lastEvent = [n.submitted[index] ? "ORDER_TEAM_SUBMITTED" : "ORDER_TEAM_PROGRESS"];
  return n.submitted.every(Boolean) ? reveal(n, q, "SUBMITTED") : n;
}
export function transition(s: State, q: Question | null, action: HostAction, now: number): State {
  if (expired(s, now)) throw new OrderingError("انتهت مهلة الجولة", 409, "TIMER_EXPIRED"); const n = structuredClone(s);
  switch (action.type) {
    case "START_ROUND": assertPhase(s, "READY", "ROUND_INTRO"); return startRound(n, q!, now);
    case "REVEAL": assertPhase(s, "ORDERING"); if (!s.submitted.every(Boolean)) throw new OrderingError("يلزم تسليم الفريقين", 409, "TEAMS_NOT_READY"); return reveal(n, q!, "SUBMITTED");
    case "REOPEN_ORDER": { assertPhase(s, "ORDERING"); const i = s.teamIds.indexOf(action.teamId); if (i < 0 || !s.submitted[i]) throw new OrderingError("لا يوجد تسليم لهذا الفريق", 409); n.submitted[i] = false; n.revisions[i]++; return { ...n, lastEvent: ["ORDER_TEAM_REOPENED"] }; }
    case "SHOW_RESULT": assertPhase(s, "REVEAL"); return { ...n, phase: "ROUND_RESULTS", lastEvent: ["ORDER_ROUND_COMPLETED"] };
    case "NEXT_ROUND": assertPhase(s, "ROUND_RESULTS"); return s.roundIndex + 1 === s.roundCount ? { ...n, phase: "FINAL_RESULTS", lastEvent: ["ORDER_FINAL_RESULTS"] } : startRound({ ...n, roundIndex: s.roundIndex + 1 }, q!, now);
    case "PAUSE": assertPhase(s, "READY", "ROUND_INTRO", "ORDERING"); return { ...n, phase: "PAUSED", pausedPhase: s.phase, remainingMs: s.deadlineAt === null ? null : s.deadlineAt - now, deadlineAt: null, lastEvent: ["ORDER_GAME_PAUSED"] };
    case "RESUME": assertPhase(s, "PAUSED"); return { ...n, phase: s.pausedPhase!, pausedPhase: null, deadlineAt: s.remainingMs === null ? null : now + s.remainingMs, remainingMs: null, lastEvent: ["ORDER_GAME_RESUMED"] };
    case "VOID_RESULT": { assertPhase(s, "REVEAL", "ROUND_RESULTS"); const r = n.results.at(-1); if (!r || r.voided) throw new OrderingError("لا توجد نتيجة قابلة للإلغاء", 409, "VOID_UNAVAILABLE"); n.scores = n.scores.map((v, i) => v - r.metrics[i].totalPoints); r.voided = true; r.winner = "TIE"; return { ...n, lastEvent: ["ORDER_RESULT_VOIDED"] }; }
    case "END_GAME": { assertPhase(s, "READY", "ROUND_INTRO", "ORDERING", "REVEAL", "ROUND_RESULTS", "PAUSED"); const active = s.phase === "PAUSED" ? s.pausedPhase : s.phase; const resolved = active === "ORDERING" ? reveal({ ...n, phase: "ORDERING", pausedPhase: null }, q!, "MANUAL_END") : n; return { ...resolved, phase: "FINAL_RESULTS", pausedPhase: null, deadlineAt: null, remainingMs: null, lastEvent: ["ORDER_GAME_ENDED"] }; }
    case "COMPLETE": assertPhase(s, "FINAL_RESULTS"); return { ...n, phase: "COMPLETED", lastEvent: ["ORDER_GAME_COMPLETED"] };
    case "ABANDON": if (["COMPLETED", "ABANDONED"].includes(s.phase)) throw new OrderingError("انتهت المباراة", 409, "INVALID_PHASE"); return { ...n, phase: "ABANDONED", deadlineAt: null, remainingMs: null, pausedPhase: null, lastEvent: ["ORDER_GAME_ABANDONED"] };
    default: throw new OrderingError("الإجراء يحتاج تجهيز الخادم");
  }
}
export function isRevealed(s: State) { return s.results.some(r => r.roundNumber === s.roundIndex + 1) && ["REVEAL", "ROUND_RESULTS", "FINAL_RESULTS", "COMPLETED"].includes(s.phase); }
export function winners(s: State) { return s.teamIds.filter((_, i) => s.scores[i] === Math.max(...s.scores)); }
