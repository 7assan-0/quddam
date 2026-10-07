import { describe,expect,it } from "vitest";
import { ANSWER_MS,STEAL_MS,cellId,endGame,expireAnswer,freshMatch,generateBoard,lobby,neighbors,normalizeArabic,openQuestion,pause,resume,revealAnswer,resolveAnswer,selectCell,undo,validQuestionLetter,winningPath,type Cell,type LetterState } from "./module";
import { commandSchema,letterQuestionSchema } from "./validation";
import { letterSamples } from "../../../../prisma/letter-questions";
const counts={ا:10,ب:10,ج:10,د:10,ر:10,س:10,ك:10,م:10,ن:10,و:10};
const board=()=>generateBoard(counts,max=>max-1);
const ready=()=>freshMatch(lobby(),board(),["a","b"]);
const active=()=>openQuestion(selectCell(ready(),"r0c0","use-1","q-1"),1000);
const own=(ids:string[],team="a"):Cell[]=>board().map(c=>ids.includes(c.cellId)?{...c,ownerTeamId:team,state:team==="a"?"CAPTURED_TEAM_A":"CAPTURED_TEAM_B"}:c);
describe("Letter Network topology and generation",()=>{
  it("generates 25 unique physical cells and requires question availability",()=>{
    const cells=board();expect(cells).toHaveLength(25);expect(new Set(cells.map(c=>c.cellId)).size).toBe(25);
    expect(cells.every(c=>c.state==="AVAILABLE"&&c.ownerTeamId===null)).toBe(true);
    expect(()=>generateBoard({ا:7,ب:10,ج:10,د:10,ر:10})).toThrow();
  });
  it("excludes disabled and understocked letters and bounds frequency by available questions",()=>{
    const cells=generateBoard({...counts,ت:7,ذ:100},()=>0);
    expect(cells.some(c=>["ت","ذ"].includes(c.letter))).toBe(false);
    for(const letter of Object.keys(counts))expect(cells.filter(c=>c.letter===letter).length).toBeLessThanOrEqual(10);
  });
  it("weighted tickets favor the configured common-letter range",()=>{
    expect(generateBoard(counts,()=>0)[0].letter).toBe("ا");
    expect(generateBoard(counts,()=>6)[0].letter).toBe("ب");
  });
  it("starter content has ten valid original questions for every enabled seeded letter",()=>{
    expect(letterSamples).toHaveLength(100);
    for(const letter of Object.keys(counts))expect(letterSamples.filter(q=>q.letter===letter)).toHaveLength(10);
    expect(letterSamples.every(q=>validQuestionLetter(q.letter,[q.answer]))).toBe(true);
    expect(new Set(letterSamples.map(q=>q.question)).size).toBe(100);
  });
  it("gives each interior cell six symmetric neighbors and respects geometric edges",()=>{
    expect(neighbors(2,2)).toHaveLength(6);
    for(const c of board())for(const n of neighbors(c.row,c.col)){const other=board().find(x=>x.cellId===n)!;expect(neighbors(other.row,other.col)).toContain(c.cellId);}
    expect(neighbors(0,0)).toEqual(["r0c1","r1c0"]);
  });
  it("detects a direct left to right Team A path",()=>{
    expect(winningPath(own([0,1,2,3,4].map(c=>cellId(2,c))),"a",0)).toHaveLength(5);
  });
  it("detects a winding Team A path through hex neighbors",()=>{
    const ids=["r1c0","r1c1","r2c2","r2c3","r3c3","r3c4"];
    expect(winningPath(own(ids),"a",0)).toEqual(ids);
  });
  it("rejects a disconnected left/right false positive",()=>{
    expect(winningPath(own(["r0c0","r0c1","r4c3","r4c4"]),"a",0)).toEqual([]);
  });
  it("detects a direct top to bottom Team B path",()=>{
    expect(winningPath(own([0,1,2,3,4].map(r=>cellId(r,2)),"b"),"b",1)).toHaveLength(5);
  });
  it("detects a winding top to bottom Team B path",()=>{
    const ids=["r0c1","r1c0","r2c1","r3c1","r4c2"];
    expect(winningPath(own(ids,"b"),"b",1)).toEqual(ids);
  });
  it("includes offset diagonals but not a square-grid diagonal",()=>{
    expect(neighbors(1,1)).toContain("r2c2");expect(neighbors(2,1)).not.toContain("r3c2");
    expect(winningPath(own(["r0c0","r1c1","r2c2","r3c3","r4c4"]),"a",0)).toEqual([]);
  });
  it("an enemy cell breaks a route",()=>{
    const cells=own(["r2c0","r2c1","r2c2","r2c3","r2c4"]);
    cells[12]={...cells[12],ownerTeamId:"b",state:"CAPTURED_TEAM_B"};
    expect(winningPath(cells,"a",0)).toEqual([]);
  });
  it("one missing cell prevents victory",()=>{
    expect(winningPath(own(["r2c0","r2c1","r2c3","r2c4"]),"a",0)).toEqual([]);
  });
  it("full and empty boards return real edge-to-edge paths",()=>{
    for(const position of [0,1] as const){const full=board().map(c=>({...c,ownerTeamId:"a"}));const path=winningPath(full,"a",position);
      expect(path).toHaveLength(5);expect(full.find(c=>c.cellId===path[0])![position===0?"col":"row"]).toBe(0);expect(full.find(c=>c.cellId===path.at(-1))![position===0?"col":"row"]).toBe(4);}
    expect(winningPath(board(),"a",0)).toEqual([]);
  });
});
describe("Letter Network state, timer and undo",()=>{
  it("persists explicit two-team order and starts Team A",()=>{
    expect(ready()).toMatchObject({teamIds:["a","b"],activeTeamIndex:0,phase:"READY"});
    expect(()=>freshMatch(lobby(),board(),["a"])).toThrow();expect(()=>freshMatch(lobby(),board(),["a","a"])).toThrow();
  });
  it("selects one cell, then opens exactly one question with a server deadline",()=>{
    const state=active();expect(state.phase).toBe("QUESTION_ACTIVE");expect(state.deadlineAt).toBe(new Date(1000+ANSWER_MS).toISOString());
    expect(state.board[0].state).toBe("ACTIVE");expect(()=>selectCell(state,"r0c1","u","q")).toThrow();expect(()=>openQuestion(state,2000)).toThrow();
  });
  it("rejects captured or nonexistent cells",()=>{
    const state=resolveAnswer(active(),"CORRECT",2000);
    expect(()=>selectCell(state,"r0c0","u","q")).toThrow();expect(()=>selectCell(ready(),"bad","u","q")).toThrow();
  });
  it("correct answer captures for active team and alternates",()=>{
    expect(resolveAnswer(active(),"CORRECT",2000)).toMatchObject({phase:"READY",activeTeamIndex:1,activeCellId:null});
    expect(resolveAnswer(active(),"CORRECT",2000).board[0]).toMatchObject({ownerTeamId:"a",state:"CAPTURED_TEAM_A",completedAt:new Date(2000).toISOString()});
  });
  it("wrong answer creates one 15-second opposing steal opportunity",()=>{
    const state=resolveAnswer(active(),"WRONG",2000);
    expect(state).toMatchObject({phase:"STEAL",activeTeamIndex:0,remainingMs:STEAL_MS});
    expect(state.deadlineAt).toBe(new Date(2000+STEAL_MS).toISOString());
    expect(()=>resolveAnswer(state,"WRONG",3000)).toThrow();
  });
  it("steal success captures for opponent and next regular turn remains opponent",()=>{
    const state=resolveAnswer(resolveAnswer(active(),"WRONG",2000),"STEAL_CORRECT",3000);
    expect(state.board[0].ownerTeamId).toBe("b");expect(state.activeTeamIndex).toBe(1);
  });
  it("both failures consume the question but return the cell to available",()=>{
    const state=resolveAnswer(resolveAnswer(active(),"WRONG",2000),"STEAL_WRONG",3000);
    expect(state.board[0]).toMatchObject({state:"AVAILABLE",ownerTeamId:null,questionId:null});expect(state.lastUseId).toBe("use-1");
    expect(selectCell(state,"r0c0","use-2","q-2").board[0].questionId).toBe("q-2");
  });
  it("rejects wrong-phase results, reveals and resume actions",()=>{
    expect(()=>resolveAnswer(ready(),"CORRECT",0)).toThrow();expect(()=>resolveAnswer(active(),"STEAL_CORRECT",2000)).toThrow();
    expect(()=>revealAnswer(ready())).toThrow();expect(()=>resume(active(),2000)).toThrow();
  });
  it("answer reveal is explicit and cannot be repeated",()=>{
    const revealed=revealAnswer(active());expect(revealed.revealed).toBe(true);expect(()=>revealAnswer(revealed)).toThrow();
    expect(resolveAnswer(revealed,"WRONG",2000).revealed).toBe(false);
  });
  it("rejects late answer judgments at the exact deadline and early expiry",()=>{
    expect(()=>resolveAnswer(active(),"CORRECT",31_000)).toThrow("انتهى");expect(()=>expireAnswer(active(),30_999)).toThrow();
    expect(expireAnswer(active(),31_000).phase).toBe("STEAL");
  });
  it("expiring both windows returns the cell safely and cannot resolve it twice",()=>{
    const steal=expireAnswer(active(),31_000);const state=expireAnswer(steal,46_000);
    expect(state).toMatchObject({phase:"READY",activeTeamIndex:1});expect(state.board[0].state).toBe("AVAILABLE");expect(()=>expireAnswer(state,50_000)).toThrow();
  });
  it("pause/resume preserves selected cell, question, turn, history and remaining timer",()=>{
    const source=resolveAnswer(active(),"WRONG",2000),stopped=pause(source,5000),next=resume(stopped,100_000);
    expect(stopped).toMatchObject({phase:"PAUSED",pausedPhase:"STEAL",deadlineAt:null,remainingMs:12_000});
    expect(next).toMatchObject({phase:"STEAL",activeUseId:"use-1",activeCellId:"r0c0",activeTeamIndex:0,history:source.history});
    expect(next.deadlineAt).toBe(new Date(112_000).toISOString());
  });
  it("pause/resume also preserves untimed selected and ready states",()=>{
    for(const source of [ready(),selectCell(ready(),"r0c0","u","q")])expect(resume(pause(source,1000),100_000)).toMatchObject({phase:source.phase,deadlineAt:null,activeCellId:source.activeCellId});
  });
  it("undo capture restores cell, active question, turn and remaining time",()=>{
    const state=undo(resolveAnswer(active(),"CORRECT",7000),100_000);
    expect(state).toMatchObject({phase:"QUESTION_ACTIVE",activeCellId:"r0c0",activeTeamIndex:0,activeUseId:"use-1",winnerTeamId:null,winningPath:[]});
    expect(state.board[0].state).toBe("ACTIVE");expect(state.deadlineAt).toBe(new Date(124_000).toISOString());
  });
  it("undo wrong and steal results restores the exact preceding phase",()=>{
    const steal=resolveAnswer(active(),"WRONG",2000);
    expect(undo(steal,9000).phase).toBe("QUESTION_ACTIVE");
    for(const result of ["STEAL_CORRECT","STEAL_WRONG"] as const){const restored=undo(resolveAnswer(steal,result,3000),10_000);expect(restored).toMatchObject({phase:"STEAL",activeCellId:"r0c0",activeTeamIndex:0});expect(restored.deadlineAt).toBe(new Date(24_000).toISOString());}
  });
  it("undo winning move reopens the game and removes winner/path",()=>{
    const source:LetterState={...active(),board:own(["r0c1","r0c2","r0c3","r0c4"]).map(c=>c.cellId==="r0c0"?{...c,state:"ACTIVE",questionId:"q-1"}:c)};
    const result=resolveAnswer(source,"CORRECT",2000);expect(result).toMatchObject({phase:"RESULTS",winnerTeamId:"a"});expect(result.winningPath).toHaveLength(5);
    const restored=undo(result,9000);expect(restored).toMatchObject({phase:"QUESTION_ACTIVE",winnerTeamId:null,winningPath:[]});expect(restored.board[0].ownerTeamId).toBeNull();
  });
  it("manual end is undoable, including from paused steal",()=>{
    const source=pause(resolveAnswer(active(),"WRONG",2000),3000);const result=endGame(source,4000);
    expect(result).toMatchObject({phase:"RESULTS",winnerTeamId:null});expect(undo(result,5000)).toMatchObject({phase:"PAUSED",pausedPhase:"STEAL",remainingMs:14_000,deadlineAt:null});
  });
  it("rematch resets ownership, winner, timer and undo but preserves team order",()=>{
    const result={...ready(),phase:"COMPLETED" as const,winnerTeamId:"a",winningPath:["r0c0"]};
    const next=freshMatch(result,generateBoard(counts,()=>0),result.teamIds);
    expect(next).toMatchObject({phase:"READY",matchNumber:2,teamIds:["a","b"],activeTeamIndex:0,winnerTeamId:null,winningPath:[],history:[],deadlineAt:null});
    expect(next.board.every(c=>c.ownerTeamId===null)).toBe(true);expect(next.board.map(c=>c.letter)).not.toEqual(result.board.map(c=>c.letter));
  });
});
describe("Letter Network Arabic and payload validation",()=>{
  it("normalizes harmless diacritics, alif and maqsura without merging distinct endings",()=>{
    expect(normalizeArabic("  إِبْرَة  ")).toBe("ابرة");expect(normalizeArabic("آلـة")).toBe("الة");expect(normalizeArabic("فتى")).toBe("فتي");
    expect(normalizeArabic("مدرسة")).not.toBe(normalizeArabic("مدرسه"));expect(normalizeArabic("أ ب")).not.toBe(normalizeArabic("أب"));
  });
  it("requires primary and alternative answers to start with configured letter",()=>{
    expect(validQuestionLetter("ا",["إبرة","أداة"])).toBe(true);expect(validQuestionLetter("ب",["باب","نافذة"])).toBe(false);
    expect(validQuestionLetter("ab",["abc"])).toBe(false);expect(validQuestionLetter("ب",[])).toBe(false);
    const q={letter:"ب",question:"ما الشيء الذي يفتح؟",answer:"باب",alternativeAnswers:[],categoryId:"cat",difficulty:"EASY",status:"PUBLISHED"};
    expect(letterQuestionSchema.safeParse(q).success).toBe(true);expect(letterQuestionSchema.safeParse({...q,answer:"نافذة"}).success).toBe(false);
  });
  it("rejects client ownership, answer, timer and winning-path fields",()=>{
    const command={key:"d2d293e6-c153-4e7f-b31d-d5885515c010",expectedVersion:2,action:{type:"SELECT_CELL",cellId:"r0c0"}};
    expect(commandSchema.safeParse(command).success).toBe(true);
    expect(commandSchema.safeParse({...command,action:{...command.action,ownerTeamId:"a"}}).success).toBe(false);
    expect(commandSchema.safeParse({...command,winningPath:["r0c0"]}).success).toBe(false);
  });
});
