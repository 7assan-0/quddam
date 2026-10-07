export const QUESTION_COUNT = 15;
export const ANSWER_MS = 8_000;
export const STEAL_MS = 5_000;
export type Phase = "LOBBY" | "READY" | "QUESTION_READY" | "BUZZ_OPEN" | "TEAM_ANSWERING" | "STEAL" | "QUESTION_RESULTS" | "PAUSED" | "FINAL_RESULTS" | "COMPLETED" | "ABANDONED";
export type Question = { question: string; answer: string; alternativeAnswers: string[]; explanation: string | null; category: string; difficulty: "EASY" | "MEDIUM" | "HARD" };
export type Result = { questionNumber: number; buzzWinnerIndex: number | null; original: "CORRECT" | "WRONG" | "TIMEOUT" | "UNANSWERED"; steal: "CORRECT" | "WRONG" | "TIMEOUT" | null; awardedIndex: number | null; points: number; voided: boolean };
export type Frame = { phase: Phase; buzzOpenedAt: number | null; buzzWinnerIndex: number | null; activeIndex: number | null; deadlineAt: number | null; originalWrong: "WRONG" | "TIMEOUT" | null };
export type State = Frame & { module: "LIGHTNING_QUIZ"; schemaVersion: 1; pausedPhase: Phase | null; pausedAt: number | null; remainingMs: number | null; matchNumber: number; questionIndex: number; questionCount: number; useIds: string[]; teamIds: string[]; scores: number[]; history: Frame[]; results: Result[]; lastEvent: string[] };
export type HostAction = { type: "START" | "PREPARE_QUESTION" | "OPEN_BUZZ" | "CORRECT" | "WRONG" | "STEAL_CORRECT" | "STEAL_WRONG" | "NEXT_QUESTION" | "PAUSE" | "RESUME" | "UNDO" | "VOID_RESULT" | "END_GAME" | "COMPLETE" | "REMATCH" | "ABANDON" };
export class LightningError extends Error {
  constructor(message: string, public status = 409, public code = "INVALID_ACTION") { super(message); }
}
export function normalize(text: string) {
  return text.normalize("NFC").replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu, "").replace(/[أإآٱ]/gu, "ا").replace(/ى/gu, "ي").trim().replace(/\s+/gu, " ").toLocaleLowerCase("ar");
}
export function bounded(text: string, max: number) {
  if (/[\p{Cc}\p{Cf}]/u.test(text) || !normalize(text) || text.length > max) throw new LightningError("نص غير صالح أو أطول من المسموح", 400, "INVALID_TEXT");
  return text.normalize("NFC").trim().replace(/\s+/gu, " ");
}
export function validateQuestion(q: Question) {
  bounded(q.question, 500); bounded(q.answer, 160); bounded(q.category, 100);
  if (!["EASY", "MEDIUM", "HARD"].includes(q.difficulty) || q.alternativeAnswers.length > 12) throw new LightningError("بيانات السؤال غير صالحة", 400);
  const seen = new Set([normalize(q.answer)]);
  for (const answer of q.alternativeAnswers) {
    const key = normalize(bounded(answer, 160));
    if (seen.has(key)) throw new LightningError("البدائل يجب أن تكون فريدة ومختلفة عن الإجابة", 400, "DUPLICATE_ANSWER");
    seen.add(key);
  }
  if (q.explanation) bounded(q.explanation, 1000);
  return true;
}
export function lobby(): State {
  return { module: "LIGHTNING_QUIZ", schemaVersion: 1, phase: "LOBBY", pausedPhase: null, pausedAt: null, remainingMs: null, matchNumber: 0, questionIndex: 0, questionCount: QUESTION_COUNT, useIds: [], teamIds: [], scores: [0, 0], buzzOpenedAt: null, buzzWinnerIndex: null, activeIndex: null, deadlineAt: null, originalWrong: null, history: [], results: [], lastEvent: [] };
}
export function assertPhase(s: State, ...phases: Phase[]) {
  if (!phases.includes(s.phase)) throw new LightningError("الإجراء غير متاح في هذه المرحلة", 409, "INVALID_PHASE");
}
export function fresh(s: State, teams: string[], ids: string[]): State {
  if (teams.length !== 2 || new Set(teams).size !== 2 || ![10, 15, 20, 25].includes(ids.length) || new Set(ids).size !== ids.length) throw new LightningError("تجهيز المباراة غير صالح", 400);
  return { ...lobby(), phase: "READY", matchNumber: s.matchNumber + 1, teamIds: [...teams], useIds: [...ids], questionCount: ids.length, lastEvent: ["LIGHTNING_GAME_STARTED"] };
}
export function expired(s: State, now: number) { return ["TEAM_ANSWERING", "STEAL"].includes(s.phase) && s.deadlineAt !== null && now >= s.deadlineAt; }
function frame(s: State): Frame { return { phase: s.phase, buzzOpenedAt: s.buzzOpenedAt, buzzWinnerIndex: s.buzzWinnerIndex, activeIndex: s.activeIndex, deadlineAt: s.deadlineAt, originalWrong: s.originalWrong }; }
function remember(s: State) { return [...s.history, frame(s)].slice(-8); }
function prepared(s: State): State { return { ...s, phase: "QUESTION_READY", buzzOpenedAt: null, buzzWinnerIndex: null, activeIndex: null, deadlineAt: null, remainingMs: null, originalWrong: null, history: [], lastEvent: ["LIGHTNING_QUESTION_READY"] }; }
export function buzz(s: State, index: number, now: number): State {
  if (index !== 0 && index !== 1) throw new LightningError("فريق غير صالح", 403, "BUZZER_ACCESS_DENIED");
  if (s.buzzWinnerIndex !== null || ["TEAM_ANSWERING", "STEAL", "QUESTION_RESULTS"].includes(s.phase)) throw new LightningError("قفل الجرس للفريق الأول", 409, "BUZZ_ALREADY_LOCKED");
  assertPhase(s, "BUZZ_OPEN");
  return { ...s, phase: "TEAM_ANSWERING", buzzWinnerIndex: index, activeIndex: index, deadlineAt: now + ANSWER_MS, remainingMs: null, history: remember(s), lastEvent: ["LIGHTNING_BUZZ_LOCKED", "LIGHTNING_ANSWER_TIMER_STARTED"] };
}
function finish(s: State, original: Result["original"], steal: Result["steal"]): State {
  const awardedIndex = original === "CORRECT" ? s.buzzWinnerIndex : steal === "CORRECT" ? s.activeIndex : null;
  const points = original === "CORRECT" ? 2 : steal === "CORRECT" ? 1 : 0;
  const scores = [...s.scores]; if (awardedIndex !== null) scores[awardedIndex] += points;
  const result: Result = { questionNumber: s.questionIndex + 1, buzzWinnerIndex: s.buzzWinnerIndex, original, steal, awardedIndex, points, voided: false };
  return { ...s, phase: "QUESTION_RESULTS", scores, deadlineAt: null, remainingMs: null, history: [], results: [...s.results, result], lastEvent: [...s.lastEvent, "LIGHTNING_QUESTION_COMPLETED"] };
}
function startSteal(s: State, reason: "WRONG" | "TIMEOUT", now: number): State {
  if (s.buzzWinnerIndex === null) throw new LightningError("الفريق الأول غير موجود", 500);
  return { ...s, phase: "STEAL", activeIndex: 1 - s.buzzWinnerIndex, originalWrong: reason, deadlineAt: now + STEAL_MS, remainingMs: null, history: remember(s), lastEvent: ["LIGHTNING_ANSWER_WRONG", "LIGHTNING_STEAL_STARTED"] };
}
export function timeout(s: State, now: number): State {
  if (!expired(s, now)) throw new LightningError("لم تنته المهلة", 409, "TIMER_NOT_EXPIRED");
  return s.phase === "TEAM_ANSWERING" ? startSteal(s, "TIMEOUT", now) : finish({ ...s, lastEvent: ["LIGHTNING_STEAL_WRONG"] }, s.originalWrong!, "TIMEOUT");
}
export function transition(s: State, action: HostAction, now: number): State {
  const n = structuredClone(s);
  if (expired(s, now)) throw new LightningError("انتهى وقت الإجابة", 409, "TIMER_EXPIRED");
  switch (action.type) {
    case "PREPARE_QUESTION": assertPhase(s, "READY"); return prepared(n);
    case "OPEN_BUZZ": assertPhase(s, "QUESTION_READY"); return { ...n, phase: "BUZZ_OPEN", buzzOpenedAt: now, history: remember(s), lastEvent: ["LIGHTNING_BUZZ_OPENED"] };
    case "CORRECT": assertPhase(s, "TEAM_ANSWERING"); return finish({ ...n, lastEvent: ["LIGHTNING_ANSWER_CORRECT"] }, "CORRECT", null);
    case "WRONG": assertPhase(s, "TEAM_ANSWERING"); return startSteal(n, "WRONG", now);
    case "STEAL_CORRECT": assertPhase(s, "STEAL"); return finish({ ...n, lastEvent: ["LIGHTNING_STEAL_CORRECT"] }, s.originalWrong!, "CORRECT");
    case "STEAL_WRONG": assertPhase(s, "STEAL"); return finish({ ...n, lastEvent: ["LIGHTNING_STEAL_WRONG"] }, s.originalWrong!, "WRONG");
    case "NEXT_QUESTION": assertPhase(s, "QUESTION_RESULTS"); return s.questionIndex + 1 === s.questionCount ? { ...n, phase: "FINAL_RESULTS", activeIndex: null, history: [], lastEvent: ["LIGHTNING_FINAL_RESULTS"] } : prepared({ ...n, questionIndex: s.questionIndex + 1 });
    case "UNDO": {
      assertPhase(s, "QUESTION_READY", "BUZZ_OPEN", "TEAM_ANSWERING", "STEAL");
      const previous = n.history.pop(); if (!previous) throw new LightningError("لا يوجد إجراء آمن للتراجع", 409, "UNDO_UNAVAILABLE");
      Object.assign(n, previous); if (n.deadlineAt !== null) n.deadlineAt = Math.max(now, n.deadlineAt);
      return { ...n, lastEvent: ["LIGHTNING_UNDO_AUDITED"] };
    }
    case "VOID_RESULT": {
      assertPhase(s, "QUESTION_RESULTS"); const result = n.results.at(-1);
      if (!result || result.voided || result.points === 0) throw new LightningError("لا توجد نقاط قابلة للإلغاء", 409, "VOID_UNAVAILABLE");
      n.scores[result.awardedIndex!] -= result.points; result.points = 0; result.awardedIndex = null; result.voided = true;
      return { ...n, lastEvent: ["LIGHTNING_SCORE_VOIDED"] };
    }
    case "PAUSE": assertPhase(s, "READY", "QUESTION_READY", "BUZZ_OPEN", "TEAM_ANSWERING", "STEAL"); return { ...n, phase: "PAUSED", pausedPhase: s.phase, pausedAt: now, remainingMs: s.deadlineAt === null ? null : Math.max(0, s.deadlineAt - now), deadlineAt: null, lastEvent: ["LIGHTNING_GAME_PAUSED"] };
    case "RESUME": {
      assertPhase(s, "PAUSED"); if (!s.pausedPhase || s.pausedAt === null) throw new LightningError("توقف غير صالح", 500);
      const shift = now - s.pausedAt;
      return { ...n, phase: s.pausedPhase, pausedPhase: null, pausedAt: null, remainingMs: null, deadlineAt: s.remainingMs === null ? null : now + s.remainingMs, history: n.history.map(h => ({ ...h, deadlineAt: h.deadlineAt === null ? null : h.deadlineAt + shift })), lastEvent: ["LIGHTNING_GAME_RESUMED"] };
    }
    case "END_GAME": {
      if (["LOBBY", "FINAL_RESULTS", "COMPLETED", "ABANDONED"].includes(s.phase)) throw new LightningError("لا يمكن إنهاء المباراة الآن", 409, "INVALID_PHASE");
      const phase = s.phase === "PAUSED" ? s.pausedPhase! : s.phase;
      const end = ["QUESTION_READY", "BUZZ_OPEN", "TEAM_ANSWERING", "STEAL"].includes(phase) ? finish({ ...n, lastEvent: [] }, s.originalWrong ?? "UNANSWERED", phase === "STEAL" ? "WRONG" : null) : n;
      return { ...end, phase: "FINAL_RESULTS", activeIndex: null, deadlineAt: null, remainingMs: null, pausedPhase: null, pausedAt: null, history: [], lastEvent: ["LIGHTNING_GAME_ENDED"] };
    }
    case "COMPLETE": assertPhase(s, "FINAL_RESULTS"); return { ...n, phase: "COMPLETED", lastEvent: ["LIGHTNING_GAME_COMPLETED"] };
    case "ABANDON": if (["COMPLETED", "ABANDONED"].includes(s.phase)) throw new LightningError("انتهت المباراة", 409, "INVALID_PHASE"); return { ...n, phase: "ABANDONED", deadlineAt: null, remainingMs: null, pausedPhase: null, pausedAt: null, history: [], lastEvent: ["LIGHTNING_GAME_ABANDONED"] };
    default: throw new LightningError("هذا الإجراء يحتاج تجهيز الخادم");
  }
}
export function winners(s: State) { return s.teamIds.filter((_, i) => s.scores[i] === Math.max(...s.scores)); }
export function isRevealed(s: State) { return s.results.some(r => r.questionNumber === s.questionIndex + 1) && ["QUESTION_RESULTS", "FINAL_RESULTS", "COMPLETED"].includes(s.phase); }
export function recentPool<T extends { id: string }>(items: T[], recent: string[], random: (max: number) => number) {
  const shuffle = (items: T[]) => { const n = [...items]; for (let i = n.length - 1; i > 0; i--) { const j = random(i + 1); [n[i], n[j]] = [n[j], n[i]]; } return n; };
  const set = new Set(recent); return [...shuffle(items.filter(v => !set.has(v.id))), ...shuffle(items.filter(v => set.has(v.id)))];
}
