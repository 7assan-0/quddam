import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {Fixture,Game} from '../../scripts/database-lifecycle-fixtures';
const getFixture=()=>JSON.parse(readFileSync(process.env.CONTENT_OUTPUT+'/fixture-private.json','utf8')) as {hostToken:string;adminToken:string;fixtures:Fixture[]};
const paths:Record<Game,string>={board:'/play',social:'/social/host',letter:'/letter-network/host',survey:'/survey-show/host',forbidden:'/secret-word/host',bluff:'/bluff/host',ranked:'/ranked/host',lightning:'/lightning/host',ordering:'/ordering/host',court:'/court/host'};
const selectors:Record<Game,string>={board:'.host-game',social:'.social-page',letter:'.letter-page',survey:'.survey-host',forbidden:'.forbidden-host',bluff:'.bluff-host',ranked:'.ranked-host',lightning:'.lightning-host',ordering:'.ordering-host',court:'.court-host'};
for(const game of Object.keys(paths) as Game[])test(`G1 ${game}: selected launch content renders in production Host`,async({context,page},info)=>{
 const f=getFixture();await context.addCookies([{name:'qalba_session',value:f.hostToken,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'}]);const fixture=f.fixtures.find(x=>x.game===game)!;
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const response=await page.goto(paths[game]+'/'+fixture.id);expect(response?.status()).toBe(200);await expect(page.locator(selectors[game])).toBeVisible();await expect(page.locator('body')).not.toContainText('المباراة غير موجودة');expect(errors).toEqual([]);await page.screenshot({path:info.outputPath(game+'-content.png'),fullPage:true});
});
test('G1 admin/API: critical malformed authored content and CSV are rejected',async({context,request})=>{
 const f=getFixture();await context.addCookies([{name:'qalba_session',value:f.adminToken,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'}]);
 const headers={Origin:'http://127.0.0.1:3000',Cookie:'qalba_session='+f.adminToken};
 const categoryId=JSON.parse(readFileSync(process.env.CONTENT_OUTPUT+'/admin-category.json','utf8')).id;
 const common={categoryId,difficulty:'EASY',status:'PUBLISHED',locale:'ar-SA'};
 for(const [path,body] of [['secret-words',{word:'TODO',categoryId,difficulty:'EASY',alternativeAnswers:[],status:'PUBLISHED'}],['letter-questions',{question:'ما اسم حيوان طويل العنق؟',letter:'ا',answer:'زرافة',categoryId,difficulty:'EASY',alternativeAnswers:[],status:'PUBLISHED'}],['survey-questions',{...common,sourceType:'CURATED',question:'ما المشروب المعتاد؟',answers:[{answer:'قهوة',alternativeAnswers:[],position:0,points:50},{answer:'قَهْوة',alternativeAnswers:[],position:1,points:30},{answer:'ماء',alternativeAnswers:[],position:2,points:20}]}],['forbidden-word-cards',{...common,targetWord:'قهوة',forbiddenWords:['قهوة','فنجان','صباح']}]] as const){const response=await request.post('/api/admin/'+path,{headers,data:body});expect(response.status(),path).toBe(400);}
 const imported=await request.post('/api/admin/questions/import',{headers,data:{csv:'invalid,headers\nTODO,test',dryRun:false}});expect(imported.status()).toBe(400);
});

test('G1 real admin edits: Social word/alias, Letter and Survey bank edits preserve active snapshots',async({request})=>{
 const f=getFixture();const sources=JSON.parse(readFileSync(process.env.CONTENT_OUTPUT+'/snapshot-sources-private.json','utf8'));const headers={Origin:'http://127.0.0.1:3000',Cookie:'qalba_session='+f.adminToken};
 const social=sources.social;const r=await request.patch('/api/admin/secret-words/'+social.id,{headers,data:{word:'مكتبة الحي',alternativeAnswers:['مكتبة جديدة'],categoryId:social.categoryId,difficulty:social.difficulty,status:social.status}});expect(r.status()).toBe(200);
 const letter=sources.letter;const l=await request.patch('/api/admin/letter-questions/'+letter.id,{headers,data:{letter:letter.letter,question:letter.question+' حدّد الاسم المطلوب.',answer:letter.answer,alternativeAnswers:letter.alternativeAnswers,categoryId:letter.categoryId,difficulty:letter.difficulty,status:letter.status}});expect(l.status()).toBe(200);
 const survey=sources.survey;const v=await request.patch('/api/admin/survey-questions/'+survey.id,{headers,data:{question:survey.question+' حسب رأيكم.',categoryId:survey.categoryId,difficulty:survey.difficulty,status:survey.status,locale:survey.locale,sourceType:survey.sourceType,answers:survey.answers.map((a:{answer:string;alternativeAnswers:string[];points:number;position:number})=>({answer:a.answer,alternativeAnswers:a.alternativeAnswers,points:a.points,position:a.position}))}});expect(v.status()).toBe(200);
});
