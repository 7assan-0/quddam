import { createHash,randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { newToken,tokenHash } from "@/lib/auth/crypto";
import { consumeGameCredit } from "@/lib/billing/credits";
import { recordEvent } from "@/lib/analytics/events";
import { TEAM_COLORS } from "@/lib/design/team-colors";
import { lockActiveCategories } from "@/lib/games/content-category";
import { DISPLAY_ACTIVE_LINK_LIMIT,DISPLAY_LINKS_PER_WINDOW,DISPLAY_LINK_WINDOW_MS,DISPLAY_TOKEN_TTL_MS,displayAccessValid,displayWindowEndsAt } from "@/lib/games/category-board/display-policy";
import { lobby,freshMatch,transition,assertPhase,questionPool,validateAnswers,publicBoard,DEFAULT_MULTIPLIERS,SurveyError,type State,type Survey,type Action } from "./module";
export type Audience={kind:"HOST";id:string}|{kind:"DISPLAY";token:string};
export type SurveyAction=Action;
const json=(state:State|Survey)=>state as unknown as Prisma.InputJsonValue;
const lock=(tx:Prisma.TransactionClient,id:string)=>tx.$queryRawUnsafe('SELECT "id" FROM "GameSession" WHERE "id"=$1 FOR UPDATE',id);
export async function createSurveySession(hostId:string,names:[string,string]){
  const clean=names.map(n=>n.trim().replace(/\s+/g," "));if(clean.some(n=>n.length<2||n.length>60)||clean[0]===clean[1])throw new SurveyError("اختر اسمين مختلفين للفريقين",400);
  const game=await db().gameType.findUnique({where:{slug:"survey-show"}});if(!game?.enabled)throw new SurveyError("اللعبة غير متاحة",404);
  const id=await db().$transaction(async tx=>{
    const session=await tx.gameSession.create({data:{hostId,gameTypeId:game.id,config:{multipliers:DEFAULT_MULTIPLIERS,rematchCredit:"FREE_IN_SAME_SESSION",timers:"UNTIMED_HOST_JUDGED"},state:json(lobby())}});
    await tx.team.createMany({data:clean.map((name,position)=>({sessionId:session.id,name,position,color:TEAM_COLORS[position]}))});
    await recordEvent(tx,"GAME_CREATED",hostId,{sessionId:session.id,gameSlug:"survey-show"});return session.id;
  });return getSurveyView(id,{kind:"HOST",id:hostId});
}
async function load(id:string){const session=await db().gameSession.findUnique({where:{id},include:{gameType:{select:{slug:true}},teams:{orderBy:{position:"asc"}},displayAccesses:{where:{revokedAt:null,expiresAt:{gt:new Date()}},select:{expiresAt:true},take:1}}});if(!session||session.gameType.slug!=="survey-show")throw new SurveyError("المباراة غير موجودة",404);return session;}
export function tvProjection(state:State,survey:Survey|null){return {phase:state.phase,pausedPhase:state.pausedPhase,matchNumber:state.matchNumber,roundNumber:state.roundIndex+1,roundCount:state.multipliers.length,multiplier:state.multipliers[state.roundIndex],rawPot:state.rawPot,finalPot:state.rawPot*state.multipliers[state.roundIndex],strikes:state.strikes,controlTeamId:state.controlIndex===null?null:state.teamIds[state.controlIndex],activeTeamId:state.controlIndex===null?null:state.teamIds[state.phase==="STEAL"||state.pausedPhase==="STEAL"?1-state.controlIndex:state.controlIndex],roundWinnerId:state.roundWinnerId,winnerTeamId:state.winnerTeamId,question:survey?{text:survey.question,sourceType:survey.sourceType,totalSurveyPoints:survey.answers.reduce((sum,a)=>sum+a.points,0)}:null,board:publicBoard(state,survey),lastEvent:state.lastEvent};}
export function hostProjection(state:State,survey:Survey|null){return {...tvProjection(state,survey),answers:survey?.answers.map(a=>({...a,revealed:state.revealed.includes(a.id)}))??[],faceOff:state.faceOff,canUndo:state.history.length>0&&!["LOBBY","PAUSED","COMPLETED","ABANDONED"].includes(state.phase)};}
export async function getSurveyView(id:string,actor:Audience){
  const session=await load(id);
  if(actor.kind==="HOST"){if(actor.id!==session.hostId)throw new SurveyError("غير مصرح بإدارة المباراة",403);}
  else{if(!/^[A-Za-z0-9_-]{43}$/.test(actor.token))throw new SurveyError("رابط العرض غير صالح",403);const access=await db().displayAccess.findUnique({where:{tokenHash:tokenHash(actor.token)}});if(!access||access.sessionId!==id||!displayAccessValid(access,session,new Date()))throw new SurveyError("انتهى الوصول إلى العرض",403,"DISPLAY_ACCESS_DENIED");}
  const state=session.state as unknown as State;if(state.schemaVersion!==1||state.module!=="SURVEY_BATTLE")throw new SurveyError("جلسة قالوا الناس غير موجودة",404);
  const use=state.useIds[state.roundIndex]?await db().surveyQuestionUse.findUnique({where:{id:state.useIds[state.roundIndex]}}):null,survey=use?.snapshot as unknown as Survey|null;
  const common={id,version:session.stateVersion,serverNow:new Date().toISOString(),teams:session.teams.map((t,i)=>({id:t.id,name:t.name,color:t.color,position:t.position,score:state.scores[i]}))};
  if(actor.kind==="HOST")return {...common,...hostProjection(state,survey),displayAccess:{active:session.displayAccesses.length>0,expiresAt:session.displayAccesses[0]?.expiresAt??null}};
  return {...common,...tvProjection(state,survey)};
}
export type SurveyView=Awaited<ReturnType<typeof getSurveyView>>;
export type HostView=SurveyView & ReturnType<typeof hostProjection>;
async function selectSurveys(tx:Prisma.TransactionClient,id:string,hostId:string,state:State,multipliers:number[]){
  const [questions,recent]=await Promise.all([tx.surveyQuestion.findMany({where:{status:"PUBLISHED",locale:"ar-SA",category:{active:true}},include:{answers:{orderBy:{position:"asc"}}}}),tx.surveyQuestionUse.findMany({where:{session:{hostId}},orderBy:{openedAt:"desc"},take:40,select:{questionId:true}})]);
  const valid=questions.filter(q=>validateAnswers(q.answers)),selected:string[]=[],uses:string[]=[];
  if(valid.length<multipliers.length)throw new SurveyError("أضف استطلاعات منشورة تكفي لجميع الجولات",409,"SURVEY_EXHAUSTED");
  for(let i=0;i<multipliers.length;i++){
    const pool=questionPool(valid,selected,recent.map(r=>r.questionId)),picked=pool[randomInt(pool.length)];
    await tx.$queryRawUnsafe('SELECT "id" FROM "SurveyQuestion" WHERE "id"=$1 FOR UPDATE',picked.id);
    const q=await tx.surveyQuestion.findUniqueOrThrow({where:{id:picked.id},include:{answers:{orderBy:{position:"asc"}}}});
    const activeCategories=await lockActiveCategories(tx,[q.categoryId]);
    if(q.status!=="PUBLISHED"||q.locale!=="ar-SA"||!validateAnswers(q.answers)||!activeCategories.includes(q.categoryId))throw new SurveyError("تغير المحتوى؛ أعد بدء المباراة",409,"CONTENT_CHANGED");selected.push(q.id);
    const snapshot:Survey={id:q.id,question:q.question,sourceType:q.sourceType,answers:q.answers.map(a=>({id:a.id,answer:a.answer,alternativeAnswers:a.alternativeAnswers,points:a.points,position:a.position}))};
    uses.push((await tx.surveyQuestionUse.create({data:{sessionId:id,questionId:q.id,matchNumber:state.matchNumber+1,roundNumber:i+1,snapshot:json(snapshot)}})).id);
  }return uses;
}
export async function applySurveyCommand(id:string,hostId:string,key:string,expectedVersion:number,action:Action){
  const hash=createHash("sha256").update(JSON.stringify({hostId,action})).digest("hex");
  const recover=async()=>{const prior=await db().gameCommand.findUnique({where:{sessionId_key:{sessionId:id,key}}});if(!prior)return null;if(prior.payloadHash!==hash)throw new SurveyError("معرّف الأمر مستخدم لإجراء مختلف",409,"COMMAND_KEY_REUSED");return {session:await getSurveyView(id,{kind:"HOST",id:hostId}),duplicate:true};};
  try{const duplicate=await db().$transaction(async tx=>{
    await lock(tx,id);const session=await tx.gameSession.findUnique({where:{id},include:{gameType:{select:{slug:true}},teams:{orderBy:{position:"asc"}}}});
    if(!session||session.gameType.slug!=="survey-show")throw new SurveyError("المباراة غير موجودة",404);if(session.hostId!==hostId)throw new SurveyError("غير مصرح بهذا الأمر",403);
    const prior=await tx.gameCommand.findUnique({where:{sessionId_key:{sessionId:id,key}}});if(prior){if(prior.payloadHash!==hash)throw new SurveyError("معرّف الأمر مستخدم لإجراء مختلف",409,"COMMAND_KEY_REUSED");return true;}
    if(session.stateVersion!==expectedVersion)throw new SurveyError("تغيرت المباراة؛ حدّث الحالة",409,"STALE_GAME_STATE");
    const state=session.state as unknown as State;if(state.schemaVersion!==1||state.module!=="SURVEY_BATTLE")throw new SurveyError("جلسة قالوا الناس غير موجودة",404);let next:State;
    if(action.type==="START"||action.type==="REMATCH"){
      assertPhase(state,action.type==="START"?"LOBBY":"COMPLETED");if(session.teams.length!==2||session.teams.some((t,i)=>t.position!==i))throw new SurveyError("ترتيب الفريقين غير صالح",400);
      const config=session.config as {multipliers:number[]};next=freshMatch(state,session.teams.map(t=>t.id),await selectSurveys(tx,id,hostId,state,config.multipliers),config.multipliers);
      if(action.type==="START")await consumeGameCredit(tx,hostId,id,Boolean(session.creditConsumedAt));
      await recordEvent(tx,"GAME_STARTED",hostId,{sessionId:id,gameSlug:"survey-show"});
    }else{const use=state.useIds[state.roundIndex]?await tx.surveyQuestionUse.findUniqueOrThrow({where:{id:state.useIds[state.roundIndex]}}):null;next=transition(state,action,use?.snapshot as unknown as Survey|null);}
    for(let i=0;i<session.teams.length;i++){
      const delta=next.scores[i]-state.scores[i],awarded=["AWARD_ROUND","STEAL_GUESS"].includes(action.type)&&next.roundWinnerId===session.teams[i].id;
      if(delta||awarded){await tx.team.update({where:{id:session.teams[i].id},data:{score:next.scores[i]}});await tx.scoreEvent.create({data:{sessionId:id,teamId:session.teams[i].id,delta,reason:`SURVEY_${action.type}_M${next.matchNumber}_R${next.roundIndex+1}`,commandKey:`${id}:${key}:${i}`}});}
    }
    await tx.gameCommand.create({data:{sessionId:id,key,type:action.type,payloadHash:hash,stateVersion:expectedVersion+1}});
    const changed=await tx.gameSession.updateMany({where:{id,stateVersion:expectedVersion},data:{state:json(next),stateVersion:{increment:1},currentRoundNumber:next.roundIndex+1,status:next.phase==="PAUSED"?"PAUSED":next.phase==="COMPLETED"?"COMPLETED":next.phase==="ABANDONED"?"ABANDONED":"IN_PROGRESS",...(action.type==="START"?{startedAt:new Date(),creditConsumedAt:new Date()}:{}),...(["COMPLETE","ABANDON"].includes(action.type)?{endedAt:new Date()}:{}),...(["UNDO","REMATCH"].includes(action.type)?{endedAt:null}:{})}});
    if(!changed.count)throw new SurveyError("تغيرت المباراة",409,"STALE_GAME_STATE");
    if(action.type==="START_ROUND")await recordEvent(tx,"QUESTION_OPENED",hostId,{sessionId:id,gameSlug:"survey-show"});
    if(action.type==="COMPLETE")await recordEvent(tx,"GAME_COMPLETED",hostId,{sessionId:id,gameSlug:"survey-show"});
    if(["GUESS_CORRECT","GUESS_WRONG","STEAL_GUESS","FACE_OFF_GUESS"].includes(action.type))await recordEvent(tx,"QUESTION_ANSWERED",hostId,{sessionId:id,gameSlug:"survey-show"});return false;
  },{timeout:15_000});return {session:await getSurveyView(id,{kind:"HOST",id:hostId}),duplicate};
  }catch(error){if((typeof error==="object"&&error!==null&&"code" in error&&["P2002","P2034","STALE_GAME_STATE"].includes(String(error.code)))){const prior=await recover();if(prior)return prior;throw new SurveyError("تغيرت المباراة؛ حدّث الحالة",409,"STALE_GAME_STATE");}throw error;}
}
export async function createSurveyDisplayAccess(hostId:string,id:string){
  await getSurveyView(id,{kind:"HOST",id:hostId});const token=newToken();const expiresAt=await db().$transaction(async tx=>{
    await lock(tx,id);const session=await tx.gameSession.findUniqueOrThrow({where:{id},select:{endedAt:true}}),now=new Date(),end=displayWindowEndsAt(session.endedAt,now);
    if(session.endedAt&&!end)throw new SurveyError("انتهت فترة عرض المباراة",410);
    const [recent,active]=await Promise.all([tx.displayAccess.count({where:{sessionId:id,createdAt:{gte:new Date(now.getTime()-DISPLAY_LINK_WINDOW_MS)}}}),tx.displayAccess.count({where:{sessionId:id,revokedAt:null,expiresAt:{gt:now}}})]);
    if(recent>=DISPLAY_LINKS_PER_WINDOW||active>=DISPLAY_ACTIVE_LINK_LIMIT)throw new SurveyError("وصلت إلى حد روابط العرض",429,"DISPLAY_LINK_RATE_LIMIT");
    const expiry=new Date(Math.min(now.getTime()+DISPLAY_TOKEN_TTL_MS,end?.getTime()??Infinity));await tx.displayAccess.create({data:{sessionId:id,tokenHash:tokenHash(token),expiresAt:expiry}});return expiry;
  });return {token,expiresAt};
}
export async function revokeSurveyDisplayAccess(hostId:string,id:string){await getSurveyView(id,{kind:"HOST",id:hostId});await db().displayAccess.updateMany({where:{sessionId:id,revokedAt:null},data:{revokedAt:new Date()}});}
