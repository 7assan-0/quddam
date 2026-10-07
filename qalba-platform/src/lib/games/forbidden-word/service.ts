import {createHash,randomInt,randomUUID} from "node:crypto";
import type {Prisma} from "@/generated/prisma/client";
import {db} from "@/lib/db";
import {newToken,tokenHash} from "@/lib/auth/crypto";
import {consumeGameCredit} from "@/lib/billing/credits";
import {recordEvent} from "@/lib/analytics/events";
import {TEAM_COLORS} from "@/lib/design/team-colors";
import {DISPLAY_ACTIVE_LINK_LIMIT,DISPLAY_LINKS_PER_WINDOW,DISPLAY_LINK_WINDOW_MS,DISPLAY_TOKEN_TTL_MS,displayAccessValid,displayWindowEndsAt} from "@/lib/games/category-board/display-policy";
import {lobby,freshMatch,transition,timeout,expired,currentUse,orderedPool,roundSummary,validCard,assertPhase,ForbiddenWordError,type State,type Card,type Action} from "./module";
export type Audience={kind:"HOST";id:string}|{kind:"DISPLAY"|"CLUE";token:string};
const json=(value:State|Card)=>value as unknown as Prisma.InputJsonValue;
const lock=(tx:Prisma.TransactionClient,id:string)=>tx.$queryRawUnsafe('SELECT "id" FROM "GameSession" WHERE "id"=$1 FOR UPDATE',id);
const include={gameType:{select:{slug:true}},teams:{orderBy:{position:"asc" as const}}};
type Session=Prisma.GameSessionGetPayload<{include:typeof include}>;
function stateOf(session:Session|null){if(!session||session.gameType.slug!=="secret-word")throw new ForbiddenWordError("المباراة غير موجودة",404);const state=session.state as unknown as State;if(state.schemaVersion!==1||state.module!=="FORBIDDEN_WORD")throw new ForbiddenWordError("الجلسة لا تتبع الكلمة الممنوعة",404);return state;}
export function tvProjection(state:State){return {phase:state.phase,pausedPhase:state.pausedPhase,matchNumber:state.matchNumber,roundNumber:state.roundIndex+1,roundCount:state.roundCount,activeTeamId:state.teamIds[state.roundIndex%2]??null,deadlineAt:state.deadlineAt,remainingMs:state.remainingMs,summary:roundSummary(state),winnerTeamId:state.winnerTeamId,endReason:state.endReason,lastEvent:[...state.lastEvent]};}
export function clueProjection(state:State,card:Card|null){return {...tvProjection(state),card:["CARD_ACTIVE","PAUSED"].includes(state.phase)&&(state.phase!=="PAUSED"||state.pausedPhase==="CARD_ACTIVE")?card:null};}
export function hostProjection(state:State,card:Card|null){return {...clueProjection(state,card),canUndo:(state.phase==="CARD_ACTIVE"||state.phase==="PAUSED"&&state.pausedPhase==="CARD_ACTIVE"||state.phase==="ROUND_RESULTS"&&state.endReason==="CONTENT_EXHAUSTED"&&Boolean(state.deadlineAt)&&Date.now()<Date.parse(state.deadlineAt!))&&state.outcomes.at(-1)?.roundIndex===state.roundIndex};}
async function authorize(session:Session,state:State,actor:Audience){
  if(actor.kind==="HOST"){if(actor.id!==session.hostId)throw new ForbiddenWordError("غير مصرح بإدارة المباراة",403);return;}
  if(!/^[A-Za-z0-9_-]{43}$/.test(actor.token))throw new ForbiddenWordError("رابط الوصول غير صالح",403);
  if(actor.kind==="DISPLAY"){const access=await db().displayAccess.findUnique({where:{tokenHash:tokenHash(actor.token)}});if(!access||access.sessionId!==session.id||!displayAccessValid(access,session,new Date()))throw new ForbiddenWordError("انتهى الوصول إلى العرض",403,"DISPLAY_ACCESS_DENIED");}
  else {const access=await db().forbiddenClueAccess.findUnique({where:{tokenHash:tokenHash(actor.token)}});if(!access||access.sessionId!==session.id||access.revokedAt||access.expiresAt.getTime()<=Date.now()||access.matchNumber!==state.matchNumber||access.roundIndex!==state.roundIndex||!["CARD_ACTIVE","PAUSED"].includes(state.phase))throw new ForbiddenWordError("انتهى رابط مقدّم التلميحات",403,"CLUE_ACCESS_DENIED");}
}
export async function createForbiddenSession(hostId:string,names:[string,string]){
  const clean=names.map(n=>n.trim().replace(/\s+/g," "));if(clean.some(n=>n.length<2||n.length>60)||clean[0]===clean[1])throw new ForbiddenWordError("اختر اسمين مختلفين للفريقين",400);
  const game=await db().gameType.findUnique({where:{slug:"secret-word"}});if(!game?.enabled)throw new ForbiddenWordError("اللعبة غير متاحة",404);
  const id=await db().$transaction(async tx=>{const session=await tx.gameSession.create({data:{hostId,gameTypeId:game.id,state:json(lobby()),config:{roundMs:60_000,roundsPerTeam:3,rematchCredit:"FREE_IN_SAME_SESSION",correct:1,skip:0,foul:-1,scoreFloor:0}}});await tx.team.createMany({data:clean.map((name,position)=>({sessionId:session.id,name,position,color:TEAM_COLORS[position]}))});await recordEvent(tx,"GAME_CREATED",hostId,{sessionId:session.id,gameSlug:"secret-word"});return session.id;});return getForbiddenView(id,{kind:"HOST",id:hostId});
}
async function saveState(tx:Prisma.TransactionClient,session:Session,next:State,key:string,type:string,hash:string|null,now:Date){
  await tx.gameCommand.create({data:{sessionId:session.id,key,type,payloadHash:hash,stateVersion:session.stateVersion+1}});
  const changed=await tx.gameSession.updateMany({where:{id:session.id,stateVersion:session.stateVersion},data:{state:json(next),stateVersion:{increment:1},currentRoundNumber:next.roundIndex+1,status:next.phase==="PAUSED"?"PAUSED":next.phase==="COMPLETED"?"COMPLETED":next.phase==="ABANDONED"?"ABANDONED":"IN_PROGRESS",...(type==="START"?{startedAt:now,creditConsumedAt:now}:{}),...(["COMPLETE","ABANDON"].includes(type)?{endedAt:now}:{}),...(type==="REMATCH"?{endedAt:null}:{})}});if(!changed.count)throw new ForbiddenWordError("تغيرت المباراة",409,"STALE_GAME_STATE");
}
async function expireLocked(tx:Prisma.TransactionClient,session:Session,state:State,now:Date){
  const next=timeout(state,now.getTime());const useId=currentUse(state);if(useId)await tx.forbiddenWordCardUse.update({where:{id:useId},data:{result:"TIMEOUT",resolvedAt:now}});
  await saveState(tx,session,next,`timeout:${state.matchNumber}:${state.roundIndex}`,"ROUND_TIMEOUT",null,now);
}
async function resolveTimeout(id:string){await db().$transaction(async tx=>{await lock(tx,id);const session=await tx.gameSession.findUnique({where:{id},include}),state=stateOf(session);if(expired(state,Date.now()))await expireLocked(tx,session!,state,new Date());});}
export async function getForbiddenView(id:string,actor:Audience){
  let session=await db().gameSession.findUnique({where:{id},include}),state=stateOf(session);await authorize(session!,state,actor);
  if(expired(state,Date.now())){await resolveTimeout(id);session=await db().gameSession.findUnique({where:{id},include});state=stateOf(session);await authorize(session!,state,actor);}
  const common={id,version:session!.stateVersion,serverNow:new Date().toISOString(),teams:session!.teams.map((t,i)=>({id:t.id,name:t.name,color:t.color,position:t.position,score:state.scores[i]}))};
  if(actor.kind==="DISPLAY")return {...common,...tvProjection(state)};
  const useId=currentUse(state),use=useId?await db().forbiddenWordCardUse.findUnique({where:{id:useId}}):null,card=use?.snapshot as unknown as Card|null;
  if(actor.kind==="CLUE")return {...common,...clueProjection(state,card)};
  return {...common,...hostProjection(state,card)};
}
export type ForbiddenView=Awaited<ReturnType<typeof getForbiddenView>>;
export type HostView=ForbiddenView&ReturnType<typeof hostProjection>;
export type ClueView=ForbiddenView&ReturnType<typeof clueProjection>;
async function selectDeck(tx:Prisma.TransactionClient,id:string,hostId:string,state:State){
  const [cards,recent]=await Promise.all([tx.forbiddenWordCard.findMany({where:{status:"PUBLISHED",locale:"ar-SA",category:{active:true}},orderBy:{id:"asc"},take:2000}),tx.forbiddenWordCardUse.findMany({where:{session:{hostId},servedAt:{not:null}},orderBy:{servedAt:"desc"},take:80,select:{cardId:true}})]);
  const deck=orderedPool(cards.filter(validCard),recent.map(c=>c.cardId),randomInt).slice(0,300);if(deck.length<30)throw new ForbiddenWordError("أضف ٣٠ بطاقة منشورة صالحة على الأقل",409,"CARD_BANK_TOO_SMALL");
  // Lock bank rows in stable order to avoid deadlocks between simultaneous starts.
  await tx.$queryRawUnsafe('SELECT "id" FROM "ForbiddenWordCard" WHERE "id" = ANY($1::text[]) ORDER BY "id" FOR SHARE',deck.map(c=>c.id));
  const current=await tx.forbiddenWordCard.findMany({where:{id:{in:deck.map(c=>c.id)},status:"PUBLISHED",category:{active:true}}});const byId=new Map(current.map(c=>[c.id,c]));
  const uses=deck.map((c,position)=>{const card=byId.get(c.id);if(!card||!validCard(card))throw new ForbiddenWordError("تغير بنك البطاقات؛ أعد البدء",409,"CONTENT_CHANGED");return {id:randomUUID(),sessionId:id,cardId:c.id,matchNumber:state.matchNumber+1,position,snapshot:json({targetWord:card.targetWord,forbiddenWords:[...card.forbiddenWords]})};});await tx.forbiddenWordCardUse.createMany({data:uses});return uses.map(u=>u.id);
}
export async function applyForbiddenCommand(id:string,hostId:string,key:string,expectedVersion:number,action:Action){
  const hash=createHash("sha256").update(JSON.stringify({hostId,action})).digest("hex");
  const outcome=await db().$transaction(async tx=>{
    await lock(tx,id);const session=await tx.gameSession.findUnique({where:{id},include}),state=stateOf(session);if(session!.hostId!==hostId)throw new ForbiddenWordError("غير مصرح بهذا الأمر",403);
    const prior=await tx.gameCommand.findUnique({where:{sessionId_key:{sessionId:id,key}}});if(prior){if(prior.payloadHash!==hash)throw new ForbiddenWordError("معرّف الأمر مستخدم لإجراء مختلف",409,"COMMAND_KEY_REUSED");return "DUPLICATE";}
    const now=new Date();if(expired(state,now.getTime())&&action.type!=="END_ROUND"){await expireLocked(tx,session!,state,now);return "EXPIRED";}
    if(session!.stateVersion!==expectedVersion)throw new ForbiddenWordError("تغيرت المباراة؛ حدّث الحالة",409,"STALE_GAME_STATE");let next:State;
    if(action.type==="START"||action.type==="REMATCH"){
      assertPhase(state,action.type==="START"?"LOBBY":"COMPLETED");if(session!.teams.length!==2||session!.teams.some((t,i)=>t.position!==i))throw new ForbiddenWordError("ترتيب الفريقين غير صالح",400);
      next=freshMatch(state,session!.teams.map(t=>t.id),await selectDeck(tx,id,hostId,state),(session!.config as {roundMs:number}).roundMs);
      if(action.type==="START")await consumeGameCredit(tx,hostId,id,Boolean(session!.creditConsumedAt));await recordEvent(tx,"GAME_STARTED",hostId,{sessionId:id,gameSlug:"secret-word"});
    }else next=transition(state,action,now.getTime());
    const before=currentUse(state),after=currentUse(next);
    if(["CORRECT","SKIP","FOUL"].includes(action.type)&&before)await tx.forbiddenWordCardUse.update({where:{id:before},data:{result:action.type,resolvedAt:now}});
    if(action.type==="END_ROUND"&&before)await tx.forbiddenWordCardUse.update({where:{id:before},data:{result:"TIMEOUT",resolvedAt:now}});
    if(action.type==="UNDO"){
      if(before)await tx.forbiddenWordCardUse.update({where:{id:before},data:{servedAt:null,roundIndex:null,result:null,resolvedAt:null}});
      if(after)await tx.forbiddenWordCardUse.update({where:{id:after},data:{result:null,resolvedAt:null}});
    }
    if(after&&next.phase==="CARD_ACTIVE"&&(action.type==="START_ROUND"||after!==before))await tx.forbiddenWordCardUse.update({where:{id:after},data:{servedAt:now,roundIndex:next.roundIndex}});
    for(let i=0;i<session!.teams.length;i++){
      const delta=next.scores[i]-state.scores[i],judgment=["CORRECT","SKIP","FOUL","UNDO"].includes(action.type)&&i===state.roundIndex%2;
      if(delta||judgment){await tx.team.update({where:{id:session!.teams[i].id},data:{score:next.scores[i]}});await tx.scoreEvent.create({data:{sessionId:id,teamId:session!.teams[i].id,delta,reason:`FORBIDDEN_${action.type}_M${next.matchNumber}_R${next.roundIndex+1}`,commandKey:`${id}:${key}:${i}`}});}
    }
    await saveState(tx,session!,next,key,action.type,hash,now);
    if(action.type==="START_ROUND")await recordEvent(tx,"QUESTION_OPENED",hostId,{sessionId:id,gameSlug:"secret-word"});
    if(["CORRECT","SKIP","FOUL"].includes(action.type))await recordEvent(tx,"QUESTION_ANSWERED",hostId,{sessionId:id,gameSlug:"secret-word"});
    if(action.type==="COMPLETE")await recordEvent(tx,"GAME_COMPLETED",hostId,{sessionId:id,gameSlug:"secret-word"});return "ACCEPTED";
  },{timeout:20_000});
  if(outcome==="EXPIRED")throw new ForbiddenWordError("انتهى وقت الجولة",409,"TIMER_EXPIRED");
  return {session:await getForbiddenView(id,{kind:"HOST",id:hostId}),duplicate:outcome==="DUPLICATE"};
}
export async function createForbiddenDisplayAccess(hostId:string,id:string){
  await getForbiddenView(id,{kind:"HOST",id:hostId});const token=newToken();const expiresAt=await db().$transaction(async tx=>{await lock(tx,id);const session=await tx.gameSession.findUniqueOrThrow({where:{id},select:{endedAt:true}}),now=new Date(),end=displayWindowEndsAt(session.endedAt,now);if(session.endedAt&&!end)throw new ForbiddenWordError("انتهت فترة العرض",410);
    const [recent,active]=await Promise.all([tx.displayAccess.count({where:{sessionId:id,createdAt:{gte:new Date(now.getTime()-DISPLAY_LINK_WINDOW_MS)}}}),tx.displayAccess.count({where:{sessionId:id,revokedAt:null,expiresAt:{gt:now}}})]);if(recent>=DISPLAY_LINKS_PER_WINDOW||active>=DISPLAY_ACTIVE_LINK_LIMIT)throw new ForbiddenWordError("وصلت إلى حد روابط العرض",429,"DISPLAY_LINK_RATE_LIMIT");
    const expiresAt=new Date(Math.min(now.getTime()+DISPLAY_TOKEN_TTL_MS,end?.getTime()??Infinity));await tx.displayAccess.create({data:{sessionId:id,tokenHash:tokenHash(token),expiresAt}});return expiresAt;});return {token,expiresAt};
}
export async function revokeForbiddenDisplayAccess(hostId:string,id:string){await getForbiddenView(id,{kind:"HOST",id:hostId});await db().displayAccess.updateMany({where:{sessionId:id,revokedAt:null},data:{revokedAt:new Date()}});}
export async function createClueAccess(hostId:string,id:string){
  await getForbiddenView(id,{kind:"HOST",id:hostId});const token=newToken();const expiresAt=await db().$transaction(async tx=>{await lock(tx,id);const session=await tx.gameSession.findUnique({where:{id},include}),state=stateOf(session);assertPhase(state,"CARD_ACTIVE");if(expired(state,Date.now()))throw new ForbiddenWordError("انتهى وقت الجولة");const now=new Date();const recent=await tx.forbiddenClueAccess.count({where:{sessionId:id,createdAt:{gte:new Date(now.getTime()-DISPLAY_LINK_WINDOW_MS)}}});if(recent>=DISPLAY_LINKS_PER_WINDOW)throw new ForbiddenWordError("وصلت إلى حد روابط التلميحات",429);
    await tx.forbiddenClueAccess.updateMany({where:{sessionId:id,revokedAt:null},data:{revokedAt:now}});const expiresAt=new Date(now.getTime()+DISPLAY_TOKEN_TTL_MS);await tx.forbiddenClueAccess.create({data:{sessionId:id,tokenHash:tokenHash(token),matchNumber:state.matchNumber,roundIndex:state.roundIndex,expiresAt}});return expiresAt;});return {token,expiresAt};
}
export async function revokeClueAccess(hostId:string,id:string){await getForbiddenView(id,{kind:"HOST",id:hostId});await db().forbiddenClueAccess.updateMany({where:{sessionId:id,revokedAt:null},data:{revokedAt:new Date()}});}
