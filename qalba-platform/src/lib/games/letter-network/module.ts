import { randomInt } from "node:crypto";
export const SIZE = 5;
export const ANSWER_MS = 30_000;
export const STEAL_MS = 15_000;
export const LETTER_WEIGHTS: Record<string, number> = { ا:6, ب:5, ج:3, د:3, ر:4, س:5, ك:4, م:6, ن:5, و:3, ت:3, ح:2, ش:3, ص:1, ط:1, ع:4, ف:3, ق:3, ل:4, ه:3, ي:3, ث:1, خ:2, ذ:1, ز:2, ض:1, ظ:1, غ:2 };
export type Phase = "LOBBY" | "READY" | "CELL_SELECTED" | "QUESTION_ACTIVE" | "STEAL" | "PAUSED" | "RESULTS" | "COMPLETED" | "ABANDONED";
export type TeamPosition = 0 | 1;
export type Cell = { cellId:string; row:number; col:number; letter:string; state:"AVAILABLE" | "ACTIVE" | "CAPTURED_TEAM_A" | "CAPTURED_TEAM_B"; ownerTeamId:string|null; questionId:string|null; completedAt:string|null };
export type Snapshot = Omit<LetterState, "history"> & { remainingAtSnapshot:number };
export type LetterState = { schemaVersion:1; phase:Phase; pausedPhase:Phase|null; matchNumber:number; board:Cell[]; teamIds:string[];
  activeTeamIndex:TeamPosition; activeCellId:string|null; activeUseId:string|null; lastUseId:string|null; revealed:boolean; deadlineAt:string|null; remainingMs:number;
  winnerTeamId:string|null; winningPath:string[]; lastEvent:string[]; history:Snapshot[] };
