import { createHash, randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { newToken, tokenHash } from "@/lib/auth/crypto";
import { consumeGameCredit } from "@/lib/billing/credits";
import { recordEvent } from "@/lib/analytics/events";
import { TEAM_COLORS } from "@/lib/design/team-colors";
import { DISPLAY_ACTIVE_LINK_LIMIT, DISPLAY_LINKS_PER_WINDOW, DISPLAY_LINK_WINDOW_MS, DISPLAY_TOKEN_TTL_MS, displayAccessValid, displayWindowEndsAt } from "@/lib/games/category-board/display-policy";
import { assertPhase, endGame, expireAnswer, freshMatch, generateBoard, lobby, openQuestion, pause, resume, revealAnswer, resolveAnswer, selectCell, undo, validQuestionLetter, LetterError, type LetterState } from "./module";
import { questionPool } from "./questions";
import { lockActiveCategories } from "@/lib/games/content-category";

export type LetterAction = { type:"START"|"OPEN_QUESTION"|"REVEAL_ANSWER"|"CORRECT"|"WRONG"|"STEAL_CORRECT"|"STEAL_WRONG"|"EXPIRE_ANSWER"|"PAUSE"|"RESUME"|"UNDO"|"COMPLETE"|"END_GAME"|"ABANDON"|"REMATCH" } | { type:"SELECT_CELL"; cellId:string };
export type Audience = {kind:"HOST";id:string}|{kind:"DISPLAY";token:string};
const inputState = (state:LetterState) => state as unknown as Prisma.InputJsonValue;
const uniqueError = (error:unknown) => typeof error==="object" && error!==null && "code" in error && ["P2002","P2034"].includes(String(error.code));
// All raw queries below bind the session id as a parameter, never interpolate user input.
const lock = (tx:Prisma.TransactionClient,id:string) => tx.$queryRawUnsafe('SELECT "id" FROM "GameSession" WHERE "id" = $1 FOR UPDATE',id);

export async function createLetterSession(hostId:string,names:[string,string]) {
  const clean=names.map(name=>name.trim().replace(/\s+/g," "));
  if(clean.some(name=>name.length<2||name.length>60)||clean[0]===clean[1]) throw new LetterError("اختر اسمين مختلفين، من حرفين إلى ٦٠ حرفًا",400);
  const game=await db().gameType.findUnique({where:{slug:"letter-network"}});
  if(!game?.enabled)throw new LetterError("اللعبة غير متاحة",404);
  const id=await db().$transaction(async tx=>{
    const session=await tx.gameSession.create({data:{hostId,gameTypeId:game.id,config:{answerSeconds:30,stealSeconds:15,rematchCredit:"FREE_IN_SAME_SESSION"},state:inputState(lobby())}});
    await tx.team.createMany({data:clean.map((name,position)=>({sessionId:session.id,name,position,color:TEAM_COLORS[position]}))});
    await recordEvent(tx,"GAME_CREATED",hostId,{sessionId:session.id,gameSlug:"letter-network"});
    return session.id;
  });
  return getLetterView(id,{kind:"HOST",id:hostId});
}
async function loadSession(id:string) {
  const session=await db().gameSession.findUnique({where:{id},include:{gameType:{select:{slug:true}},teams:{orderBy:{position:"asc"}},
    displayAccesses:{where:{revokedAt:null,expiresAt:{gt:new Date()}},select:{expiresAt:true},take:1}}});
  if(!session||session.gameType.slug!=="letter-network")throw new LetterError("المباراة غير موجودة",404);
  return session;
}
async function advanceExpiry(id:string) {
  await db().$transaction(async tx=>{
    await lock(tx,id);
    const session=await tx.gameSession.findUnique({where:{id},select:{state:true,hostId:true}});
    if(!session)return;
    let state=session.state as unknown as LetterState;
    // A disconnected host cannot freeze play. Long gaps may expire both answer windows.
    for(let i=0;i<2;i++){
      if(!["QUESTION_ACTIVE","STEAL"].includes(state.phase)||!state.deadlineAt||new Date(state.deadlineAt).getTime()>Date.now())break;
      state=expireAnswer(state,new Date(state.deadlineAt).getTime());
      await tx.gameSession.update({where:{id},data:{state:inputState(state),stateVersion:{increment:1}}});
      await recordEvent(tx,"QUESTION_ANSWERED",session.hostId,{sessionId:id,gameSlug:"letter-network"});
    }
  });
}
export async function getLetterView(id:string,actor:Audience) {
  let session=await loadSession(id);
  if(actor.kind==="HOST"){
    if(session.hostId!==actor.id)throw new LetterError("غير مصرح بإدارة المباراة",403);
  }else{
    if(!/^[A-Za-z0-9_-]{43}$/.test(actor.token))throw new LetterError("رابط العرض غير صالح",403);
    const access=await db().displayAccess.findUnique({where:{tokenHash:tokenHash(actor.token)}});
    if(!access||access.sessionId!==id||!displayAccessValid(access,session,new Date()))throw new LetterError("رابط العرض منتهي أو ملغى",403,"DISPLAY_ACCESS_DENIED");
  }
  let state=session.state as unknown as LetterState;
  if(state.schemaVersion!==1)throw new LetterError("إصدار المباراة غير مدعوم",500);
  if(["QUESTION_ACTIVE","STEAL"].includes(state.phase)&&state.deadlineAt&&new Date(state.deadlineAt).getTime()<=Date.now()){
    await advanceExpiry(id);session=await loadSession(id);state=session.state as unknown as LetterState;
  }
  const phase=state.phase==="PAUSED"?state.pausedPhase:state.phase;
  const use=state.activeUseId&&["QUESTION_ACTIVE","STEAL"].includes(phase??"") ? await db().letterQuestionUse.findUnique({where:{id:state.activeUseId}}):null;
  const last=state.lastUseId?await db().letterQuestionUse.findUnique({where:{id:state.lastUseId}}):null;
  // Explicit allow-list projections; no state/history or question-bank objects leave the server.
  return {id,version:session.stateVersion,serverNow:new Date().toISOString(),phase:state.phase,pausedPhase:state.pausedPhase,matchNumber:state.matchNumber,
    teams:session.teams.map(team=>({id:team.id,name:team.name,color:team.color,position:team.position,captured:state.board.filter(c=>c.ownerTeamId===team.id).length})),
    board:state.board,activeTeamId:state.teamIds[state.activeTeamIndex]??null,
    answeringTeamId:state.teamIds[phase==="STEAL"?1-state.activeTeamIndex:state.activeTeamIndex]??null,activeCellId:state.activeCellId,
    question:use?{id:use.questionId,text:use.questionSnapshot,letter:state.board.find(c=>c.cellId===state.activeCellId)?.letter??"",
      ...(actor.kind==="HOST"&&state.revealed?{answer:use.answerSnapshot,alternativeAnswers:use.alternativesSnapshot}:{})}:null,
    lastAnswer:last?{text:last.questionSnapshot,answer:last.answerSnapshot}:null,
    deadlineAt:state.deadlineAt,remainingMs:state.remainingMs,winnerTeamId:state.winnerTeamId,winningPath:state.winningPath,
    canUndo:actor.kind==="HOST"&&state.history.length>0&&["READY","STEAL","RESULTS"].includes(state.phase),lastEvent:state.lastEvent,
    displayAccess:actor.kind==="HOST"?{active:session.displayAccesses.length>0,expiresAt:(session.displayAccesses[0]?.expiresAt??null) as Date|null}:undefined};
}
export type LetterView=Awaited<ReturnType<typeof getLetterView>>;

async function boardFor(tx:Prisma.TransactionClient,previous:LetterState) {
  const candidates=await tx.letterQuestion.findMany({where:{status:"PUBLISHED",category:{active:true}},select:{categoryId:true},distinct:["categoryId"]});
  const categoryIds=await lockActiveCategories(tx,candidates.map(q=>q.categoryId));
  const questions=await tx.letterQuestion.findMany({where:{status:"PUBLISHED",categoryId:{in:categoryIds},category:{active:true}},select:{letter:true,answer:true,alternativeAnswers:true}});
  const counts:Record<string,number>={};
  for(const q of questions)if(validQuestionLetter(q.letter,[q.answer,...q.alternativeAnswers]))counts[q.letter]=(counts[q.letter]??0)+1;
  let board=generateBoard(counts);
  for(let i=0;i<7&&board.map(c=>c.letter).join("")===previous.board.map(c=>c.letter).join("");i++)board=generateBoard(counts);
  return board;
}
async function questionFor(tx:Prisma.TransactionClient,sessionId:string,hostId:string,matchNumber:number,letter:string) {
  const [questions,used,recent]=await Promise.all([
    tx.letterQuestion.findMany({where:{letter,status:"PUBLISHED",category:{active:true}}}),
    tx.letterQuestionUse.findMany({where:{sessionId,matchNumber},select:{questionId:true}}),
    tx.letterQuestionUse.findMany({where:{session:{hostId}},orderBy:{openedAt:"desc"},take:80,select:{questionId:true}})]);
  const pool=questionPool(questions.filter(q=>validQuestionLetter(q.letter,[q.answer,...q.alternativeAnswers])),used.map(q=>q.questionId),recent.map(q=>q.questionId));
  const picked=pool[randomInt(pool.length)];
  await tx.$queryRawUnsafe('SELECT "id" FROM "LetterQuestion" WHERE "id"=$1 FOR SHARE',picked.id);
  const question=await tx.letterQuestion.findUniqueOrThrow({where:{id:picked.id}});
  const activeCategories=await lockActiveCategories(tx,[question.categoryId]);
  if(question.status!=="PUBLISHED"||question.letter!==letter||!validQuestionLetter(question.letter,[question.answer,...question.alternativeAnswers])||!activeCategories.includes(question.categoryId))
    throw new LetterError("تغير المحتوى؛ اختر خلية متاحة أو أعد المحاولة",409,"CONTENT_CHANGED");
  return question;
}
export async function applyLetterCommand(id:string,hostId:string,key:string,expectedVersion:number,action:LetterAction) {
  const hash=createHash("sha256").update(JSON.stringify({hostId,action})).digest("hex");
  const recover=async()=>{
    const existing=await db().gameCommand.findUnique({where:{sessionId_key:{sessionId:id,key}}});
    if(!existing)return null;
    if(existing.payloadHash!==hash)throw new LetterError("معرّف الأمر مستخدم لإجراء مختلف",409,"COMMAND_KEY_REUSED");
    return {session:await getLetterView(id,{kind:"HOST",id:hostId}),duplicate:true};
  };
  try{
    const duplicate=await db().$transaction(async tx=>{
      await lock(tx,id);
      const session=await tx.gameSession.findUnique({where:{id},include:{gameType:{select:{slug:true}},teams:{orderBy:{position:"asc"}}}});
      if(!session||session.gameType.slug!=="letter-network")throw new LetterError("المباراة غير موجودة",404);
      if(session.hostId!==hostId)throw new LetterError("غير مصرح بهذا الأمر",403);
      const prior=await tx.gameCommand.findUnique({where:{sessionId_key:{sessionId:id,key}}});
      if(prior){if(prior.payloadHash!==hash)throw new LetterError("معرّف الأمر مستخدم لإجراء مختلف",409,"COMMAND_KEY_REUSED");return true;}
      if(session.stateVersion!==expectedVersion)throw new LetterError("تغيرت المباراة. حدّث الحالة",409,"STALE_GAME_STATE");
      const state=session.state as unknown as LetterState,now=Date.now();
      if(state.schemaVersion!==1)throw new LetterError("إصدار المباراة غير مدعوم",500);
      if(["QUESTION_ACTIVE","STEAL"].includes(state.phase)&&state.deadlineAt&&new Date(state.deadlineAt).getTime()<=now&&!["EXPIRE_ANSWER","ABANDON","END_GAME"].includes(action.type))
        throw new LetterError("انتهت مهلة الإجابة",409,"TIMER_EXPIRED");
      let next:LetterState;
      switch(action.type){
        case "START":case "REMATCH":
          assertPhase(state,action.type==="START"?"LOBBY":"COMPLETED");
          if(session.teams.length!==2||session.teams.some((t,i)=>t.position!==i))throw new LetterError("ترتيب الفريقين غير صالح",400);
          next=freshMatch(state,await boardFor(tx,state),session.teams.map(t=>t.id));
          if(action.type==="START")await consumeGameCredit(tx,hostId,id,Boolean(session.creditConsumedAt));
          await recordEvent(tx,"GAME_STARTED",hostId,{sessionId:id,gameSlug:"letter-network"});break;
        case "SELECT_CELL":{
          assertPhase(state,"READY");const cell=state.board.find(c=>c.cellId===action.cellId);
          if(!cell||cell.state!=="AVAILABLE")throw new LetterError("الخلية غير متاحة",409,"CELL_UNAVAILABLE");
          const q=await questionFor(tx,id,hostId,state.matchNumber,cell.letter);
          const use=await tx.letterQuestionUse.create({data:{sessionId:id,matchNumber:state.matchNumber,cellId:cell.cellId,questionId:q.id,
            questionSnapshot:q.question,answerSnapshot:q.answer,alternativesSnapshot:q.alternativeAnswers}});
          next=selectCell(state,cell.cellId,use.id,q.id);break;}
        case "OPEN_QUESTION":next=openQuestion(state,now);await recordEvent(tx,"QUESTION_OPENED",hostId,{sessionId:id,gameSlug:"letter-network"});break;
        case "REVEAL_ANSWER":next=revealAnswer(state);break;
        case "CORRECT":case "WRONG":case "STEAL_CORRECT":case "STEAL_WRONG":
          next=resolveAnswer(state,action.type,now);await recordEvent(tx,"QUESTION_ANSWERED",hostId,{sessionId:id,gameSlug:"letter-network"});break;
        case "EXPIRE_ANSWER":next=expireAnswer(state,now);break;
        case "PAUSE":next=pause(state,now);break;
        case "RESUME":next=resume(state,now);break;
        case "UNDO":next=undo(state,now);break;
        case "END_GAME":next=endGame(state,now);break;
        case "COMPLETE":assertPhase(state,"RESULTS");next={...state,phase:"COMPLETED",deadlineAt:null,lastEvent:["GAME_COMPLETED"]};break;
        case "ABANDON":
          if(["COMPLETED","ABANDONED"].includes(state.phase))throw new LetterError("المباراة منتهية");
          next={...state,phase:"ABANDONED",pausedPhase:null,deadlineAt:null,lastEvent:["GAME_ABANDONED"]};break;
      }
      await tx.gameCommand.create({data:{sessionId:id,key,type:action.type,payloadHash:hash,stateVersion:expectedVersion+1}});
      const changed=await tx.gameSession.updateMany({where:{id,stateVersion:expectedVersion},data:{
        state:inputState(next),stateVersion:{increment:1},status:next.phase==="LOBBY"?"LOBBY":next.phase==="PAUSED"?"PAUSED":next.phase==="COMPLETED"?"COMPLETED":next.phase==="ABANDONED"?"ABANDONED":"IN_PROGRESS",
        ...(action.type==="START"?{startedAt:new Date(now),creditConsumedAt:new Date(now)}:{}),
        ...(["START","REMATCH"].includes(action.type)?{currentRoundNumber:{increment:1}}:{}),
        ...(["COMPLETE","ABANDON"].includes(action.type)?{endedAt:new Date(now)}:{}),
        ...(["UNDO","REMATCH"].includes(action.type)?{endedAt:null}:{})}});
      if(!changed.count)throw new LetterError("تغيرت المباراة",409,"STALE_GAME_STATE");
      if(action.type==="COMPLETE")await recordEvent(tx,"GAME_COMPLETED",hostId,{sessionId:id,gameSlug:"letter-network"});
      return false;
    },{timeout:15_000});
    return {session:await getLetterView(id,{kind:"HOST",id:hostId}),duplicate};
  }catch(error){
    if(uniqueError(error)||(error instanceof LetterError&&error.code==="STALE_GAME_STATE")){
      const prior=await recover();if(prior)return prior;
      throw new LetterError("تغيرت المباراة. حدّث الحالة",409,"STALE_GAME_STATE");
    }throw error;
  }
}
export async function createLetterDisplayAccess(hostId:string,id:string) {
  await getLetterView(id,{kind:"HOST",id:hostId});
  const token=newToken();
  const expiresAt=await db().$transaction(async tx=>{
    await lock(tx,id);
    const session=await tx.gameSession.findUniqueOrThrow({where:{id},select:{endedAt:true}});
    const now=new Date(),windowEnd=displayWindowEndsAt(session.endedAt,now);
    if(session.endedAt&&!windowEnd)throw new LetterError("انتهت فترة عرض المباراة",410);
    const [recent,active]=await Promise.all([
      tx.displayAccess.count({where:{sessionId:id,createdAt:{gte:new Date(now.getTime()-DISPLAY_LINK_WINDOW_MS)}}}),
      tx.displayAccess.count({where:{sessionId:id,revokedAt:null,expiresAt:{gt:now}}})]);
    if(recent>=DISPLAY_LINKS_PER_WINDOW||active>=DISPLAY_ACTIVE_LINK_LIMIT)throw new LetterError("وصلت إلى حد روابط العرض. ألغِ الروابط أو حاول لاحقًا",429,"DISPLAY_LINK_RATE_LIMIT");
    const expiry=new Date(Math.min(now.getTime()+DISPLAY_TOKEN_TTL_MS,windowEnd?.getTime()??Infinity));
    await tx.displayAccess.create({data:{sessionId:id,tokenHash:tokenHash(token),expiresAt:expiry}});return expiry;
  });
  return {token,expiresAt};
}
export async function revokeLetterDisplayAccess(hostId:string,id:string) {
  await getLetterView(id,{kind:"HOST",id:hostId});
  await db().displayAccess.updateMany({where:{sessionId:id,revokedAt:null},data:{revokedAt:new Date()}});
}
