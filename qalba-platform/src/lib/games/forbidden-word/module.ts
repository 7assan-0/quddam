/** Pure Forbidden Word rules. Text lives only in server-side card snapshots. */
export type Phase="LOBBY"|"READY"|"ROUND_INTRO"|"CARD_ACTIVE"|"PAUSED"|"ROUND_RESULTS"|"FINAL_RESULTS"|"COMPLETED"|"ABANDONED";
export type Judgment="CORRECT"|"SKIP"|"FOUL";
export type Action={type:"START"|"PREPARE_ROUND"|"START_ROUND"|Judgment|"END_ROUND"|"NEXT_ROUND"|"PAUSE"|"RESUME"|"UNDO"|"COMPLETE"|"REMATCH"|"ABANDON"};
export type Card={targetWord:string;forbiddenWords:string[]};
export type Outcome={useId:string;roundIndex:number;result:Judgment;delta:number;at:string};
export type State={schemaVersion:1;module:"FORBIDDEN_WORD";phase:Phase;pausedPhase:Phase|null;matchNumber:number;teamIds:string[];scores:number[];roundIndex:number;roundCount:number;roundMs:number;useIds:string[];cardIndex:number;deadlineAt:string|null;remainingMs:number;roundStartScore:number;outcomes:Outcome[];winnerTeamId:string|null;endReason:"TIMEOUT"|"CONTENT_EXHAUSTED"|null;lastEvent:string[]};
export class ForbiddenWordError extends Error{constructor(message:string,public status=409,public code="INVALID_FORBIDDEN_ACTION"){super(message);}}
export function normalizeArabic(value:string){return value.normalize("NFC").replace(/[\u064b-\u065f\u0670\u0640]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").trim().replace(/\s+/g," ").toLowerCase();}
export function validCard(card:Card){const target=normalizeArabic(card.targetWord),terms=card.forbiddenWords.map(normalizeArabic);return Boolean(target)&&terms.length>=3&&terms.length<=6&&terms.every(t=>t&&t!==target)&&new Set(terms).size===terms.length;}
export function orderedPool<T extends {id:string}>(cards:T[],recent:string[],choose:(max:number)=>number):T[]{
  const shuffle=(items:T[])=>{const result=[...items];for(let i=result.length-1;i>0;i--){const j=choose(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;};
  return [...shuffle(cards.filter(c=>!recent.includes(c.id))),...shuffle(cards.filter(c=>recent.includes(c.id)))];
}
export function lobby():State{return {schemaVersion:1,module:"FORBIDDEN_WORD",phase:"LOBBY",pausedPhase:null,matchNumber:0,teamIds:[],scores:[0,0],roundIndex:0,roundCount:6,roundMs:60_000,useIds:[],cardIndex:0,deadlineAt:null,remainingMs:0,roundStartScore:0,outcomes:[],winnerTeamId:null,endReason:null,lastEvent:[]};}
export function assertPhase(state:State,...phases:Phase[]){if(!phases.includes(state.phase))throw new ForbiddenWordError("الإجراء غير متاح في هذه المرحلة",409,"INVALID_PHASE");}
export function freshMatch(previous:State,teamIds:string[],useIds:string[],roundMs=60_000):State{
  assertPhase(previous,"LOBBY","COMPLETED");
  if(teamIds.length!==2||teamIds[0]===teamIds[1]||!useIds.length||new Set(useIds).size!==useIds.length||![30_000,45_000,60_000,90_000].includes(roundMs))throw new ForbiddenWordError("إعداد المباراة غير صالح",400);
  return {...lobby(),phase:"READY",matchNumber:previous.matchNumber+1,teamIds:[...teamIds],useIds:[...useIds],roundMs,lastEvent:["GAME_STARTED","TURN_CHANGED"]};
}
export function currentUse(state:State){return state.useIds[state.cardIndex]??null;}
export function remaining(state:State,now:number){return state.deadlineAt?Math.max(0,Date.parse(state.deadlineAt)-now):state.remainingMs;}
export function expired(state:State,now:number){return state.phase==="CARD_ACTIVE"&&Boolean(state.deadlineAt)&&now>=Date.parse(state.deadlineAt!);}
export function roundSummary(state:State){const outcomes=state.outcomes.filter(o=>o.roundIndex===state.roundIndex);return {correct:outcomes.filter(o=>o.result==="CORRECT").length,skips:outcomes.filter(o=>o.result==="SKIP").length,fouls:outcomes.filter(o=>o.result==="FOUL").length,completed:outcomes.length,roundScore:state.scores[state.roundIndex%2]-state.roundStartScore};}
export function timeout(state:State,now:number):State{assertPhase(state,"CARD_ACTIVE");if(!expired(state,now))throw new ForbiddenWordError("مهلة الجولة لم تنتهِ",409,"TIMER_NOT_EXPIRED");return {...state,phase:"ROUND_RESULTS",deadlineAt:null,remainingMs:0,endReason:"TIMEOUT",lastEvent:["ROUND_ENDED"]};}
export function transition(state:State,action:Action,now:number):State{
  if(action.type==="START"||action.type==="REMATCH")throw new ForbiddenWordError("يلزم تجهيز البطاقات من الخادم");
  if(action.type==="ABANDON"){if(["COMPLETED","ABANDONED"].includes(state.phase))throw new ForbiddenWordError("المباراة منتهية");return {...state,phase:"ABANDONED",pausedPhase:null,deadlineAt:null,lastEvent:["GAME_ABANDONED"]};}
  if(expired(state,now)&&action.type!=="END_ROUND")throw new ForbiddenWordError("انتهى وقت الجولة",409,"TIMER_EXPIRED");
  switch(action.type){
    case "PREPARE_ROUND":assertPhase(state,"READY");return {...state,phase:"ROUND_INTRO",lastEvent:["ROUND_READY"]};
    case "START_ROUND":assertPhase(state,"ROUND_INTRO");if(!currentUse(state))throw new ForbiddenWordError("انتهت البطاقات",409,"CONTENT_EXHAUSTED");return {...state,phase:"CARD_ACTIVE",deadlineAt:new Date(now+state.roundMs).toISOString(),remainingMs:state.roundMs,roundStartScore:state.scores[state.roundIndex%2],endReason:null,lastEvent:["ROUND_STARTED","CARD_STARTED"]};
    case "CORRECT":case "SKIP":case "FOUL":{
      assertPhase(state,"CARD_ACTIVE");const useId=currentUse(state);if(!useId||!state.deadlineAt)throw new ForbiddenWordError("لا توجد بطاقة نشطة");const team=state.roundIndex%2,scores=[...state.scores],delta=action.type==="CORRECT"?1:action.type==="FOUL"?-Math.min(1,scores[team]):0;scores[team]+=delta;
      const next={...state,scores,cardIndex:state.cardIndex+1,outcomes:[...state.outcomes,{useId,roundIndex:state.roundIndex,result:action.type,delta,at:new Date(now).toISOString()}],lastEvent:[action.type==="CORRECT"?"CARD_CORRECT":action.type==="SKIP"?"CARD_SKIPPED":"FOUL_RECORDED","SCORE_CHANGED","CARD_CHANGED"]};
      return currentUse(next)?next:{...next,phase:"ROUND_RESULTS",remainingMs:remaining(state,now),endReason:"CONTENT_EXHAUSTED",lastEvent:[...next.lastEvent,"ROUND_ENDED"]};
    }
    case "END_ROUND":return timeout(state,now);
    case "PAUSE":assertPhase(state,"READY","ROUND_INTRO","CARD_ACTIVE","ROUND_RESULTS");return {...state,phase:"PAUSED",pausedPhase:state.phase,remainingMs:remaining(state,now),deadlineAt:null,lastEvent:["GAME_PAUSED"]};
    case "RESUME":assertPhase(state,"PAUSED");if(!state.pausedPhase)throw new ForbiddenWordError("لا توجد مرحلة لاستئنافها");return {...state,phase:state.pausedPhase,pausedPhase:null,deadlineAt:state.pausedPhase==="CARD_ACTIVE"?new Date(now+state.remainingMs).toISOString():null,lastEvent:["GAME_RESUMED"]};
    case "UNDO":{
      assertPhase(state,"CARD_ACTIVE","PAUSED","ROUND_RESULTS");if(state.phase==="PAUSED"&&state.pausedPhase!=="CARD_ACTIVE")throw new ForbiddenWordError("لا توجد بطاقة قابلة للتراجع");
      if(state.phase==="ROUND_RESULTS"&&(state.endReason!=="CONTENT_EXHAUSTED"||!state.deadlineAt||now>=Date.parse(state.deadlineAt)))throw new ForbiddenWordError("لا يمكن إعادة جولة انتهى وقتها");
      const latest=state.outcomes.at(-1);if(!latest||latest.roundIndex!==state.roundIndex)throw new ForbiddenWordError("لا يوجد حكم في الجولة للتراجع عنه");
      // The existing deadline/banked pause time is preserved. Undo grants zero extra time.
      const scores=[...state.scores];scores[state.roundIndex%2]-=latest.delta;
      return {...state,phase:state.phase==="ROUND_RESULTS"?"CARD_ACTIVE":state.phase,endReason:null,scores,cardIndex:state.cardIndex-1,outcomes:state.outcomes.slice(0,-1),lastEvent:["CARD_JUDGMENT_UNDONE","SCORE_CHANGED","CARD_CHANGED"]};
    }
    case "NEXT_ROUND":{
      assertPhase(state,"ROUND_RESULTS");if(state.roundIndex+1===state.roundCount||!currentUse(state))return {...state,phase:"FINAL_RESULTS",deadlineAt:null,remainingMs:0,winnerTeamId:state.scores[0]===state.scores[1]?null:state.teamIds[state.scores[0]>state.scores[1]?0:1],lastEvent:["MATCH_RESULTS"]};
      // The timed-out unresolved card is consumed without a judgment or score.
      const cardIndex=state.endReason==="TIMEOUT"?state.cardIndex+1:state.cardIndex;
      if(!state.useIds[cardIndex])return {...state,phase:"FINAL_RESULTS",winnerTeamId:state.scores[0]===state.scores[1]?null:state.teamIds[state.scores[0]>state.scores[1]?0:1],lastEvent:["MATCH_RESULTS"]};
      return {...state,phase:"ROUND_INTRO",roundIndex:state.roundIndex+1,cardIndex,remainingMs:0,endReason:null,roundStartScore:state.scores[(state.roundIndex+1)%2],lastEvent:["TURN_CHANGED"]};
    }
    case "COMPLETE":assertPhase(state,"FINAL_RESULTS");return {...state,phase:"COMPLETED",lastEvent:["GAME_COMPLETED"]};
  }
}
