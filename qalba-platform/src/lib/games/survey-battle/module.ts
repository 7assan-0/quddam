/** Isolated, deterministic Survey Battle rules. No client supplied scores. */
export type Phase = "LOBBY"|"ROUND_INTRO"|"FACE_OFF"|"TEAM_CONTROL"|"ANSWERING"|"STEAL"|"ROUND_RESULTS"|"FINAL_RESULTS"|"COMPLETED"|"PAUSED"|"ABANDONED";
export type SurveyAnswer = {id:string;answer:string;alternativeAnswers:string[];points:number;position:number};
export type Survey = {id:string;question:string;answers:SurveyAnswer[];sourceType:string};
export type Core = {schemaVersion:1;module:"SURVEY_BATTLE";phase:Phase;pausedPhase:Phase|null;matchNumber:number;roundIndex:number;useIds:string[];multipliers:number[];teamIds:string[];scores:number[];revealed:string[];faceOff:Record<string,string|null>;controlIndex:number|null;strikes:number;rawPot:number;roundWinnerId:string|null;winnerTeamId:string|null};
export type State = Core & {history:Core[];lastEvent:string[]};
export type Action = {type:"START"|"START_ROUND"|"RESET_FACE_OFF"|"BEGIN_ANSWERING"|"GUESS_WRONG"|"START_STEAL"|"AWARD_ROUND"|"NEXT_ROUND"|"UNDO"|"PAUSE"|"RESUME"|"END_GAME"|"COMPLETE"|"REMATCH"|"ABANDON"}
  | {type:"FACE_OFF_GUESS";teamIndex:0|1;answerId:string|null}
  | {type:"GUESS_CORRECT";answerId:string}
  | {type:"STEAL_GUESS";answerId:string|null};
