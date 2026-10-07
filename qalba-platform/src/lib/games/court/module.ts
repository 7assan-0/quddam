export class CourtError extends Error {
  constructor(message: string, public status = 409, public code = 'INVALID_PHASE') { super(message); }
}
export const ROUND_COUNT = 5;
export const TIMERS = { PREPARATION: 45000, PROSECUTION_ARGUMENT: 45000, DEFENSE_ARGUMENT: 45000, PROSECUTION_REBUTTAL: 20000, DEFENSE_REBUTTAL: 20000, JURY_VOTING: 30000 } as const;
export type TimedPhase = keyof typeof TIMERS;
export type Phase = 'LOBBY' | 'READY' | 'CASE_INTRO' | TimedPhase | 'VERDICT' | 'ROUND_RESULTS' | 'PAUSED' | 'FINAL_RESULTS' | 'COMPLETED' | 'ABANDONED';
export type Choice = 'PROSECUTION' | 'DEFENSE';
export type Verdict = Choice | 'TIE' | 'NO_VERDICT';
export type Case = { title: string; scenario: string; prosecutionPrompt: string; defensePrompt: string; rebuttalPrompt: string | null; category: string; difficulty: 'EASY' | 'MEDIUM' | 'HARD'; locale: string; contentRating: string; facts: string[] };
export type Result = { roundNumber: number; prosecutionVotes: number; defenseVotes: number; abstentions: number; verdict: Verdict; deltas: [number, number]; voided: boolean };
export type State = { module: 'COURT'; schemaVersion: 1; phase: Phase; pausedPhase: TimedPhase | null; deadlineAt: number | null; remainingMs: number | null; pausedAt: number | null; matchNumber: number; roundIndex: number; roundIds: string[]; teamIds: string[]; eligibleIds: string[]; scores: [number, number]; results: Result[]; undo: { phase: Phase; deadlineAt: number | null }[]; lastEvent: string[] };
export type Action = { type: 'START' | 'REMATCH' | 'START_ROUND' | 'START_PREPARATION' | 'ADVANCE_PHASE' | 'OPEN_VOTING' | 'CLOSE_VOTING' | 'ADVANCE_RESULT' | 'NEXT_ROUND' | 'PAUSE' | 'RESUME' | 'UNDO' | 'VOID_RESULT' | 'END_GAME' | 'ABANDON' | 'COMPLETE' } | { type: 'REMOVE_PARTICIPANT'; participantId: string };
export const normalize = (value: string) => value.normalize('NFC').trim().replace(/\s+/gu, ' ').replace(/[\u064B-\u065F\u0670\u0640]/gu, '').replace(/[أإآٱ]/gu, 'ا').replace(/ى/gu, 'ي').toLocaleLowerCase('ar');
export function bounded(value: string, max: number) { if (typeof value !== 'string' || /[\p{Cc}\p{Cf}]/u.test(value) || !value.trim() || value.length > max) throw new CourtError('نص غير صالح أو يتجاوز الحد', 400, 'INVALID_TEXT'); return value.normalize('NFC').trim().replace(/\s+/gu, ' '); }
export const BLOCKED_TERMS = ['اعتداء جنسي', 'انتحار', 'اغتصاب', 'قتل', 'تعذيب', 'انتخابات', 'حزب سياسي', 'إهانة دين', 'مرض نفسي', 'اتهام طبي', 'مخدرات'];
export function validateCase(c: Case, blocked: readonly string[] = BLOCKED_TERMS) {
  bounded(c.title, 180); bounded(c.scenario, 800); bounded(c.prosecutionPrompt, 400); bounded(c.defensePrompt, 400); bounded(c.category, 100);
  if (c.rebuttalPrompt !== null) bounded(c.rebuttalPrompt, 300);
  if (c.locale !== 'ar-SA' || c.contentRating !== 'FICTIONAL_PARTY' || !['EASY', 'MEDIUM', 'HARD'].includes(c.difficulty)) throw new CourtError('إعدادات القضية غير صالحة', 400, 'INVALID_CONTENT');
  if (c.facts.length > 6 || c.facts.some(f => { bounded(f, 220); return false; }) || new Set(c.facts.map(normalize)).size !== c.facts.length) throw new CourtError('حقائق القضية غير صالحة', 400, 'INVALID_FACTS');
  const text = normalize([c.title, c.scenario, c.prosecutionPrompt, c.defensePrompt, c.rebuttalPrompt, c.category, ...c.facts].join(' '));
  if (blocked.some(term => text.includes(normalize(term)))) throw new CourtError('القضية غير مناسبة للعبة اجتماعية خيالية', 400, 'UNSAFE_CONTENT');
  return true;
}
export function assertJurorCount(n: number) { if (!Number.isInteger(n) || n < 3 || n > 12) throw new CourtError('يلزم ٣–١٢ محلفًا', 400, 'JUROR_COUNT'); }
export function phaseIs(s: State, ...phases: Phase[]) { if (!phases.includes(s.phase)) throw new CourtError('الإجراء غير متاح في هذا الطور'); }
export function lobby(): State { return { module: 'COURT', schemaVersion: 1, phase: 'LOBBY', pausedPhase: null, deadlineAt: null, remainingMs: null, pausedAt: null, matchNumber: 0, roundIndex: 0, roundIds: [], teamIds: [], eligibleIds: [], scores: [0, 0], results: [], undo: [], lastEvent: [] }; }
export function fresh(s: State, teams: string[], jurors: string[], rounds: string[]): State {
  assertJurorCount(jurors.length);
  if (teams.length !== 2 || new Set(teams).size !== 2 || new Set(jurors).size !== jurors.length || rounds.length !== ROUND_COUNT || new Set(rounds).size !== rounds.length) throw new CourtError('ترتيب المباراة غير صالح', 400);
  return { ...lobby(), phase: 'READY', matchNumber: s.matchNumber + 1, teamIds: [...teams], eligibleIds: [...jurors], roundIds: [...rounds], lastEvent: ['COURT_GAME_STARTED'] };
}
export const roles = (s: Pick<State, 'roundIndex' | 'teamIds'>) => ({ prosecution: s.teamIds[s.roundIndex % 2], defense: s.teamIds[1 - s.roundIndex % 2] });
export const expired = (s: State, now: number) => s.phase !== 'PAUSED' && s.deadlineAt !== null && now >= s.deadlineAt;
export function timed(s: State, phase: TimedPhase, now: number, history = false): State {
  return { ...s, phase, deadlineAt: now + TIMERS[phase], remainingMs: null, undo: phase === 'JURY_VOTING' ? [] : history ? [...s.undo, { phase: s.phase, deadlineAt: s.deadlineAt }].slice(-8) : s.undo, lastEvent: [phase === 'PREPARATION' ? 'COURT_PREPARATION_STARTED' : phase === 'JURY_VOTING' ? 'COURT_VOTING_STARTED' : 'COURT_ARGUMENT_STARTED'] };
}
const sequence: Phase[] = ['PREPARATION', 'PROSECUTION_ARGUMENT', 'DEFENSE_ARGUMENT', 'PROSECUTION_REBUTTAL', 'DEFENSE_REBUTTAL', 'JURY_VOTING'];
export function advance(s: State, now: number, history = true) { const i = sequence.indexOf(s.phase); if (i < 0 || i >= sequence.length - 1) throw new CourtError('لا يمكن تقديم المرحلة'); return timed(s, sequence[i + 1] as TimedPhase, now, history); }
export function countVerdict(s: State, choices: Choice[]): Result {
  if (choices.length > s.eligibleIds.length || choices.some(c => !['PROSECUTION', 'DEFENSE'].includes(c))) throw new CourtError('أصوات غير صالحة', 400);
  const p = choices.filter(c => c === 'PROSECUTION').length, d = choices.length - p;
  const verdict: Verdict = !choices.length ? 'NO_VERDICT' : p === d ? 'TIE' : p > d ? 'PROSECUTION' : 'DEFENSE';
  const deltas: [number, number] = verdict === 'TIE' ? [1, 1] : [0, 0];
  if (verdict === 'PROSECUTION' || verdict === 'DEFENSE') deltas[verdict === 'PROSECUTION' ? s.roundIndex % 2 : 1 - s.roundIndex % 2] = 3;
  return { roundNumber: s.roundIndex + 1, prosecutionVotes: p, defenseVotes: d, abstentions: s.eligibleIds.length - choices.length, verdict, deltas, voided: false };
}
export function resolve(s: State, choices: Choice[]): State { phaseIs(s, 'JURY_VOTING'); const r = countVerdict(s, choices); return { ...s, phase: 'VERDICT', deadlineAt: null, undo: [], scores: [s.scores[0] + r.deltas[0], s.scores[1] + r.deltas[1]], results: [...s.results, r], lastEvent: ['COURT_VERDICT_REVEALED'] }; }
export function transition(s: State, a: Action, now: number): State {
  if (expired(s, now)) throw new CourtError('انتهت المهلة', 409, 'TIMER_EXPIRED');
  switch (a.type) {
    case 'START_ROUND': phaseIs(s, 'READY'); return { ...s, phase: 'CASE_INTRO', lastEvent: ['COURT_ROUND_STARTED'] };
    case 'START_PREPARATION': phaseIs(s, 'CASE_INTRO'); return timed(s, 'PREPARATION', now, true);
    case 'ADVANCE_PHASE': return advance(s, now);
    case 'OPEN_VOTING': phaseIs(s, 'DEFENSE_ARGUMENT', 'PROSECUTION_REBUTTAL', 'DEFENSE_REBUTTAL'); return timed(s, 'JURY_VOTING', now);
    case 'ADVANCE_RESULT': phaseIs(s, 'VERDICT'); return { ...s, phase: 'ROUND_RESULTS', lastEvent: ['COURT_ROUND_COMPLETED'] };
    case 'NEXT_ROUND': phaseIs(s, 'ROUND_RESULTS'); return s.roundIndex + 1 === ROUND_COUNT ? { ...s, phase: 'FINAL_RESULTS', lastEvent: ['COURT_FINAL_RESULTS'] } : { ...s, phase: 'CASE_INTRO', roundIndex: s.roundIndex + 1, undo: [], lastEvent: ['COURT_ROUND_STARTED'] };
    case 'PAUSE': if (!(s.phase in TIMERS)) throw new CourtError('يمكن إيقاف الأطوار المؤقتة فقط'); return { ...s, phase: 'PAUSED', pausedAt: now, pausedPhase: s.phase as TimedPhase, remainingMs: Math.max(0, s.deadlineAt! - now), deadlineAt: null, lastEvent: ['COURT_GAME_PAUSED'] };
    case 'RESUME': phaseIs(s, 'PAUSED'); { const deadlineAt = now + s.remainingMs!; const shift = now - s.pausedAt!; return { ...s, phase: s.pausedPhase!, pausedPhase: null, remainingMs: null, pausedAt: null, deadlineAt, undo: s.undo.map(u => ({ ...u, deadlineAt: u.deadlineAt === null ? null : u.deadlineAt + shift })), lastEvent: ['COURT_GAME_RESUMED'] }; }
    case 'UNDO': if (s.phase === 'PAUSED' || !s.undo.length || ['JURY_VOTING', 'VERDICT', 'ROUND_RESULTS', 'FINAL_RESULTS', 'COMPLETED'].includes(s.phase)) throw new CourtError('لا يمكن التراجع بعد بدء التصويت', 409, 'UNSAFE_UNDO'); { const last = s.undo.at(-1)!; return { ...s, phase: last.phase, deadlineAt: last.deadlineAt, undo: s.undo.slice(0, -1), lastEvent: ['COURT_PHASE_UNDONE'] }; }
    case 'VOID_RESULT': phaseIs(s, 'VERDICT', 'ROUND_RESULTS'); { const r = s.results.at(-1); if (!r || r.voided) throw new CourtError('الحكم ملغى بالفعل'); return { ...s, scores: [s.scores[0] - r.deltas[0], s.scores[1] - r.deltas[1]], results: [...s.results.slice(0, -1), { ...r, voided: true }], lastEvent: ['COURT_RESULT_VOIDED'] }; }
    case 'COMPLETE': phaseIs(s, 'FINAL_RESULTS'); return { ...s, phase: 'COMPLETED', lastEvent: ['COURT_GAME_COMPLETED'] };
    case 'END_GAME': if (['LOBBY', 'COMPLETED', 'ABANDONED', 'FINAL_RESULTS'].includes(s.phase)) throw new CourtError('لا يمكن إنهاء هذه المرحلة'); return { ...s, phase: 'FINAL_RESULTS', deadlineAt: null, remainingMs: null, pausedPhase: null, undo: [], lastEvent: ['COURT_GAME_ENDED'] };
    case 'ABANDON': if (['COMPLETED', 'ABANDONED'].includes(s.phase)) throw new CourtError('انتهت المباراة'); return { ...s, phase: 'ABANDONED', deadlineAt: null, remainingMs: null, pausedPhase: null, undo: [], lastEvent: ['COURT_GAME_ABANDONED'] };
    default: throw new CourtError('يتطلب الإجراء معالجة الخادم', 400);
  }
}
export function winners(s: State) { return s.scores[0] === s.scores[1] ? [...s.teamIds] : [s.teamIds[s.scores[0] > s.scores[1] ? 0 : 1]]; }
export function shuffle<T>(items: T[], random: (max: number) => number): T[] { const a = [...items]; for (let i = a.length - 1; i > 0; i--) { const j = random(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function recentPool<T extends { id: string }>(bank: T[], recent: string[], random: (max: number) => number) { const used = new Set(recent); return [...shuffle(bank.filter(q => !used.has(q.id)), random), ...shuffle(bank.filter(q => used.has(q.id)), random)]; }