export class LetterError extends Error { constructor(message:string, public status=409, public code="INVALID_GAME_ACTION") { super(message); } }
export const cellId = (row:number,col:number) => "r"+row+"c"+col;
export const normalizeArabic = (value:string) => value.trim().replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g,"").replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/\s+/g," ");
export function validQuestionLetter(letter:string, answers:string[]) {
  const initial=normalizeArabic(letter); return [...initial].length===1 && /^[ابتثجحخدذرزسشصضطظعغفقكلمنهوي]$/.test(initial) && answers.length>0 && answers.every(answer => normalizeArabic(answer)[0]===initial);
}
export function neighbors(row:number,col:number) {
  const offsets=row%2===0 ? [-1,0] : [0,1];
  return [[row,col-1],[row,col+1],...[-1,1].flatMap(d=>offsets.map(c=>[row+d,col+c]))]
    .filter(([r,c])=>r>=0&&r<SIZE&&c>=0&&c<SIZE).map(([r,c])=>cellId(r,c));
}
/** BFS on physical coordinates; never infer edges from RTL presentation. */
export function winningPath(board:Cell[], teamId:string, position:TeamPosition):string[] {
  const owned=new Map(board.filter(c=>c.ownerTeamId===teamId).map(c=>[c.cellId,c]));
  const queue=[...owned.values()].filter(c=>position===0?c.col===0:c.row===0).map(c=>c.cellId);
  const parent=new Map<string,string|null>(queue.map(id=>[id,null]));
  for(let i=0;i<queue.length;i++){
    const id=queue[i], cell=owned.get(id)!;
    if(position===0?cell.col===SIZE-1:cell.row===SIZE-1){
      const path:string[]=[]; let current:string|null=id;
      while(current){path.unshift(current);current=parent.get(current)??null;} return path;
    }
    for(const next of neighbors(cell.row,cell.col)) if(owned.has(next)&&!parent.has(next)){parent.set(next,id);queue.push(next);}
  } return [];
}
export function generateBoard(counts:Record<string,number>, choose:(max:number)=>number=randomInt):Cell[] {
  const eligible=Object.entries(counts).filter(([letter,count])=>count>=8&&(LETTER_WEIGHTS[letter]??0)>0);
  if(eligible.length<5||eligible.reduce((sum,[,n])=>sum+n,0)<25) throw new LetterError("بنك الحروف لا يحتوي أسئلة منشورة كافية",409,"QUESTION_BANK_TOO_SMALL");
  const used:Record<string,number>={};
  return Array.from({length:25},(_,index)=>{
    const options=eligible.filter(([letter,n])=>(used[letter]??0)<n);
    let ticket=choose(options.reduce((sum,[letter])=>sum+LETTER_WEIGHTS[letter],0));
    const letter=options.find(([l])=>(ticket-=LETTER_WEIGHTS[l])<0)![0]; used[letter]=(used[letter]??0)+1;
    const row=Math.floor(index/5),col=index%5;
    return {cellId:cellId(row,col),row,col,letter,state:"AVAILABLE",ownerTeamId:null,questionId:null,completedAt:null};
  });
}
export function lobby():LetterState {return {schemaVersion:1,phase:"LOBBY",pausedPhase:null,matchNumber:0,board:[],teamIds:[],activeTeamIndex:0,activeCellId:null,activeUseId:null,lastUseId:null,revealed:false,deadlineAt:null,remainingMs:0,winnerTeamId:null,winningPath:[],lastEvent:[],history:[]};}
export function assertPhase(state:LetterState,...phases:Phase[]) {if(!phases.includes(state.phase)) throw new LetterError("الإجراء غير متاح في مرحلة "+state.phase,409,"INVALID_PHASE");}
export function freshMatch(previous:LetterState,board:Cell[],teamIds:string[]):LetterState {
  assertPhase(previous,"LOBBY","COMPLETED");
  if(teamIds.length!==2||teamIds[0]===teamIds[1]) throw new LetterError("المباراة تحتاج فريقين مختلفين",400);
  return {...lobby(),phase:"READY",matchNumber:previous.matchNumber+1,board,teamIds,lastEvent:["GAME_STARTED","TURN_CHANGED"]};
}
export function selectCell(state:LetterState,id:string,useId:string,questionId:string):LetterState {
  assertPhase(state,"READY"); const cell=state.board.find(c=>c.cellId===id);
  if(!cell||cell.state!=="AVAILABLE") throw new LetterError("الخلية غير متاحة",409,"CELL_UNAVAILABLE");
  return {...state,phase:"CELL_SELECTED",board:state.board.map(c=>c.cellId===id?{...c,state:"ACTIVE",questionId}:c),activeCellId:id,activeUseId:useId,lastUseId:null,revealed:false,lastEvent:["CELL_SELECTED"]};
}
export function openQuestion(state:LetterState,now:number):LetterState {assertPhase(state,"CELL_SELECTED"); return {...state,phase:"QUESTION_ACTIVE",deadlineAt:new Date(now+ANSWER_MS).toISOString(),remainingMs:ANSWER_MS,lastEvent:["QUESTION_OPENED","TIMER_STARTED"]};}
export function revealAnswer(state:LetterState):LetterState {assertPhase(state,"QUESTION_ACTIVE","STEAL");if(state.revealed)throw new LetterError("كُشفت الإجابة بالفعل");return {...state,revealed:true,lastEvent:["ANSWER_REVEALED"]};}
function snapshot(state:LetterState,now:number):Snapshot {
  const {history:ignored,...current}=state;void ignored;
  return {...current,remainingAtSnapshot:current.deadlineAt?Math.max(0,new Date(current.deadlineAt).getTime()-now):current.remainingMs};
}
function judge(state:LetterState,result:"CORRECT"|"WRONG"|"STEAL_CORRECT"|"STEAL_WRONG",now:number,timeout:boolean):LetterState {
  const steal=result.startsWith("STEAL_");assertPhase(state,steal?"STEAL":"QUESTION_ACTIVE");
  if(!state.activeCellId||!state.activeUseId||!state.deadlineAt)throw new LetterError("لا يوجد سؤال نشط");
  if(!timeout&&now>=new Date(state.deadlineAt).getTime())throw new LetterError("انتهى وقت الإجابة",409,"TIMER_EXPIRED");
  const before=snapshot(state,now);if(timeout)before.remainingAtSnapshot=steal?STEAL_MS:ANSWER_MS;
  const history=[...state.history,before].slice(-25);
  if(result==="WRONG")return {...state,phase:"STEAL",deadlineAt:new Date(now+STEAL_MS).toISOString(),remainingMs:STEAL_MS,revealed:false,history,lastEvent:["ANSWER_WRONG","STEAL_STARTED","TIMER_STARTED"]};
  const captured=result==="CORRECT"||result==="STEAL_CORRECT";
  const position=(result==="STEAL_CORRECT"?1-state.activeTeamIndex:state.activeTeamIndex) as TeamPosition;
  const owner=captured?state.teamIds[position]:null;
  const board=state.board.map(c=>c.cellId===state.activeCellId?{...c,state:(captured?(position===0?"CAPTURED_TEAM_A":"CAPTURED_TEAM_B"):"AVAILABLE") as Cell["state"],ownerTeamId:owner,questionId:captured?c.questionId:null,completedAt:captured?new Date(now).toISOString():null}:c);
  const path=owner?winningPath(board,owner,position):[];
  return {...state,phase:path.length?"RESULTS":"READY",board,activeCellId:null,activeUseId:null,lastUseId:state.activeUseId,revealed:false,deadlineAt:null,remainingMs:0,activeTeamIndex:(1-state.activeTeamIndex) as TeamPosition,winnerTeamId:path.length?owner:null,winningPath:path,history,lastEvent:[...(captured?["ANSWER_CORRECT","CELL_CAPTURED"]:["ANSWER_WRONG"]),...(path.length?["WIN_PATH_COMPLETED"]:["TURN_CHANGED"])]};
}
export function resolveAnswer(state:LetterState,result:"CORRECT"|"WRONG"|"STEAL_CORRECT"|"STEAL_WRONG",now:number) {return judge(state,result,now,false);}
export function expireAnswer(state:LetterState,now:number):LetterState {
  assertPhase(state,"QUESTION_ACTIVE","STEAL");if(!state.deadlineAt||now<new Date(state.deadlineAt).getTime())throw new LetterError("المهلة لم تنتهِ بعد",409,"TIMER_NOT_EXPIRED");
  return judge(state,state.phase==="STEAL"?"STEAL_WRONG":"WRONG",now,true);
}
export function pause(state:LetterState,now:number):LetterState {
  assertPhase(state,"READY","CELL_SELECTED","QUESTION_ACTIVE","STEAL");
  if(state.deadlineAt&&now>=new Date(state.deadlineAt).getTime())throw new LetterError("انتهى وقت الإجابة",409,"TIMER_EXPIRED");
  return {...state,phase:"PAUSED",pausedPhase:state.phase,remainingMs:state.deadlineAt?Math.max(0,new Date(state.deadlineAt).getTime()-now):0,deadlineAt:null,lastEvent:["GAME_PAUSED"]};
}
export function resume(state:LetterState,now:number):LetterState {assertPhase(state,"PAUSED");if(!state.pausedPhase)throw new LetterError("حالة الإيقاف غير مكتملة");
  const timed=["QUESTION_ACTIVE","STEAL"].includes(state.pausedPhase);
  return {...state,phase:state.pausedPhase,pausedPhase:null,deadlineAt:timed?new Date(now+state.remainingMs).toISOString():null,lastEvent:["GAME_RESUMED",...(timed?["TIMER_STARTED"]:[])]};
}
export function undo(state:LetterState,now:number):LetterState {assertPhase(state,"READY","STEAL","RESULTS");const previous=state.history.at(-1);if(!previous)throw new LetterError("لا توجد خطوة قابلة للتراجع");
  const {remainingAtSnapshot,...restored}=previous;
  return {...restored,deadlineAt:restored.deadlineAt?new Date(now+remainingAtSnapshot).toISOString():null,remainingMs:remainingAtSnapshot,history:state.history.slice(0,-1),lastEvent:["GAME_UNDONE"]};
}
export function endGame(state:LetterState,now:number):LetterState {assertPhase(state,"READY","CELL_SELECTED","QUESTION_ACTIVE","STEAL","PAUSED");
  return {...state,phase:"RESULTS",pausedPhase:null,deadlineAt:null,winnerTeamId:null,winningPath:[],history:[...state.history,snapshot(state,now)].slice(-25),lastEvent:["GAME_ENDED_MANUALLY"]};
}