export class SurveyError extends Error {constructor(message:string,public status=409,public code="INVALID_SURVEY_ACTION"){super(message);}}
export const DEFAULT_MULTIPLIERS=[1,1,2,2,3];
export function normalizeArabic(value:string){return value.normalize("NFC").replace(/[\u064b-\u065f\u0670\u0640]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").trim().replace(/\s+/g," ").toLowerCase();}
export function validateAnswers(answers:Omit<SurveyAnswer,"id">[]){
  if(answers.length<3||answers.length>12)return false;
  const seen=new Set<string>();
  return answers.every((a,i)=>{
    if(!Number.isInteger(a.points)||a.points<1||a.points>1000||a.position!==i||(i>0&&answers[i-1].points<a.points))return false;
    return [a.answer,...a.alternativeAnswers].every(text=>{const key=normalizeArabic(text);if(!key||seen.has(key))return false;seen.add(key);return true;});
  });
}
export function matches(survey:Survey,guess:string){const key=normalizeArabic(guess);return key?survey.answers.filter(a=>[a.answer,...a.alternativeAnswers].some(s=>normalizeArabic(s)===key)):[];}
export function questionPool<T extends {id:string}>(questions:T[],used:string[],recent:string[]){
  const unused=questions.filter(q=>!used.includes(q.id));if(!unused.length)throw new SurveyError("لا توجد استطلاعات كافية غير مستخدمة",409,"SURVEY_EXHAUSTED");
  const fresh=unused.filter(q=>!recent.includes(q.id));return fresh.length?fresh:unused;
}
export function lobby():State{return {schemaVersion:1,module:"SURVEY_BATTLE",phase:"LOBBY",pausedPhase:null,matchNumber:0,roundIndex:0,useIds:[],multipliers:[...DEFAULT_MULTIPLIERS],teamIds:[],scores:[0,0],revealed:[],faceOff:{},controlIndex:null,strikes:0,rawPot:0,roundWinnerId:null,winnerTeamId:null,history:[],lastEvent:[]};}
export function assertPhase(state:State,...allowed:Phase[]){if(!allowed.includes(state.phase))throw new SurveyError("الإجراء غير متاح في هذه المرحلة");}
export function freshMatch(previous:State,teamIds:string[],useIds:string[],multipliers:number[]):State{
  if(teamIds.length!==2||teamIds[0]===teamIds[1]||!multipliers.length||multipliers.length>10||multipliers.some(n=>!Number.isInteger(n)||n<1||n>5)||useIds.length!==multipliers.length)throw new SurveyError("إعداد المباراة غير صالح",400);
  return {...lobby(),phase:"ROUND_INTRO",matchNumber:previous.matchNumber+1,teamIds:[...teamIds],useIds:[...useIds],multipliers:[...multipliers],lastEvent:["GAME_STARTED","ROUND_STARTED"]};
}
function checkpoint(state:State){const {history,lastEvent,...core}=state;void lastEvent;return {...state,history:[...history,structuredClone(core)].slice(-60)};}
function answer(survey:Survey,id:string){const a=survey.answers.find(a=>a.id===id);if(!a)throw new SurveyError("الإجابة لا تنتمي لهذه الجولة",400);return a;}
function reveal(state:State,survey:Survey,id:string){if(state.revealed.includes(id))throw new SurveyError("الإجابة مكشوفة بالفعل",409,"ANSWER_ALREADY_REVEALED");const a=answer(survey,id);return {...state,revealed:[...state.revealed,id],rawPot:state.rawPot+a.points};}
function award(state:State,index:number){if(state.roundWinnerId||index<0||index>1)throw new SurveyError("تم منح نقاط الجولة بالفعل");const scores=[...state.scores];scores[index]+=state.rawPot*state.multipliers[state.roundIndex];return {...state,scores,roundWinnerId:state.teamIds[index],phase:"ROUND_RESULTS" as const,lastEvent:["ROUND_AWARDED","SCORE_CHANGED"]};}
function winner(state:State){return state.scores[0]===state.scores[1]?null:state.teamIds[state.scores[0]>state.scores[1]?0:1];}
export function transition(state:State,action:Action,survey:Survey|null):State{
  if(action.type==="START"||action.type==="REMATCH")throw new SurveyError("يلزم تجهيز المباراة من الخادم");
  if(action.type==="UNDO"){
    assertPhase(state,"FACE_OFF","TEAM_CONTROL","ANSWERING","STEAL","ROUND_RESULTS","ROUND_INTRO","FINAL_RESULTS");
    const before=state.history.at(-1);if(!before)throw new SurveyError("لا يوجد حكم للتراجع عنه");return {...structuredClone(before),history:state.history.slice(0,-1),lastEvent:["GAME_UNDONE","SCORE_CHANGED"]};
  }
  if(action.type==="PAUSE"){assertPhase(state,"ROUND_INTRO","FACE_OFF","TEAM_CONTROL","ANSWERING","STEAL","ROUND_RESULTS");return {...state,phase:"PAUSED",pausedPhase:state.phase,lastEvent:["GAME_PAUSED"]};}
  if(action.type==="RESUME"){assertPhase(state,"PAUSED");if(!state.pausedPhase)throw new SurveyError("لا توجد مرحلة لاستئنافها");return {...state,phase:state.pausedPhase,pausedPhase:null,lastEvent:["GAME_RESUMED"]};}
  if(action.type==="ABANDON"){if(["COMPLETED","ABANDONED"].includes(state.phase))throw new SurveyError("المباراة منتهية");return {...state,phase:"ABANDONED",pausedPhase:null,lastEvent:["GAME_ABANDONED"]};}
  if(action.type==="END_GAME"){assertPhase(state,"ROUND_INTRO","FACE_OFF","TEAM_CONTROL","ANSWERING","STEAL","ROUND_RESULTS","PAUSED");return {...checkpoint(state),phase:"FINAL_RESULTS",pausedPhase:null,winnerTeamId:winner(state),lastEvent:["GAME_ENDED"]};}
  if(action.type==="COMPLETE"){assertPhase(state,"FINAL_RESULTS");return {...state,phase:"COMPLETED",lastEvent:["GAME_COMPLETED"]};}
  if(action.type==="NEXT_ROUND"){
    assertPhase(state,"ROUND_RESULTS");const next=checkpoint(state);
    if(state.roundIndex+1===state.useIds.length)return {...next,phase:"FINAL_RESULTS",winnerTeamId:winner(state),lastEvent:["MATCH_RESULTS"]};
    return {...next,phase:"ROUND_INTRO",roundIndex:state.roundIndex+1,faceOff:{},revealed:[],controlIndex:null,strikes:0,rawPot:0,roundWinnerId:null,lastEvent:["ROUND_STARTED"]};
  }
  if(!survey)throw new SurveyError("محتوى الجولة غير موجود",500);
  switch(action.type){
    case "START_ROUND":assertPhase(state,"ROUND_INTRO");return {...state,phase:"FACE_OFF",lastEvent:["FACE_OFF_STARTED"]};
    case "RESET_FACE_OFF":assertPhase(state,"FACE_OFF");return {...checkpoint(state),faceOff:{},lastEvent:["FACE_OFF_STARTED"]};
    case "FACE_OFF_GUESS":{
      assertPhase(state,"FACE_OFF");if(state.faceOff[action.teamIndex]!==undefined)throw new SurveyError("تم تسجيل محاولة الفريق");
      if(action.answerId)answer(survey,action.answerId);
      const next=checkpoint(state),faceOff={...state.faceOff};faceOff[action.teamIndex]=action.answerId;
      next.faceOff=faceOff;
      if(faceOff[0]===undefined||faceOff[1]===undefined)return {...next,lastEvent:["FACE_OFF_RECORDED"]};
      const points=[0,1].map(i=>faceOff[i]?answer(survey,faceOff[i]!).points:0);
      if(points[0]===points[1])return {...next,faceOff:{},lastEvent:["FACE_OFF_RESET"]};
      let resolved:State={...next,controlIndex:points[0]>points[1]?0:1};
      for(const id of new Set(Object.values(faceOff)))if(id)resolved=reveal(resolved,survey,id);
      return {...resolved,phase:"TEAM_CONTROL",lastEvent:["CONTROL_CHANGED","ANSWER_REVEALED"]};
    }
    case "BEGIN_ANSWERING":assertPhase(state,"TEAM_CONTROL");return {...state,phase:"ANSWERING",lastEvent:["ANSWERING_STARTED"]};
    case "GUESS_CORRECT":assertPhase(state,"ANSWERING");return {...reveal(checkpoint(state),survey,action.answerId),lastEvent:["ANSWER_REVEALED"]};
    case "GUESS_WRONG":assertPhase(state,"ANSWERING");if(state.revealed.length===survey.answers.length)throw new SurveyError("كل الإجابات مكشوفة؛ امنح الجولة");return {...checkpoint(state),strikes:state.strikes+1,phase:state.strikes===2?"STEAL":"ANSWERING",lastEvent:state.strikes===2?["STRIKE_ADDED","STEAL_STARTED"]:["STRIKE_ADDED"]};
    case "START_STEAL":assertPhase(state,"ANSWERING");if(state.strikes!==3)throw new SurveyError("الاقتناص بعد ثلاث أخطاء فقط");return {...state,phase:"STEAL",lastEvent:["STEAL_STARTED"]};
    case "STEAL_GUESS":{
      assertPhase(state,"STEAL");if(state.controlIndex===null)throw new SurveyError("الفريق المسيطر غير موجود");let next=checkpoint(state);
      if(action.answerId){answer(survey,action.answerId);if(state.revealed.includes(action.answerId))throw new SurveyError("الاقتناص بإجابة غير مكشوفة فقط");next={...next,revealed:[...next.revealed,action.answerId]};}
      // Steal reveals its answer but awards only the pre-existing pot.
      return {...award(next,action.answerId?1-state.controlIndex:state.controlIndex),lastEvent:[...(action.answerId?["ANSWER_REVEALED"]:[]),"STEAL_RESOLVED","ROUND_AWARDED","SCORE_CHANGED"]};
    }
    case "AWARD_ROUND":assertPhase(state,"ANSWERING");if(state.revealed.length!==survey.answers.length||state.controlIndex===null)throw new SurveyError("اكشف كل الإجابات قبل منح الجولة");return award(checkpoint(state),state.controlIndex);
  }
}
export function publicBoard(state:State,survey:Survey|null){return survey?.answers.map(a=>state.revealed.includes(a.id)?{slot:a.position+1,revealed:true as const,answer:a.answer,points:a.points}:{slot:a.position+1,revealed:false as const})??[];}
