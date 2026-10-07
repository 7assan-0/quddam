import {createHash, randomInt, randomUUID} from "node:crypto";
import {cookies} from "next/headers";
import type {Prisma} from "@/generated/prisma/client";
import {db} from "@/lib/db";
import {newToken, tokenHash} from "@/lib/auth/crypto";
import {consumeGameCredit} from "@/lib/billing/credits";
import {recordEvent, type EventName} from "@/lib/analytics/events";
import {roomCode} from "@/lib/rooms/service";
import {DISPLAY_ACTIVE_LINK_LIMIT, DISPLAY_LINKS_PER_WINDOW, DISPLAY_LINK_WINDOW_MS, DISPLAY_TOKEN_TTL_MS, displayAccessValid, displayWindowEndsAt} from "@/lib/games/category-board/display-policy";
import {BluffError, lobby, freshMatch, transition, beginVoting, reveal, expired, phaseIs, assertPlayerCount, validateFake, validateVote, validateQuestion, scoreRound, mixChoices, recentPool, leaderboard, winners, boundedText, type Action, type State, type Snapshot, type Choice, type Fake, type Vote, type Points} from "./module";
export type Actor = {kind:"HOST"; id:string} | {kind:"PLAYER" | "DISPLAY"; token:string};
export const cookieName=(id:string)=>`qalba_bluff_${id}`;
const json=(value:unknown)=>value as Prisma.InputJsonValue;
const include={gameType:{select:{slug:true}},room:true,bluffParticipants:{orderBy:{position:"asc" as const}}};
type Session=Prisma.GameSessionGetPayload<{include:typeof include}>;
const roundInclude={answers:{orderBy:{createdAt:"asc" as const}},votes:true,scores:true};
type Round=Prisma.BluffRoundGetPayload<{include:typeof roundInclude}>;
const lock=(tx:Prisma.TransactionClient,id:string)=>tx.$queryRawUnsafe('SELECT "id" FROM "GameSession" WHERE "id"=$1 FOR UPDATE',id);
function stateOf(session:Session|null):State {
  if(!session||session.gameType.slug!=="bluff")throw new BluffError("الغرفة غير موجودة",404);
  const state=session.state as unknown as State;
  if(state.module!=="BLUFF_GAME"||state.schemaVersion!==1)throw new BluffError("الجلسة لا تتبع صدّقني",404);
  return state;
}
export function authorizeParticipant(participants:{id:string;tokenHash:string}[],token:string) {
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new BluffError("انتهى وصول اللاعب",403,"PARTICIPANT_ACCESS_DENIED");
  const participant=participants.find(p=>p.tokenHash===tokenHash(token));
  if(!participant)throw new BluffError("انتهى وصول اللاعب",403,"PARTICIPANT_ACCESS_DENIED");
  return participant.id;
}
async function authorize(session:Session,actor:Actor,client:Prisma.TransactionClient=db()) {
  if(actor.kind==="HOST"){if(session.hostId!==actor.id)throw new BluffError("غير مصرح بإدارة المباراة",403);return null;}
  if(actor.kind==="PLAYER"){
    if(!session.room||session.room.expiresAt.getTime()<=Date.now())throw new BluffError("انتهت الغرفة",403);
    return authorizeParticipant(session.bluffParticipants,actor.token);
  }
  if(!/^[A-Za-z0-9_-]{43}$/.test(actor.token))throw new BluffError("رابط العرض غير صالح",403);
  const access=await client.displayAccess.findUnique({where:{tokenHash:tokenHash(actor.token)}});
  if(!access||access.sessionId!==session.id||!displayAccessValid(access,session,new Date()))throw new BluffError("انتهى وصول العرض",403,"DISPLAY_ACCESS_DENIED");
  return null;
}
export async function playerActor(id:string):Promise<Actor>{return {kind:"PLAYER",token:(await cookies()).get(cookieName(id))?.value??""};}
export async function createBluffSession(hostId:string) {
  const game=await db().gameType.findUnique({where:{slug:"bluff"}});if(!game?.enabled)throw new BluffError("اللعبة غير متاحة",404);
  for(let attempt=0;attempt<8;attempt++){
    try{
      const id=await db().$transaction(async tx=>{
        const id=randomUUID();await tx.gameSession.create({data:{id,hostId,gameTypeId:game.id,state:json(lobby()),config:{rounds:5,submissionMs:45000,votingMs:30000,correctPoints:2,bluffPoints:1,rematchCredit:"FREE_IN_SAME_SESSION",voteUpdates:false}}});
        const room=await tx.room.create({data:{hostId,sessionId:id,code:roomCode(),expiresAt:new Date(Date.now()+8*3600000)}});
        await recordEvent(tx,"GAME_CREATED",hostId,{sessionId:id,gameSlug:"bluff"});await recordEvent(tx,"ROOM_CREATED",hostId,{sessionId:id,roomId:room.id});return id;
      });return getBluffView(id,{kind:"HOST",id:hostId});
    }catch(error){if((error as {code?:string}).code!=="P2002"||attempt===7)throw error;}
  }
  throw new BluffError("تعذّر إنشاء الغرفة",503);
}
export async function previewBluff(code:string) {
  if(!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code))throw new BluffError("رمز الغرفة غير صالح",400);
  const room=await db().room.findUnique({where:{code},include:{session:{include:{gameType:{select:{slug:true}}}}}});
  const session=room?.session,state=session?.state as unknown as State;
  if(!room||room.expiresAt.getTime()<=Date.now()||session?.gameType.slug!=="bluff"||state?.module!=="BLUFF_GAME")throw new BluffError("الغرفة غير متاحة",404);
  return {id:session.id,code:room.code,phase:state.phase};
}
export async function joinBluff(id:string,code:string,name:string,existingToken?:string,userId?:string) {
  const clean=boundedText(name,60);if(clean.length<2)throw new BluffError("اكتب اسمًا من حرفين على الأقل",400);
  if(existingToken){try{const view=await getBluffView(id,{kind:"PLAYER",token:existingToken});if(view.code!==code)throw new BluffError("رمز الغرفة غير صالح",400);return {id,participantId:view.self!.id};}catch(error){if(!(error instanceof BluffError&&error.status===403))throw error;}}
  const token=newToken();const joined=await db().$transaction(async tx=>{
    await lock(tx,id);const session=await tx.gameSession.findUnique({where:{id},include}),state=stateOf(session);phaseIs(state,"LOBBY");
    if(!session!.room||session!.room.code!==code||session!.room.expiresAt.getTime()<=Date.now())throw new BluffError("الغرفة غير متاحة",404);
    if(userId===session!.hostId)throw new BluffError("المضيف يدير الجولة؛ انضم من جهاز لاعب",400);
    if(session!.bluffParticipants.length>=12)throw new BluffError("الغرفة مكتملة",400,"PLAYER_COUNT");
    if(session!.bluffParticipants.some(p=>p.name.toLocaleLowerCase("ar")===clean.toLocaleLowerCase("ar")))throw new BluffError("الاسم مستخدم",409);
    const p=await tx.bluffParticipant.create({data:{sessionId:id,name:clean,position:session!.bluffParticipants.length,tokenHash:tokenHash(token)}});
    await tx.gameSession.update({where:{id},data:{stateVersion:{increment:1}}});await tx.room.update({where:{id:session!.room.id},data:{version:{increment:1}}});
    await recordEvent(tx,"ROOM_JOINED",null,{sessionId:id,roomId:session!.room.id});return {participantId:p.id,expiresAt:session!.room.expiresAt};
  });
  (await cookies()).set(cookieName(id),token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",expires:joined.expiresAt});
  return {id,participantId:joined.participantId};
}
async function currentRound(client:Prisma.TransactionClient,state:State) {
  const id=state.roundIds[state.roundIndex];return id?client.bluffRound.findUnique({where:{id},include:roundInclude}):null;
}
export function publicRoundProjection(state:State,round:{snapshot:Snapshot;choices:Choice[];answers:Fake[];votes:Vote[];scores:Points[];scoredAt:Date|null}|null) {
  const phase=state.phase==="PAUSED"?state.pausedPhase:state.phase;
  const hasQuestion=Boolean(round)&&!["LOBBY","ROUND_INTRO","ABANDONED"].includes(phase??"");
  const revealed=Boolean(round?.scoredAt)&&["REVEAL","ROUND_RESULTS","FINAL_RESULTS","COMPLETED"].includes(phase??"");
  return {
    question:hasQuestion?round!.snapshot.question:null,
    submissionCount:round?.answers.filter(a=>!a.hiddenAt).length??0,voteCount:round?.votes.length??0,
    choices:phase==="VOTING"?round!.choices.map(c=>({id:c.id,text:c.text})):[],
    reveal:revealed?{correctAnswer:round!.snapshot.correctAnswer,explanation:round!.snapshot.explanation,choices:round!.choices.map(c=>({...c,voterIds:round!.votes.filter(v=>v.choiceId===c.id).map(v=>v.participantId)})),scores:round!.scores.map(p=>({participantId:p.participantId,correctPoints:p.correctPoints,bluffPoints:p.bluffPoints,total:p.total}))}:null,
  };
}
function asProjectionRound(round:Round|null) {return round?{snapshot:round.snapshot as unknown as Snapshot,choices:round.choices as unknown as Choice[],answers:round.answers,votes:round.votes,scores:round.scores,scoredAt:round.scoredAt}:null;}
export async function getBluffView(id:string,actor:Actor) {
  let session=await db().gameSession.findUnique({where:{id},include}),state=stateOf(session);let selfId=await authorize(session!,actor);
  if(expired(state,Date.now())){await resolveTimeout(id);session=await db().gameSession.findUnique({where:{id},include});state=stateOf(session);selfId=await authorize(session!,actor);}
  const round=await currentRound(db(),state),publicData=publicRoundProjection(state,asProjectionRound(round));
  const participants=session!.bluffParticipants.map(p=>({id:p.id,name:p.name,position:p.position,score:p.score}));
  const self=participants.find(p=>p.id===selfId),ownAnswer=round?.answers.find(a=>a.participantId===selfId),ownVote=round?.votes.find(v=>v.participantId===selfId);
  const final=["FINAL_RESULTS","COMPLETED"].includes(state.phase),phase=state.phase==="PAUSED"?state.pausedPhase:state.phase;
  return {id,version:session!.stateVersion,serverNow:new Date().toISOString(),code:session!.room!.code,phase:state.phase,pausedPhase:state.pausedPhase,matchNumber:state.matchNumber,roundNumber:state.roundIndex+1,roundCount:state.roundCount,roundId:state.roundIds[state.roundIndex]??null,deadlineAt:state.deadlineAt,remainingMs:state.remainingMs,submissionsClosed:state.submissionsClosed,lastEvent:[...state.lastEvent],participants,leaderboard:leaderboard(participants),winnerIds:final?winners(participants):[],...publicData,
    ...(actor.kind==="PLAYER"?{self:self?{...self,submitted:Boolean(ownAnswer),fakeAnswer:ownAnswer?.hiddenAt?null:ownAnswer?.text??null,answerHidden:Boolean(ownAnswer?.hiddenAt),ownChoiceId:phase==="VOTING"?(round?.choices as unknown as Choice[]).find(c=>c.ownerId===selfId)?.id??null:null,voted:Boolean(ownVote),choiceId:ownVote?.choiceId??null}:null}:{}),
    ...(actor.kind==="HOST"?{canUndo:state.phase==="FAKE_SUBMISSION"&&state.submissionsClosed&&state.canUndoClose,canCloseVoting:state.phase==="VOTING"&&publicData.voteCount===participants.length,moderationQueue:phase==="FAKE_SUBMISSION"&&state.submissionsClosed?round!.answers.filter(a=>!a.hiddenAt).map(a=>({id:a.id,text:a.text})):[],displayLinks:await db().displayAccess.findMany({where:{sessionId:id,revokedAt:null,expiresAt:{gt:new Date()}},select:{id:true,expiresAt:true}}).then(links=>links.map(link=>({id:link.id,expiresAt:link.expiresAt.toISOString()})))}:{}),
  };
}
export type BluffView=Awaited<ReturnType<typeof getBluffView>>;
async function save(tx:Prisma.TransactionClient,session:Session,state:State,key:string,type:string,hash:string|null,now:Date) {
  await tx.gameCommand.create({data:{sessionId:session.id,key,type,payloadHash:hash,stateVersion:session.stateVersion+1}});
  const status=state.phase==="LOBBY"?"LOBBY":state.phase==="PAUSED"?"PAUSED":state.phase==="COMPLETED"?"COMPLETED":state.phase==="ABANDONED"?"ABANDONED":"IN_PROGRESS";
  const result=await tx.gameSession.updateMany({where:{id:session.id,stateVersion:session.stateVersion},data:{state:json(state),stateVersion:{increment:1},status,currentRoundNumber:state.roundIndex+1,...(type==="START"?{startedAt:now,creditConsumedAt:now}:{}),...(["COMPLETE","ABANDON"].includes(type)?{endedAt:now}:{}),...(type==="REMATCH"?{endedAt:null}:{})}});
  if(result.count!==1)throw new BluffError("تغيّرت المباراة",409,"STALE_GAME_STATE");
}
async function audit(tx:Prisma.TransactionClient,event:EventName,session:Session) {await recordEvent(tx,event,session.hostId,{sessionId:session.id,gameSlug:"bluff"});}
async function makeChoices(tx:Prisma.TransactionClient,round:Round) {
  const choices=mixChoices(round.snapshot as unknown as Snapshot,round.answers,randomInt,randomUUID);
  await tx.bluffRound.update({where:{id:round.id},data:{choices:json(choices),submissionsClosedAt:new Date()}});return choices;
}
async function resolveRound(tx:Prisma.TransactionClient,session:Session,state:State,round:Round,now:Date) {
  if(round.scoredAt)throw new BluffError("الجولة محسوبة بالفعل",409,"ROUND_ALREADY_SCORED");
  const points=scoreRound(session.bluffParticipants.map(p=>p.id),round.choices as unknown as Choice[],round.votes);
  await tx.bluffScore.createMany({data:points.map(p=>({...p,roundId:round.id}))});
  for(const p of points){await tx.bluffParticipant.update({where:{id:p.participantId},data:{score:{increment:p.total}}});await tx.scoreEvent.create({data:{sessionId:session.id,delta:p.total,reason:`BLUFF_R${round.number}_TRUTH_${p.correctPoints}_BLUFF_${p.bluffPoints}`,commandKey:`${round.id}:${p.participantId}`}});}
  await tx.bluffRound.update({where:{id:round.id},data:{scoredAt:now}});await audit(tx,"BLUFF_REVEALED",session);return reveal(state);
}
async function expireLocked(tx:Prisma.TransactionClient,session:Session,state:State,now:Date,key?:string,hash?:string) {
  const round=(await currentRound(tx,state))!;let next:State;
  if(state.phase==="FAKE_SUBMISSION"){await makeChoices(tx,round);next=beginVoting(state,now.getTime());await audit(tx,"BLUFF_VOTING_STARTED",session);}
  else next=await resolveRound(tx,session,state,round,now);
  await save(tx,session,next,key??`timer:${state.matchNumber}:${state.roundIndex}:${state.phase}`,state.phase==="VOTING"?"CLOSE_VOTING":"BEGIN_VOTING",hash??null,now);
}
async function resolveTimeout(id:string) {await db().$transaction(async tx=>{await lock(tx,id);const session=await tx.gameSession.findUnique({where:{id},include}),state=stateOf(session);if(expired(state,Date.now()))await expireLocked(tx,session!,state,new Date());},{timeout:20000});}
async function selectRounds(tx:Prisma.TransactionClient,session:Session,state:State) {
  const [questions,recent]=await Promise.all([tx.bluffQuestion.findMany({where:{status:"PUBLISHED",locale:"ar-SA",category:{active:true}},orderBy:{id:"asc"},take:2000}),tx.bluffRound.findMany({where:{session:{hostId:session.hostId}},orderBy:{selectedAt:"desc"},take:50,select:{questionId:true}})]);
  const valid=questions.filter(q=>{try{return validateQuestion(q);}catch{return false;}}),chosen=recentPool(valid,recent.map(r=>r.questionId),randomInt).slice(0,state.roundCount);
  if(chosen.length!==state.roundCount)throw new BluffError("أضف خمسة أسئلة منشورة صالحة على الأقل",409,"QUESTION_BANK_TOO_SMALL");
  await tx.$queryRawUnsafe('SELECT "id" FROM "BluffQuestion" WHERE "id"=ANY($1::text[]) ORDER BY "id" FOR SHARE',chosen.map(q=>q.id));
  const current=await tx.bluffQuestion.findMany({where:{id:{in:chosen.map(q=>q.id)},status:"PUBLISHED",category:{active:true}}});
  const ids:string[]=[];
  for(const [index,q] of chosen.entries()) {const latest=current.find(v=>v.id===q.id);if(!latest)throw new BluffError("تغيّر بنك الأسئلة؛ أعد البدء",409);validateQuestion(latest);const id=randomUUID();ids.push(id);await tx.bluffRound.create({data:{id,sessionId:session.id,questionId:q.id,matchNumber:state.matchNumber+1,number:index+1,snapshot:json({question:latest.question,correctAnswer:latest.correctAnswer,alternativeCorrectAnswers:[...latest.alternativeCorrectAnswers],explanation:latest.explanation})}});}
  return ids;
}
export async function applyBluffCommand(id:string,actor:Actor,key:string,expectedVersion:number,action:Action) {
  if(actor.kind==="DISPLAY")throw new BluffError("العرض للقراءة فقط",403);
  const result=await db().$transaction(async tx=>{
    await lock(tx,id);const session=await tx.gameSession.findUnique({where:{id},include}),state=stateOf(session),selfId=await authorize(session!,actor,tx);
    const isPlayer=["SUBMIT_FAKE","SUBMIT_VOTE"].includes(action.type);
    if(isPlayer!==(actor.kind==="PLAYER"))throw new BluffError("غير مصرح بهذا الإجراء",403);
    const hash=createHash("sha256").update(JSON.stringify({actor:actor.kind==="HOST"?actor.id:selfId,action})).digest("hex");
    const prior=await tx.gameCommand.findUnique({where:{sessionId_key:{sessionId:id,key}}});
    if(prior){if(prior.payloadHash!==hash)throw new BluffError("معرّف الأمر مستخدم لإجراء مختلف",409,"COMMAND_KEY_REUSED");return "DUPLICATE";}
    const now=new Date();
    if(expired(state,now.getTime())) {const closing=state.phase==="VOTING"&&action.type==="CLOSE_VOTING";await expireLocked(tx,session!,state,now,closing?key:undefined,closing?hash:undefined);return closing?"ACCEPTED":"EXPIRED";}
    // Private inputs rebase across other players' accepted inputs in this SAME
    // round and phase. Host transitions keep strict optimistic concurrency.
    if(actor.kind==="HOST"?session!.stateVersion!==expectedVersion:expectedVersion>session!.stateVersion)throw new BluffError("تغيّرت المباراة؛ حدّث الحالة",409,"STALE_GAME_STATE");
    let next=state;const round=await currentRound(tx,state);
    if(action.type==="START"||action.type==="REMATCH") {
      phaseIs(state,action.type==="START"?"LOBBY":"COMPLETED");assertPlayerCount(session!.bluffParticipants.length);
      if(session!.bluffParticipants.some((p,i)=>p.position!==i))throw new BluffError("ترتيب اللاعبين غير صالح",500);
      next=freshMatch(state,await selectRounds(tx,session!,state));await tx.bluffParticipant.updateMany({where:{sessionId:id},data:{score:0}});
      if(action.type==="START")await consumeGameCredit(tx,session!.hostId,id,Boolean(session!.creditConsumedAt));await audit(tx,"BLUFF_GAME_STARTED",session!);
    }else if(action.type==="REMOVE_PARTICIPANT") {
      phaseIs(state,"LOBBY");if(!session!.bluffParticipants.some(p=>p.id===action.participantId))throw new BluffError("اللاعب غير موجود",404);
      await tx.bluffParticipant.delete({where:{id:action.participantId}});
      const rest=session!.bluffParticipants.filter(p=>p.id!==action.participantId);
      // Two passes avoid collisions with the unique persisted positions.
      for(const [i,p] of rest.entries())await tx.bluffParticipant.update({where:{id:p.id},data:{position:100+i}});
      for(const [i,p] of rest.entries())await tx.bluffParticipant.update({where:{id:p.id},data:{position:i}});
      await tx.room.update({where:{id:session!.room!.id},data:{version:{increment:1}}});next={...state,lastEvent:["PARTICIPANT_REMOVED"]};
    }else if(action.type==="SUBMIT_FAKE") {
      phaseIs(state,"FAKE_SUBMISSION");if(action.roundId!==round?.id)throw new BluffError("انتهت الجولة السابقة",409,"ROUND_CHANGED");if(state.submissionsClosed)throw new BluffError("انتهى استقبال الإجابات",409,"SUBMISSIONS_CLOSED");
      if(round.answers.some(a=>a.participantId===selfId))throw new BluffError("تم تسجيل إجابتك بالفعل",409,"ALREADY_SUBMITTED");
      const policy=await tx.featureFlag.findUnique({where:{key:"bluff-moderation"}}),config=policy?.config as {blockedTerms?:string[]}|undefined;
      const terms=policy?.enabled&&Array.isArray(config?.blockedTerms)?config!.blockedTerms!.filter(v=>typeof v==="string"):[];
      const fake=validateFake(action.text,round.snapshot as unknown as Snapshot,round.answers,terms);
      await tx.bluffAnswer.create({data:{roundId:round.id,participantId:selfId!,...fake}});next={...state,lastEvent:["SUBMISSION_RECEIVED"]};await audit(tx,"BLUFF_SUBMISSION_RECEIVED",session!);
    }else if(action.type==="SUBMIT_VOTE") {
      phaseIs(state,"VOTING");if(action.roundId!==round?.id)throw new BluffError("انتهت الجولة السابقة",409,"ROUND_CHANGED");
      if(round.votes.some(v=>v.participantId===selfId))throw new BluffError("تم تسجيل اختيارك بالفعل",409,"ALREADY_VOTED");validateVote(selfId!,action.choiceId,round.choices as unknown as Choice[]);
      await tx.bluffVote.create({data:{roundId:round.id,participantId:selfId!,choiceId:action.choiceId}});next={...state,lastEvent:["VOTE_RECEIVED"]};await audit(tx,"BLUFF_VOTE_RECEIVED",session!);
    }else if(action.type==="CLOSE_SUBMISSIONS") {next=transition(state,action,now.getTime());await makeChoices(tx,round!);}
    else if(action.type==="BEGIN_VOTING") {
      phaseIs(state,"FAKE_SUBMISSION");if(!state.submissionsClosed&&round!.answers.length!==session!.bluffParticipants.length)throw new BluffError("أغلق استقبال الإجابات أولًا");await makeChoices(tx,round!);next=beginVoting(state,now.getTime());await audit(tx,"BLUFF_VOTING_STARTED",session!);
    }else if(action.type==="HIDE_ANSWER") {
      phaseIs(state,"FAKE_SUBMISSION");if(!state.submissionsClosed)throw new BluffError("أغلق الإجابات قبل المراجعة");const answer=round!.answers.find(a=>a.id===action.answerId&&!a.hiddenAt);if(!answer)throw new BluffError("الإجابة غير موجودة",404);
      await tx.bluffAnswer.update({where:{id:answer.id},data:{hiddenAt:now}});await tx.bluffModerationAudit.create({data:{roundId:round!.id,answerId:answer.id,hostId:session!.hostId,reason:boundedText(action.reason,200)}});
      await tx.bluffRound.update({where:{id:round!.id},data:{choices:json([])}});next={...state,canUndoClose:false,lastEvent:["ANSWER_MODERATED"]};
    }else if(action.type==="CLOSE_VOTING") {
      phaseIs(state,"VOTING");if(round!.votes.length!==session!.bluffParticipants.length)throw new BluffError("انتظر اكتمال التصويت أو انتهاء المؤقت",409,"VOTING_STILL_OPEN");next=await resolveRound(tx,session!,state,round!,now);
    }else {next=transition(state,action,now.getTime());
      if(action.type==="START_ROUND"){await tx.bluffRound.update({where:{id:round!.id},data:{openedAt:now}});await audit(tx,"BLUFF_ROUND_STARTED",session!);}
      if(action.type==="UNDO")await tx.bluffRound.update({where:{id:round!.id},data:{choices:json([]),submissionsClosedAt:null}});
      if(action.type==="ADVANCE_REVEAL")await audit(tx,"BLUFF_ROUND_COMPLETED",session!);
      if(action.type==="COMPLETE")await audit(tx,"BLUFF_GAME_COMPLETED",session!);
    }
    await save(tx,session!,next,key,action.type,hash,now);return "ACCEPTED";
  },{timeout:20000});
  if(result==="EXPIRED")throw new BluffError("انتهى الوقت؛ انتقلت الجولة للمرحلة التالية",409,"TIMER_EXPIRED");
  return {session:await getBluffView(id,actor),duplicate:result==="DUPLICATE"};
}
export async function createBluffDisplayAccess(hostId:string,id:string) {
  await getBluffView(id,{kind:"HOST",id:hostId});const token=newToken();
  const expiresAt=await db().$transaction(async tx=>{await lock(tx,id);const session=await tx.gameSession.findUniqueOrThrow({where:{id},select:{endedAt:true}}),now=new Date(),end=displayWindowEndsAt(session.endedAt,now);if(session.endedAt&&!end)throw new BluffError("انتهت فترة العرض",410);
    const [active,recent]=await Promise.all([tx.displayAccess.count({where:{sessionId:id,revokedAt:null,expiresAt:{gt:now}}}),tx.displayAccess.count({where:{sessionId:id,createdAt:{gte:new Date(now.getTime()-DISPLAY_LINK_WINDOW_MS)}}})]);
    if(active>=DISPLAY_ACTIVE_LINK_LIMIT||recent>=DISPLAY_LINKS_PER_WINDOW)throw new BluffError("وصلت إلى حد روابط العرض",429,"DISPLAY_LINK_RATE_LIMIT");const expiresAt=new Date(Math.min(now.getTime()+DISPLAY_TOKEN_TTL_MS,end?.getTime()??Infinity));await tx.displayAccess.create({data:{sessionId:id,tokenHash:tokenHash(token),expiresAt}});return expiresAt;});return {token,expiresAt};
}
export async function revokeBluffDisplayAccess(hostId:string,id:string) {await getBluffView(id,{kind:"HOST",id:hostId});await db().displayAccess.updateMany({where:{sessionId:id,revokedAt:null},data:{revokedAt:new Date()}});}
