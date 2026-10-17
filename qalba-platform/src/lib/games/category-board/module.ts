/** Category Board owns only rules. Database reads and writes belong to its service. */
export const BOARD_VALUES = [200, 400, 600] as const;
export const BOARD_TILES_PER_VALUE = 4;
export const BOARD_CELLS_PER_CATEGORY = BOARD_VALUES.length * BOARD_TILES_PER_VALUE;
export const BOARD_TOTAL_CELLS = 6 * BOARD_CELLS_PER_CATEGORY;
export type PowerSlug = "double" | "shield" | "remove-two" | "extra-time" | "challenge";
export type BoardCell = { key: string; categoryId: string; value: number; questionId: string; completed: boolean };
export type ActiveQuestion = {
  cellKey: string; questionId: string; originalTeamId: string; answeringTeamId: string;
  phase: "QUESTION" | "STEAL" | "CHALLENGE"; revealed: boolean;
  double: boolean; shield: boolean; removedOptions: number[];
  remainingMs: number; deadlineAt: string | null;
  resumeOnGameResume?: boolean;
};
export type UndoFrame = {
  active: ActiveQuestion | null; timerWasRunning: boolean; turnTeamId: string;
  cellKey: string | null; cellCompleted: boolean; completed: boolean;
  score?: { teamId: string; delta: number }; power?: { teamId: string; slug: PowerSlug };
};
export type BoardState = {
  schemaVersion: 1; started: boolean; paused: boolean; completed: boolean; endedEarly: boolean;
  categories: { id: string; title: string }[]; teamIds: string[]; turnTeamId: string;
  cells: BoardCell[]; questionSnapshots: Record<string, BoardQuestion>; active: ActiveQuestion | null; timerSeconds: number;
  lastJudgment: { active: ActiveQuestion; turnTeamId: string; scoreTeamId: string | null; delta: number } | null;
  lastManualScore: { teamId: string; delta: number } | null;
  undoStack?: UndoFrame[];
};
export type BoardCommand =
  | { type: "START" }
  | { type: "PAUSE_GAME" | "RESUME_GAME" | "END_GAME" }
  | { type: "EDIT_SCORE"; teamId: string; delta: number }
  | { type: "OPEN"; cellKey?: string; categoryId?: string; value?: number }
  | { type: "REVEAL" }
  | { type: "TIMER_START" | "TIMER_PAUSE" | "TIMER_RESET" }
  | { type: "CORRECT" | "WRONG" | "SKIP" | "UNDO" }
  | { type: "USE_POWERUP"; slug: PowerSlug }
  | { type: "RESOLVE_CHALLENGE"; accepted: boolean };

export type BoardQuestion = { id: string; question: string; type: string; answer: string; options: string[] | null;
  explanation: string | null; imageUrl: string | null };
export type BoardDecision = {
  state: BoardState; score?: { teamId: string; delta: number; reason: string };
  openedQuestionId?: string; roundEnded?: boolean; roundReopened?: boolean; usedPower?: PowerSlug;
  refundedPower?: { teamId: string; slug: PowerSlug };
};
export class GameRuleError extends Error {
  constructor(message: string, public readonly status = 409, public readonly code?: string) { super(message); }
}
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new GameRuleError(message);
}

export function initialBoardState(categories: BoardState["categories"], teamIds: string[], cells: BoardCell[],
  questionSnapshots: Record<string, BoardQuestion>, timerSeconds = 30): BoardState {
  // Only new 72-cell sessions call this constructor. Existing persisted 18-cell
  // sessions remain readable and playable through the backward-compatible OPEN.
  ensure(categories.length === 6 && teamIds.length === 2 && cells.length === BOARD_TOTAL_CELLS, "إعداد اللوحة غير مكتمل: يلزم ٧٢ سؤالًا");
  ensure(new Set(cells.map(cell => cell.key)).size === cells.length, "مفاتيح خانات اللوحة مكررة");
  ensure(new Set(cells.map(cell => cell.questionId)).size === cells.length, "سؤال مكرر في اللوحة");
  ensure(categories.every(category => BOARD_VALUES.every(value =>
    cells.filter(cell => cell.categoryId === category.id && cell.value === value).length === BOARD_TILES_PER_VALUE)),
    "يلزم أربع خانات مستقلة من كل مستوى لكل فئة");
  ensure(cells.every((cell) => questionSnapshots[cell.questionId]), "نصوص الأسئلة غير مكتملة");
  return { schemaVersion: 1, started: false, paused: false, completed: false, endedEarly: false,
    categories, teamIds, turnTeamId: teamIds[0], cells, questionSnapshots, active: null,
    timerSeconds, lastJudgment: null, lastManualScore: null, undoStack: [] };
}

