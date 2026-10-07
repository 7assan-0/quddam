export const DEFAULT_ROUNDS = 5;
export const SUBMISSION_MS = 45_000;
export const VOTING_MS = 30_000;
export const ANSWER_LIMIT = 160;
export type Phase = "LOBBY" | "ROUND_INTRO" | "FAKE_SUBMISSION" | "VOTING" | "REVEAL" | "ROUND_RESULTS" | "FINAL_RESULTS" | "COMPLETED" | "PAUSED" | "ABANDONED";
export type State = {
  module: "BLUFF_GAME"; schemaVersion: 1; phase: Phase; pausedPhase: Phase | null;
  matchNumber: number; roundIndex: number; roundIds: string[]; roundCount: number;
  deadlineAt: string | null; remainingMs: number | null;
  submissionsClosed: boolean; canUndoClose: boolean; lastEvent: string[];
};
export type Snapshot = {question: string; correctAnswer: string; alternativeCorrectAnswers: string[]; explanation: string | null};
export type Choice = {id: string; text: string; ownerId: string | null};
export type Fake = {id: string; participantId: string; text: string; normalizedText: string; hiddenAt: Date | string | null};
export type Vote = {participantId: string; choiceId: string};
export type Points = {participantId: string; correctPoints: number; bluffPoints: number; total: number};
export type HostAction = {type: "START" | "START_ROUND" | "CLOSE_SUBMISSIONS" | "BEGIN_VOTING" | "CLOSE_VOTING" | "ADVANCE_REVEAL" | "NEXT_ROUND" | "PAUSE" | "RESUME" | "UNDO" | "END_GAME" | "COMPLETE" | "REMATCH" | "ABANDON"} | {type: "REMOVE_PARTICIPANT"; participantId: string} | {type: "HIDE_ANSWER"; answerId: string; reason: string};
export type PlayerAction = {type: "SUBMIT_FAKE"; text: string; roundId: string} | {type: "SUBMIT_VOTE"; choiceId: string; roundId: string};
export type Action = HostAction | PlayerAction;
export class BluffError extends Error {
  constructor(message: string, public status = 409, public code = "INVALID_ACTION") {super(message);}
}
export function cleanText(text: string) {return text.trim().replace(/\s+/gu, " ");}
export function normalizeArabic(text: string) {
  return cleanText(text.normalize("NFC").replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu, "").replace(/[أإآٱ]/gu, "ا").replace(/ى/gu, "ي")).toLocaleLowerCase("ar");
}
export function boundedText(text: string, limit: number) {
  if (/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(text)) throw new BluffError("احذف محارف التحكم من النص", 400, "INVALID_TEXT");
  const clean = cleanText(text);
  if (!normalizeArabic(clean) || clean.length > limit) throw new BluffError(`اكتب نصًا من حرف إلى ${limit} حرفًا`, 400, "INVALID_TEXT");
  return clean;
}
export function validateQuestion(q: Snapshot) {
  boundedText(q.question, 500); boundedText(q.correctAnswer, ANSWER_LIMIT);
  const terms = [q.correctAnswer, ...q.alternativeCorrectAnswers].map(a => normalizeArabic(boundedText(a, ANSWER_LIMIT)));
  if (q.alternativeCorrectAnswers.length > 12 || new Set(terms).size !== terms.length) throw new BluffError("الإجابات البديلة يجب أن تكون مختلفة", 400, "INVALID_QUESTION");
  if (q.explanation) boundedText(q.explanation, 1000);
  return true;
}
export function validateFake(text: string, question: Snapshot, accepted: Fake[], blockedTerms: string[]) {
  const clean = boundedText(text, ANSWER_LIMIT), normalized = normalizeArabic(clean);
  if ([question.correctAnswer, ...question.alternativeCorrectAnswers].some(a => normalizeArabic(a) === normalized) || accepted.some(a => a.normalizedText === normalized))
    throw new BluffError("الإجابة مستخدمة، جرّب غيرها", 409, "ANSWER_USED");
  if (blockedTerms.some(term => normalizeArabic(term) && normalized.includes(normalizeArabic(term)))) throw new BluffError("اختر تعبيرًا مناسبًا للجمعة", 400, "ANSWER_BLOCKED");
  return {text: clean, normalizedText: normalized};
}
export function shuffle<T>(items: T[], randomIndex: (max: number) => number) {
  const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) {const j = randomIndex(i + 1); [copy[i], copy[j]] = [copy[j], copy[i]];} return copy;
}
export function mixChoices(snapshot: Snapshot, answers: Fake[], randomIndex: (max: number) => number, opaqueId: () => string): Choice[] {
  return shuffle([{text: snapshot.correctAnswer, ownerId: null}, ...answers.filter(a => !a.hiddenAt).map(a => ({text: a.text, ownerId: a.participantId}))], randomIndex).map(a => ({...a, id: opaqueId()}));
}
export function validateVote(playerId: string, choiceId: string, choices: Choice[]) {
  const choice = choices.find(c => c.id === choiceId);
  if (!choice) throw new BluffError("الخيار غير موجود", 400, "INVALID_CHOICE");
  if (choice.ownerId === playerId) throw new BluffError("لا يمكنك اختيار إجابتك المموّهة", 400, "SELF_VOTE");
}
export function scoreRound(playerIds: string[], choices: Choice[], votes: Vote[]): Points[] {
  if (choices.filter(c => c.ownerId === null).length !== 1 || new Set(choices.map(c=>c.id)).size!==choices.length || choices.some(c=>c.ownerId!==null&&!playerIds.includes(c.ownerId)) || new Set(votes.map(v => v.participantId)).size !== votes.length) throw new BluffError("بيانات الجولة غير صالحة", 500);
  for (const vote of votes) {if (!playerIds.includes(vote.participantId)) throw new BluffError("ناخب غير صالح", 500); validateVote(vote.participantId, vote.choiceId, choices);}
  return playerIds.map(participantId => {
    const correctPoints = votes.some(v => v.participantId === participantId && choices.find(c => c.id === v.choiceId)?.ownerId === null) ? 2 : 0;
    const bluffPoints = votes.filter(v => v.participantId !== participantId && choices.find(c => c.id === v.choiceId)?.ownerId === participantId).length;
    return {participantId, correctPoints, bluffPoints, total: correctPoints + bluffPoints};
  });
}
export function leaderboard<T extends {id: string; score: number}>(players: T[]) {
  return [...players].sort((a, b) => b.score - a.score).map(player => ({...player, rank: 1 + players.filter(p => p.score > player.score).length}));
}
export function winners(players: {id: string; score: number}[]) {
  const high = Math.max(...players.map(p => p.score)); return players.filter(p => p.score === high).map(p => p.id);
}
export function lobby(): State {return {module:"BLUFF_GAME", schemaVersion:1, phase:"LOBBY", pausedPhase:null, matchNumber:0, roundIndex:0, roundIds:[], roundCount:DEFAULT_ROUNDS, deadlineAt:null, remainingMs:null, submissionsClosed:false, canUndoClose:false, lastEvent:[]};}
export function phaseIs(s: State, ...phases: Phase[]) {if (!phases.includes(s.phase)) throw new BluffError("هذا الإجراء غير متاح في المرحلة الحالية", 409, "INVALID_PHASE");}
export function assertPlayerCount(count: number) {if (count < 3 || count > 12) throw new BluffError("يلزم من ٣ إلى ١٢ لاعبًا", 400, "PLAYER_COUNT");}
export function expired(s: State, now: number) {return ["FAKE_SUBMISSION", "VOTING"].includes(s.phase) && s.deadlineAt !== null && now >= Date.parse(s.deadlineAt);}
export function freshMatch(s: State, roundIds: string[]): State {
  if (roundIds.length !== DEFAULT_ROUNDS || new Set(roundIds).size !== roundIds.length) throw new BluffError("بنك الأسئلة غير كافٍ",409);
  return {...lobby(), phase:"ROUND_INTRO", matchNumber:s.matchNumber+1, roundIds, lastEvent:["GAME_STARTED"]};
}
export function beginVoting(s: State, now: number): State {
  phaseIs(s,"FAKE_SUBMISSION"); return {...s, phase:"VOTING", submissionsClosed:true, canUndoClose:false, deadlineAt:new Date(now+VOTING_MS).toISOString(), remainingMs:VOTING_MS, lastEvent:["VOTING_STARTED"]};
}
export function reveal(s: State): State {phaseIs(s,"VOTING"); return {...s,phase:"REVEAL",deadlineAt:null,remainingMs:null,lastEvent:["REVEALED","SCORE_CHANGED"]};}
export function transition(s: State, action: HostAction, now: number): State {
  const n = structuredClone(s);
  switch (action.type) {
    case "START_ROUND": phaseIs(s,"ROUND_INTRO"); return {...n,phase:"FAKE_SUBMISSION",submissionsClosed:false,canUndoClose:false,deadlineAt:new Date(now+SUBMISSION_MS).toISOString(),remainingMs:SUBMISSION_MS,lastEvent:["ROUND_STARTED"]};
    case "CLOSE_SUBMISSIONS": phaseIs(s,"FAKE_SUBMISSION"); if(s.submissionsClosed) throw new BluffError("الإجابات مغلقة"); return {...n,submissionsClosed:true,canUndoClose:true,lastEvent:["SUBMISSIONS_CLOSED"]};
    case "UNDO": phaseIs(s,"FAKE_SUBMISSION"); if(!s.submissionsClosed || !s.canUndoClose || expired(s,now)) throw new BluffError("لا يمكن إعادة المعلومات إلى السرية",409,"UNDO_UNSAFE"); return {...n,submissionsClosed:false,canUndoClose:false,lastEvent:["SUBMISSIONS_REOPENED"]};
    case "ADVANCE_REVEAL": phaseIs(s,"REVEAL"); return {...n,phase:"ROUND_RESULTS",lastEvent:["ROUND_COMPLETED"]};
    case "NEXT_ROUND": phaseIs(s,"ROUND_RESULTS"); return {...n,phase:s.roundIndex+1===s.roundCount?"FINAL_RESULTS":"ROUND_INTRO",roundIndex:Math.min(s.roundIndex+1,s.roundCount-1),submissionsClosed:false,canUndoClose:false,lastEvent:[s.roundIndex+1===s.roundCount?"FINAL_RESULTS":"NEXT_ROUND"]};
    case "PAUSE": phaseIs(s,"ROUND_INTRO","FAKE_SUBMISSION","VOTING","REVEAL","ROUND_RESULTS"); return {...n,pausedPhase:s.phase,phase:"PAUSED",remainingMs:s.deadlineAt?Math.max(0,Date.parse(s.deadlineAt)-now):null,deadlineAt:null,lastEvent:["GAME_PAUSED"]};
    case "RESUME": phaseIs(s,"PAUSED"); if(!s.pausedPhase) throw new BluffError("حالة التوقف غير صالحة",500); return {...n,phase:s.pausedPhase,pausedPhase:null,deadlineAt:s.remainingMs!==null?new Date(now+s.remainingMs).toISOString():null,lastEvent:["GAME_RESUMED"]};
    case "END_GAME": phaseIs(s,"ROUND_INTRO","FAKE_SUBMISSION","VOTING","REVEAL","ROUND_RESULTS","PAUSED"); return {...n,phase:"FINAL_RESULTS",pausedPhase:null,deadlineAt:null,remainingMs:null,canUndoClose:false,lastEvent:["FINAL_RESULTS"]};
    case "COMPLETE": phaseIs(s,"FINAL_RESULTS"); return {...n,phase:"COMPLETED",lastEvent:["GAME_COMPLETED"]};
    case "ABANDON": if(["COMPLETED","ABANDONED"].includes(s.phase)) throw new BluffError("انتهت المباراة"); return {...n,phase:"ABANDONED",pausedPhase:null,deadlineAt:null,remainingMs:null,canUndoClose:false,lastEvent:["GAME_ABANDONED"]};
    default: throw new BluffError("الإجراء يحتاج تحقق الخادم");
  }
}
export function recentPool<T extends {id:string}>(questions:T[], recentIds:string[], randomIndex:(max:number)=>number) {
  const recent = new Set(recentIds); return [...shuffle(questions.filter(q=>!recent.has(q.id)),randomIndex), ...shuffle(questions.filter(q=>recent.has(q.id)),randomIndex)];
}
