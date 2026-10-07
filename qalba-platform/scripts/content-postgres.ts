import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync,readFileSync} from 'node:fs';
import {remediateContent} from '../src/lib/content/remediate';
import plan from '../prisma/content-remediation-plan.json';
import {duplicateOrderingIds} from '../prisma/content-remediations';
import {spawnSync} from 'node:child_process';
import {Pool} from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../src/generated/prisma/client';
import {db} from '../src/lib/db';
import {newToken,tokenHash} from '../src/lib/auth/crypto';
import {grantAdminCredits} from '../src/lib/billing/credits';
import {databaseBanks} from '../src/lib/content/database';
import {auditContent,contentPolicies,type ContentGame} from '../src/lib/content/audit';
import {games,createFixture,act,view,hostId,type Game,type Fixture,financialFixture} from './database-lifecycle-fixtures';
import * as board from '../src/lib/games/category-board/service';
import * as social from '../src/lib/games/social-deduction/service';
assert.equal(process.env.CONTENT_TEST_DATABASE,'1');assert.match(process.env.DATABASE_URL??'',/127\.0\.0\.1.*\/g1_content/);
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:8});const client=new PrismaClient({adapter:new PrismaPg(pool as unknown as ConstructorParameters<typeof PrismaPg>[0])});(globalThis as unknown as {prisma:PrismaClient}).prisma=client;
const out=process.env.CONTENT_OUTPUT!;const results:{name:string;passed:boolean;detail:unknown}[]=[];const save=(name:string,data:unknown)=>writeFileSync(out+'/'+name,JSON.stringify(data,null,2));
async function check(name:string,run:()=>Promise<unknown>){const detail=await run();results.push({name,passed:true,detail});console.log('PASS',name);save('content-native.json',{sourceFingerprint:process.env.SOURCE_FINGERPRINT,passed:results.length,failed:0,cases:results});}
const slugs:Record<Game,ContentGame>={board:'category-board',social:'out-of-the-loop',letter:'letter-network',survey:'survey-show',forbidden:'secret-word',bluff:'bluff',ranked:'top-list',lightning:'lightning-quiz',ordering:'ordering-challenge',court:'the-court'};
const tables:Record<Game,string>={board:'Question',social:'SecretWord',letter:'LetterQuestion',survey:'SurveyQuestion',forbidden:'ForbiddenWordCard',bluff:'BluffQuestion',ranked:'RankedListQuestion',lightning:'LightningQuestion',ordering:'OrderingQuestion',court:'CourtCase'};
async function footprint(id?:string){return {wallet:await client.creditWallet.findUnique({where:{userId:hostId}}),credits:await client.gameCredit.findMany({where:{userId:hostId},orderBy:{id:'asc'}}),...(id?{session:await client.gameSession.findUnique({where:{id}}),commands:await client.gameCommand.findMany({where:{sessionId:id}}),scores:await client.scoreEvent.findMany({where:{sessionId:id}})}:{})};}
async function main(){
 if(process.argv.includes('--verify-browser')){const saved=JSON.parse(readFileSync(out+'/snapshots-private.json','utf8'));for(const [name,old] of Object.entries(saved)){const current=name==='social'?await client.socialRound.findMany({where:{id:{in:(old as {id:string}[]).map(x=>x.id)}}}):name==='letter'?await client.letterQuestionUse.findMany({where:{id:{in:(old as {id:string}[]).map(x=>x.id)}}}):await client.surveyQuestionUse.findMany({where:{id:{in:(old as {id:string}[]).map(x=>x.id)}}});assert.deepEqual(JSON.parse(JSON.stringify(current)),old);}save('browser-snapshot-verification.json',{passed:3,failed:0,social:true,letter:true,survey:true,privatePayloadsOmitted:true});return;}

 const version=(await pool.query('SELECT version()')).rows[0].version;assert.match(version,/^PostgreSQL /);save('Database-Version.json',{version});
 const admin=await client.user.findUniqueOrThrow({where:{email:'admin@example.test'}});await client.user.create({data:{id:hostId,email:'g1-host@example.test',name:'مضيف المحتوى',role:'USER'}});await grantAdminCredits(admin.id,"g1-host@example.test",150,randomUUID());
 const hostToken=newToken(),adminToken=newToken();await client.authSession.createMany({data:[{userId:hostId,tokenHash:tokenHash(hostToken),expiresAt:new Date(Date.now()+86400000)},{userId:admin.id,tokenHash:tokenHash(adminToken),expiresAt:new Date(Date.now()+86400000)}]});
 await check('01 PostgreSQL authored bank validation equals reviewed source capacity',async()=>{const report=auditContent(await databaseBanks(client));assert.equal(report.blockingErrors,0);assert.equal(report.games.length,10);save('database-audit.json',report);return report.games.map(g=>({game:g.game,eligible:g.eligible,capacity:g.capacity}));});
 await check('reviewed remediation: bounded dry run, existing-bank correction, repeat no-op',async()=>{
  for(const patch of plan){const keys=Object.entries(patch.before);await pool.query(`UPDATE "${patch.table}" SET ${keys.map(([k],i)=>`"${k}"=$${i+2}`).join(',')} WHERE id=$1`,[patch.id,...keys.map(([,v])=>v)]);}
  await pool.query(`UPDATE "OrderingQuestion" SET status='PUBLISHED' WHERE id=ANY($1::text[])`,[[...duplicateOrderingIds]]);
  const before=JSON.stringify(await databaseBanks(client));const dry=await remediateContent(client,false);assert.ok(dry.eligible>=14);assert.equal(JSON.stringify(await databaseBanks(client)),before);
  const applied=await remediateContent(client,true);assert.ok(applied.changed>=14);const report=auditContent(await databaseBanks(client));assert.equal(report.blockingErrors,0);const repeat=await remediateContent(client,true);assert.equal(repeat.changed,0);return {dryRunZeroMutation:true,applied,repeat};
 });
 await client.user.create({data:{id:'f1-admin',email:'g1-support@example.test',name:'دعم الاختبار',role:'ADMIN'}});await financialFixture();
 const fixtures:Fixture[]=[];
 for(const game of games)await check(`smoke ${game}: create, START, first content interaction`,async()=>{
  const f=await createFixture(game);fixtures.push(f);const before=await client.gameSession.findUniqueOrThrow({where:{id:f.id}});
  if(game==='board'){const s=before.state as {cells:{categoryId:string;value:number}[]};await act(f,{type:'OPEN',categoryId:s.cells[0].categoryId,value:s.cells[0].value});await act(f,{type:'REVEAL'});await act(f,{type:'CORRECT'});}
  else if(game==='social'){const round=await client.socialRound.findFirstOrThrow({where:{sessionId:f.id}});for(const p of f.people){const v=await social.getSocialView(f.id,{kind:'PLAYER',token:p.token});const serialized=JSON.stringify(v);if(p.id===round.outsiderId)assert.ok(!serialized.includes(round.wordSnapshot));else assert.ok(serialized.includes(round.wordSnapshot));}await act(f,{type:'BEGIN_DISCUSSION'});}
  else if(game==='letter'){const s=before.state as {board:{cellId:string}[]};await act(f,{type:'SELECT_CELL',cellId:s.board[0].cellId});await act(f,{type:'OPEN_QUESTION'});await act(f,{type:'REVEAL_ANSWER'});await act(f,{type:'CORRECT'});}
  else if(game==='survey'){await act(f,{type:'START_ROUND'});const use=await client.surveyQuestionUse.findFirstOrThrow({where:{sessionId:f.id},orderBy:{roundNumber:'asc'}});const snap=use.snapshot as {answers:{id:string}[]};await act(f,{type:'FACE_OFF_GUESS',teamIndex:0,answerId:snap.answers[0].id});}
  else if(game==='forbidden'){await act(f,{type:'PREPARE_ROUND'});await act(f,{type:'START_ROUND'});await act(f,{type:'CORRECT'});}
  else if(game==='ranked'){await act(f,{type:'START_ROUND'});const use=await client.rankedListUse.findFirstOrThrow({where:{sessionId:f.id},orderBy:{roundIndex:'asc'}});const snap=use.snapshot as {entries:{answer:string}[]};await act(f,{type:'SUBMIT_GUESS',guess:snap.entries[0].answer});}
  else if(game==='lightning'){await act(f,{type:'PREPARE_QUESTION'});await act(f,{type:'OPEN_BUZZ'});}
  else if(game==='ordering'){await act(f,{type:'START_ROUND'});}
  else if(game==='court'){await act(f,{type:'START_ROUND'});await act(f,{type:'START_PREPARATION'});}
  else if(game==='bluff'){await act(f,{type:'START_ROUND'});}
  const after=await client.gameSession.findUniqueOrThrow({where:{id:f.id}});assert.ok(after.stateVersion>before.stateVersion);await view(f);return {created:true,started:true,interaction:true,stateVersionAdvanced:true};
 });
 save('fixture-private.json',{hostToken,adminToken,fixtures});
 const snapshots={social:await client.socialRound.findMany({where:{sessionId:fixtures.find(f=>f.game==='social')!.id}}),letter:await client.letterQuestionUse.findMany({where:{sessionId:fixtures.find(f=>f.game==='letter')!.id}}),survey:await client.surveyQuestionUse.findMany({where:{sessionId:fixtures.find(f=>f.game==='survey')!.id}})};save('snapshots-private.json',snapshots);
 const sources={social:await client.secretWord.findUniqueOrThrow({where:{id:snapshots.social[0].secretWordId}}),letter:await client.letterQuestion.findUniqueOrThrow({where:{id:snapshots.letter[0].questionId}}),survey:await client.surveyQuestion.findUniqueOrThrow({where:{id:snapshots.survey[0].questionId},include:{answers:{orderBy:{position:'asc'}}}})};save('snapshot-sources-private.json',sources);save('admin-category.json',{id:(await client.category.findFirstOrThrow()).id});
 await check('seed rerun preserves accounts, financial rows, active snapshots and launch eligibility',async()=>{
  const before={users:await client.user.findMany({orderBy:{id:'asc'}}),financial:{game:await footprint(),purchases:await client.purchase.findMany(),refunds:await client.purchaseRefund.findMany(),events:await client.paymentEvent.findMany(),wallets:await client.creditWallet.findMany(),ledger:await client.gameCredit.findMany()},sessions:await client.gameSession.findMany({orderBy:{id:'asc'}}),social:await client.socialRound.findMany(),letter:await client.letterQuestionUse.findMany(),survey:await client.surveyQuestionUse.findMany(),content:(await databaseBanks(client))};
  const child=spawnSync(process.execPath,['--import','tsx','prisma/seed.ts'],{env:process.env,encoding:'utf8',timeout:60000});assert.equal(child.status,0);save('seed-rerun-output.json',{exitCode:child.status,stdout:child.stdout});
  const after={users:await client.user.findMany({orderBy:{id:'asc'}}),financial:{game:await footprint(),purchases:await client.purchase.findMany(),refunds:await client.purchaseRefund.findMany(),events:await client.paymentEvent.findMany(),wallets:await client.creditWallet.findMany(),ledger:await client.gameCredit.findMany()},sessions:await client.gameSession.findMany({orderBy:{id:'asc'}}),social:await client.socialRound.findMany(),letter:await client.letterQuestionUse.findMany(),survey:await client.surveyQuestionUse.findMany(),content:(await databaseBanks(client))};assert.deepEqual(after,before);return {allComparedLogicallyEqual:true,privateValuesExcluded:true};
 });
 await check('exhaustion board: 18 exact bucket minimum works; missing bucket creates no session/debit',async()=>{
  const bank=(await databaseBanks(client))['category-board'],eligible=bank.filter(r=>r.status==='PUBLISHED'&&r.categoryActive),selected=Object.values(Object.fromEntries(eligible.map(r=>[r.categoryId+':'+r.pointValue,r])));
  try{await pool.query(`UPDATE "Question" SET status='ARCHIVED' WHERE id=ANY($1::text[])`,[eligible.map(r=>r.id)]);await pool.query(`UPDATE "Question" SET status='PUBLISHED' WHERE id=ANY($1::text[])`,[selected.map(r=>r.id)]);assert.equal(selected.length,18);await createFixture('board');
   await pool.query(`UPDATE "Question" SET status='ARCHIVED' WHERE id=$1`,[selected[0].id]);const before={account:await footprint(),sessions:await client.gameSession.count(),commands:await client.gameCommand.count(),scores:await client.scoreEvent.count()};await assert.rejects(board.createBoardSession(hostId,{categoryIds:[...new Set(selected.map(r=>r.categoryId))],teamNames:['الأول','الثاني'],timerSeconds:60}));assert.deepEqual({account:await footprint(),sessions:await client.gameSession.count(),commands:await client.gameCommand.count(),scores:await client.scoreEvent.count()},before);return {minimum:18,noSessionCreated:true,noDebit:true,noCommand:true};
  }finally{await pool.query(`UPDATE "Question" SET status='PUBLISHED' WHERE id=ANY($1::text[])`,[eligible.map(r=>r.id)]);}
 });
 for(const game of games.filter(g=>g!=='board'))await check(`exhaustion ${game}: exact minimum starts; below minimum zero mutation/debit`,async()=>{
  const bank=(await databaseBanks(client))[slugs[game]],published=bank.filter(r=>r.status==='PUBLISHED'&&r.categoryActive);let minimum=published.slice(0,contentPolicies[slugs[game]].minimum);
  if(game==='letter'){const letters=[...new Set(published.map(r=>String(r.letter)))].slice(0,5);minimum=letters.flatMap(l=>published.filter(r=>r.letter===l).slice(0,8));}
  const table=tables[game];try{
   await pool.query(`UPDATE "${table}" SET status='ARCHIVED' WHERE id=ANY($1::text[])`,[published.map(r=>r.id)]);await pool.query(`UPDATE "${table}" SET status='PUBLISHED' WHERE id=ANY($1::text[])`,[minimum.map(r=>r.id)]);
   const exact=await createFixture(game);assert.ok(exact.id);
   const pending=await createFixture(game,false);const insufficient=game==='letter'?minimum.filter(r=>r.letter===minimum[0].letter):[minimum[0]];await pool.query(`UPDATE "${table}" SET status='ARCHIVED' WHERE id=ANY($1::text[])`,[insufficient.map(r=>r.id)]);
   const before=await footprint(pending.id);await assert.rejects(act(pending,{type:'START'}));assert.deepEqual(await footprint(pending.id),before);return {minimum:minimum.length,belowMinimumRejected:true,walletUnchanged:true,noSuccessReceipt:true};
  }finally{for(const status of ['PUBLISHED','ARCHIVED','DRAFT']){const ids=bank.filter(r=>r.status===status).map(r=>r.id);if(ids.length)await pool.query(`UPDATE "${table}" SET status=$1::"QuestionStatus" WHERE id=ANY($2::text[])`,[status,ids]);}}
 });
 save('content-native.json',{sourceFingerprint:process.env.SOURCE_FINGERPRINT,passed:results.length,failed:0,cases:results});
}
main().catch(error=>{console.error(error);save('content-native.json',{sourceFingerprint:process.env.SOURCE_FINGERPRINT,passed:results.length,failed:1,error:String(error),cases:results});process.exitCode=1;}).finally(async()=>{await db().$disconnect();await pool.end();});