function frame(state: BoardState, now: Date): UndoFrame {
  const active = state.active ? structuredClone(state.active) : null;
  const timerWasRunning = Boolean(active?.deadlineAt || active?.resumeOnGameResume);
  if (active?.deadlineAt) {
    active.remainingMs = Math.max(0, Date.parse(active.deadlineAt) - now.getTime());
    active.deadlineAt = null;
  }
  const cell = state.cells.find((item) => item.key === active?.cellKey);
  return { active, timerWasRunning, turnTeamId: state.turnTeamId, cellKey: cell?.key ?? null,
    cellCompleted: cell?.completed ?? false, completed: state.completed };
}

function remember(state: BoardState, previous: UndoFrame) {
  state.undoStack = [...(state.undoStack ?? []), previous].slice(-20);
  state.lastJudgment = null;
  state.lastManualScore = null;
}

export function timerRemaining(active: ActiveQuestion, now: Date): number {
  return active.deadlineAt ? Math.max(0, Date.parse(active.deadlineAt) - now.getTime()) : active.remainingMs;
}

function requireTime(active: ActiveQuestion, now: Date) {
  if (timerRemaining(active, now) <= 0) {
    throw new GameRuleError("انتهى الوقت. أعد ضبط المؤقت أو تخطّ السؤال", 409, "TIMER_EXPIRED");
  }
}

