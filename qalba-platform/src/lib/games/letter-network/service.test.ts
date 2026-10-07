import { beforeEach,describe,expect,it,vi } from "vitest";
import { freshMatch,generateBoard,lobby,openQuestion,selectCell } from "./module";
import { questionPool } from "./questions";
const mock=vi.hoisted(()=>({session:vi.fn(),access:vi.fn(),use:vi.fn()}));
vi.mock("@/lib/db",()=>({db:()=>({gameSession:{findUnique:mock.session},displayAccess:{findUnique:mock.access},letterQuestionUse:{findUnique:mock.use}})}));
import { getLetterView } from "./service";
const active=()=>openQuestion(selectCell(freshMatch(lobby(),generateBoard({ا:10,ب:10,ج:10,د:10,ر:10},()=>0),["a","b"]),"r0c0","use","question"),Date.now());
beforeEach(()=>{
  vi.clearAllMocks();
  mock.session.mockResolvedValue({id:"match",hostId:"host",gameType:{slug:"letter-network"},state:{...active(),history:[{privateSentinel:"not-for-public"}]},stateVersion:4,endedAt:null,teams:[{id:"a",name:"أول",color:"#F24C74",position:0},{id:"b",name:"ثان",color:"#29C7C9",position:1}],displayAccesses:[]});
  mock.access.mockResolvedValue({sessionId:"match",expiresAt:new Date(Date.now()+100_000),revokedAt:null});
  mock.use.mockResolvedValue({questionId:"question",questionSnapshot:"أي مدينة تقع في جنوب السعودية؟",answerSnapshot:"أبها",alternativesSnapshot:["ابها"]});
});
describe("Letter Network projections and question history",()=>{
  it("TV receives no answer, alternatives, undo history or unused question bank",async()=>{
    const view=await getLetterView("match",{kind:"DISPLAY",token:"a".repeat(43)});
    expect(view.question?.text).toContain("مدينة");expect(JSON.stringify(view)).not.toMatch(/أبها|ابها|alternativeAnswers|history|not-for-public/);
    expect(view.displayAccess).toBeUndefined();expect(view.canUndo).toBe(false);
  });
  it("host also receives no answer until an explicit reveal",async()=>{
    expect(JSON.stringify(await getLetterView("match",{kind:"HOST",id:"host"}))).not.toContain("أبها");
  });
  it("even a host-revealed answer never reaches TV during the active/steal question",async()=>{
    const session=await mock.session();session.state.revealed=true;session.state.phase="STEAL";mock.session.mockResolvedValue(session);
    const host=await getLetterView("match",{kind:"HOST",id:"host"}),tv=await getLetterView("match",{kind:"DISPLAY",token:"a".repeat(43)});
    expect(host.question).toMatchObject({answer:"أبها",alternativeAnswers:["ابها"]});
    expect(JSON.stringify(tv)).not.toContain("أبها");expect(tv.answeringTeamId).toBe("b");
  });
  it("wrong host or cross-session/revoked/expired display tokens are rejected",async()=>{
    await expect(getLetterView("match",{kind:"HOST",id:"other"})).rejects.toMatchObject({status:403});
    for(const access of [{sessionId:"other",expiresAt:new Date(Date.now()+10000),revokedAt:null},{sessionId:"match",expiresAt:new Date(Date.now()-1),revokedAt:null},{sessionId:"match",expiresAt:new Date(Date.now()+10000),revokedAt:new Date()}]){
      mock.access.mockResolvedValue(access);await expect(getLetterView("match",{kind:"DISPLAY",token:"a".repeat(43)})).rejects.toMatchObject({status:403});
    }
  });
  it("selection does not expose unopened questions and refresh restores only authorized state",async()=>{
    const session=await mock.session();session.state.phase="CELL_SELECTED";mock.session.mockResolvedValue(session);
    const view=await getLetterView("match",{kind:"HOST",id:"host"});expect(view.question).toBeNull();expect(view.activeCellId).toBe("r0c0");
    expect(mock.use).not.toHaveBeenCalled();
  });
  it("resolved answers may be public, while the next selection removes the previous answer",async()=>{
    const session=await mock.session();session.state={...session.state,phase:"READY",activeUseId:null,lastUseId:"use"};mock.session.mockResolvedValue(session);
    expect((await getLetterView("match",{kind:"DISPLAY",token:"a".repeat(43)})).lastAnswer?.answer).toBe("أبها");
    session.state.lastUseId=null;session.state.phase="CELL_SELECTED";mock.session.mockResolvedValue(session);
    expect((await getLetterView("match",{kind:"DISPLAY",token:"a".repeat(43)})).lastAnswer).toBeNull();
  });
  it("never repeats current-match questions even when recent history is exhausted",()=>{
    const questions=[{id:"a"},{id:"b"},{id:"c"}];
    expect(questionPool(questions,["a"],["b"])).toEqual([{id:"c"}]);
    expect(questionPool(questions,["a"],["b","c"])).toEqual([{id:"b"},{id:"c"}]);
    expect(()=>questionPool(questions,["a","b","c"],[])).toThrow("نفدت");
  });
  it("recent host-account questions are avoided whenever a fresh candidate exists",()=>{
    expect(questionPool([{id:"a"},{id:"b"}],[],["a"])).toEqual([{id:"b"}]);
  });
});