export function decideBoard(state: BoardState, command: BoardCommand, now: Date, context: {
  question?: BoardQuestion | null; powerRemaining?: number; powerSeconds?: number;
} = {}): BoardDecision {
  const next = structuredClone(state);
  if (command.type === "START") {
    ensure(!state.started, "بدأت هذه المباراة بالفعل");
    next.started = true;
    return { state: next };
  }
  ensure(state.started && (!state.completed || command.type === "UNDO" || command.type === "EDIT_SCORE"), "المباراة غير نشطة");
  if (command.type === "UNDO") {
    const recent = next.undoStack?.pop();
    if (recent) {
      ensure(!state.endedEarly || Boolean(recent.score), "لا يمكن التراجع عن إنهاء المباراة يدويًا");
      const wasCompleted = next.cells.find((cell) => cell.key === recent.cellKey)?.completed ?? false;
      if (recent.cellKey) next.cells.find((cell) => cell.key === recent.cellKey)!.completed = recent.cellCompleted;
      next.turnTeamId = recent.turnTeamId;
      next.completed = recent.completed;
      next.active = recent.active;
      if (next.active && recent.timerWasRunning && next.active.remainingMs > 0) {
        if (next.paused) next.active.resumeOnGameResume = true;
        else next.active.deadlineAt = new Date(now.getTime() + next.active.remainingMs).toISOString();
      }
      next.lastJudgment = null;
      next.lastManualScore = null;
      return { state: next, score: recent.score ? { ...recent.score, delta: -recent.score.delta, reason: "تراجع عن إجراء المضيف" } : undefined,
        refundedPower: recent.power, roundReopened: wasCompleted && !recent.cellCompleted };
    }
    if (next.lastManualScore) {
      const { teamId, delta } = next.lastManualScore;
      next.lastManualScore = null;
      return { state: next, score: { teamId, delta: -delta, reason: "تراجع عن تعديل النقاط" } };
    }
    ensure(!state.endedEarly, "لا يمكن التراجع عن إنهاء المباراة يدويًا");
    const prior = next.lastJudgment;
    ensure(prior, "لا يوجد قرار يمكن التراجع عنه");
    const cell = next.cells.find((item) => item.key === prior.active.cellKey)!;
    cell.completed = false;
    next.completed = false;
    next.turnTeamId = prior.turnTeamId;
    next.active = { ...prior.active, deadlineAt: null, remainingMs: prior.active.deadlineAt
      ? Math.max(0, new Date(prior.active.deadlineAt).getTime() - now.getTime()) : prior.active.remainingMs };
    next.lastJudgment = null;
    return { state: next, score: prior.scoreTeamId ? { teamId: prior.scoreTeamId, delta: -prior.delta, reason: "تراجع عن الحكم" } : undefined,
      roundReopened: true };
  }
  if (command.type === "END_GAME") {
    const hadActive = Boolean(next.active);
    next.active = null;
    next.completed = true;
    next.endedEarly = true;
    next.paused = false;
    next.lastJudgment = null;
    next.lastManualScore = null;
    next.undoStack = [];
    return { state: next, roundEnded: hadActive };
  }
  if (command.type === "PAUSE_GAME") {
    ensure(!next.paused, "المباراة متوقفة بالفعل");
    if (next.active?.deadlineAt) {
      next.active.remainingMs = Math.max(0, new Date(next.active.deadlineAt).getTime() - now.getTime());
      next.active.deadlineAt = null;
      next.active.resumeOnGameResume = next.active.remainingMs > 0;
    }
    next.paused = true;
    return { state: next };
  }
  if (command.type === "RESUME_GAME") {
    ensure(next.paused, "المباراة مستمرة بالفعل");
    next.paused = false;
    if (next.active?.resumeOnGameResume) {
      next.active.deadlineAt = new Date(now.getTime() + next.active.remainingMs).toISOString();
      next.active.resumeOnGameResume = false;
    }
    return { state: next };
  }
  if (command.type === "EDIT_SCORE") {
    ensure(next.teamIds.includes(command.teamId) && Number.isInteger(command.delta) &&
      command.delta !== 0 && Math.abs(command.delta) <= 10000, "تعديل النقاط غير صالح");
    const previous = frame(state, now);
    previous.score = { teamId: command.teamId, delta: command.delta };
    remember(next, previous);
    return { state: next, score: { teamId: command.teamId, delta: command.delta, reason: "تعديل المضيف للنقاط" } };
  }
  ensure(!next.paused, "المباراة متوقفة. استأنفها أولًا");
  if (command.type === "OPEN") {
    ensure(!next.active, "أكمل السؤال المفتوح أولًا");
    // Legacy 18-cell match clients can still send category/value; 72-cell
    // matches MUST name the exact tile so equally valued cells cannot collide.
    const matches = "cellKey" in command && command.cellKey
      ? next.cells.filter(item => item.key === command.cellKey)
      : next.cells.filter(item => item.categoryId === command.categoryId && item.value === command.value);
    ensure(matches.length === 1, "حدد خانة واحدة بعينها من اللوحة");
    const cell = matches[0];
    ensure(!cell.completed, "هذا السؤال مستخدم أو غير موجود");
    next.active = { cellKey: cell.key, questionId: cell.questionId, originalTeamId: next.turnTeamId,
      answeringTeamId: next.turnTeamId, phase: "QUESTION", revealed: false, double: false, shield: false,
      removedOptions: [], remainingMs: next.timerSeconds * 1000, deadlineAt: null };
    next.lastJudgment = null;
    next.lastManualScore = null;
    next.undoStack = [];
    return { state: next, openedQuestionId: cell.questionId };
  }
  const active = next.active;
  ensure(active, "افتح سؤالًا أولًا");
  if (command.type === "REVEAL") {
    ensure(!active.revealed, "الإجابة مكشوفة بالفعل");
    active.revealed = true;
    return { state: next };
  }
  if (command.type === "TIMER_START") {
    ensure(!active.deadlineAt && active.remainingMs > 0, "المؤقت يعمل أو انتهى");
    active.deadlineAt = new Date(now.getTime() + active.remainingMs).toISOString();
    active.resumeOnGameResume = false;
    return { state: next };
  }
  if (command.type === "TIMER_PAUSE") {
    ensure(active.deadlineAt, "المؤقت متوقف بالفعل");
    active.remainingMs = Math.max(0, new Date(active.deadlineAt).getTime() - now.getTime());
    active.deadlineAt = null;
    active.resumeOnGameResume = false;
    return { state: next };
  }
  if (command.type === "TIMER_RESET") {
    active.remainingMs = next.timerSeconds * 1000;
    active.deadlineAt = null;
    active.resumeOnGameResume = false;
    return { state: next };
  }
  if (command.type === "USE_POWERUP") {
    requireTime(active, now);
    ensure((context.powerRemaining ?? 0) > 0, "هذه القدرة غير متاحة للفريق");
    const previous = frame(state, now);
    const slug = command.slug;
    if (slug === "challenge") {
      ensure(active.phase === "STEAL", "الاعتراض متاح بعد إجابة الفريق الأولى الخاطئة فقط");
      active.phase = "CHALLENGE";
    } else {
      ensure(active.phase !== "CHALLENGE", "احسم الاعتراض أولًا");
      if (slug === "double") {
        ensure(active.phase === "QUESTION" && !active.revealed && !active.double, "لا يمكن المضاعفة الآن");
        active.double = true;
      } else if (slug === "shield") {
        ensure(active.phase === "QUESTION" && !active.revealed && !active.shield, "لا يمكن استخدام الدرع الآن");
        active.shield = true;
      } else if (slug === "remove-two") {
        ensure(active.phase === "QUESTION" && !active.revealed && !active.removedOptions.length, "لا يمكن حذف الخيارات الآن");
        const question = context.question;
        const options = question?.options;
        ensure(question?.type === "MULTIPLE_CHOICE" && Array.isArray(options) && options.length >= 3,
          "هذه القدرة للأسئلة متعددة الخيارات فقط");
        active.removedOptions = options.map((option, index) => option !== question.answer ? index : -1)
          .filter((index) => index >= 0).slice(0, 2);
        ensure(active.removedOptions.length === 2, "الخيارات غير صالحة للحذف");
      } else if (slug === "extra-time") {
        const seconds = context.powerSeconds ?? 15;
        ensure(Number.isInteger(seconds) && seconds >= 1 && seconds <= 120, "إعداد الوقت الإضافي غير صحيح");
        if (active.deadlineAt) active.deadlineAt = new Date(new Date(active.deadlineAt).getTime() + seconds * 1000).toISOString();
        else active.remainingMs += seconds * 1000;
      }
    }
    previous.power = { teamId: slug === "challenge" ? active.originalTeamId : active.answeringTeamId, slug };
    remember(next, previous);
    return { state: next, usedPower: slug };
  }
  if (command.type === "RESOLVE_CHALLENGE") {
    requireTime(active, now);
    ensure(active.phase === "CHALLENGE", "لا يوجد اعتراض مفتوح");
    if (!command.accepted) { const previous = frame(state, now); active.phase = "STEAL"; remember(next, previous); return { state: next }; }
    return finish(next, active, now, active.originalTeamId, active.double ? 2 : 1, "قبول الاعتراض");
  }
  ensure(active.phase !== "CHALLENGE", "احسم الاعتراض أولًا");
  if (command.type === "CORRECT" || command.type === "WRONG") requireTime(active, now);
  if (command.type === "CORRECT") return finish(next, active, now, active.answeringTeamId,
    active.answeringTeamId === active.originalTeamId && active.double ? 2 : 1, "إجابة صحيحة");
  if (command.type === "WRONG" && active.phase === "QUESTION" && !active.shield) {
    const previous = frame(state, now);
    active.phase = "STEAL";
    active.answeringTeamId = next.teamIds.find((id) => id !== active.originalTeamId)!;
    active.deadlineAt = null;
    active.remainingMs = next.timerSeconds * 1000;
    active.resumeOnGameResume = false;
    remember(next, previous);
    return { state: next };
  }
  if (command.type === "WRONG" || command.type === "SKIP") return finish(next, active, now, null, 0,
    command.type === "SKIP" ? "تخطي السؤال" : "إجابة خاطئة");
  throw new GameRuleError("أمر غير معروف", 400);
}

function finish(state: BoardState, active: ActiveQuestion, now: Date, scoreTeamId: string | null, multiplier: number, reason: string): BoardDecision {
  const cell = state.cells.find((item) => item.key === active.cellKey)!;
  const delta = scoreTeamId ? cell.value * multiplier : 0;
  const previous = frame(state, now);
  if (scoreTeamId) previous.score = { teamId: scoreTeamId, delta };
  remember(state, previous);
  cell.completed = true;
  state.active = null;
  state.turnTeamId = state.teamIds.find((id) => id !== state.turnTeamId)!;
  state.completed = state.cells.every((item) => item.completed);
  return { state, score: scoreTeamId ? { teamId: scoreTeamId, delta, reason } : undefined, roundEnded: true };
}
