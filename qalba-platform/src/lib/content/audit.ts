import {LETTER_WEIGHTS} from '../games/letter-network/module';
import {orderingCanonicalIssue} from './ordering-review';
import { z } from 'zod';
import { questionSchema as board } from '../questions/validation';
import { wordSchema as social } from '../games/social-deduction/validation';
import { letterQuestionSchema as letter } from '../games/letter-network/validation';
import { surveySchema as survey } from '../games/survey-battle/validation';
import { cardSchema as forbidden } from '../games/forbidden-word/validation';
import { questionSchema as bluff } from '../games/bluff/validation';
import { listSchema as ranked } from '../games/ranked/validation';
import { questionSchema as lightning } from '../games/lightning/validation';
import { questionSchema as ordering } from '../games/ordering/validation';
import { caseSchema as court } from '../games/court/validation';
import { contentKey } from './rules';
export const contentPolicies = {
 'category-board': {schema:board,minimum:18,fields:'gameTypeId categoryId question answer alternativeAnswers explanation difficulty pointValue type options status language country subcategory imageUrl source'},
 'out-of-the-loop': {schema:social,minimum:1,fields:'word categoryId difficulty alternativeAnswers status'},
 'letter-network': {schema:letter,minimum:25,fields:'letter question answer alternativeAnswers categoryId difficulty status'},
 'survey-show': {schema:survey,minimum:5,fields:'question categoryId difficulty status locale sourceType answers'},
 'secret-word': {schema:forbidden,minimum:30,fields:'targetWord forbiddenWords categoryId difficulty status locale'},
 'bluff': {schema:bluff,minimum:5,fields:'question correctAnswer alternativeCorrectAnswers categoryId difficulty status locale explanation'},
 'top-list': {schema:ranked,minimum:5,fields:'title description categoryId difficulty status locale kind sourceLabel sourceUrl sourceDate notes entries'},
 'lightning-quiz': {schema:lightning,minimum:15,fields:'question answer alternativeAnswers categoryId difficulty status locale explanation'},
 'ordering-challenge': {schema:ordering,minimum:7,fields:'title instruction categoryId difficulty status locale orderingType factual sourceLabel sourceUrl sourceDate explanation items'},
 'the-court': {schema:court,minimum:5,fields:'title scenario prosecutionPrompt defensePrompt rebuttalPrompt categoryId difficulty status locale contentRating facts'},
} satisfies Record<string,{schema:z.ZodType;minimum:number;fields:string}>;
export type ContentGame=keyof typeof contentPolicies;
export type ContentRow=Record<string,unknown> & {id:string;categoryId:string;categoryActive:boolean;status:string};
export type Banks=Record<ContentGame,ContentRow[]>;
export function contentDto(game:ContentGame,row:ContentRow):Record<string,unknown> {
 const value:Record<string,unknown>={};
 for(const key of contentPolicies[game].fields.split(' '))if(row[key]!==undefined)value[key]=row[key];
 if(value.sourceDate instanceof Date)value.sourceDate=value.sourceDate.toISOString().slice(0,10);
 for(const [key,fields] of [['answers','answer alternativeAnswers points position'],['entries','rank answer alternativeAnswers points displayValue'],['items','label correctPosition acceptedAliases displayValue']] as const){
  if(Array.isArray(value[key]))value[key]=value[key].map(raw=>Object.fromEntries(fields.split(' ').filter(k=>(raw as Record<string,unknown>)[k]!==undefined).map(k=>[k,(raw as Record<string,unknown>)[k]])));
 }
 if(game==='the-court'&&Array.isArray(value.facts))value.facts=value.facts.map(v=>typeof v==='string'?v:(v as {text:string}).text);
 return value;
}
export function isContentEligible(game:ContentGame,row:ContentRow){
 return (game!=='category-board'||(['TEXT','MULTIPLE_CHOICE','TRUE_FALSE','IMAGE'].includes(String(row.type))&&[200,400,600].includes(Number(row.pointValue))))&&row.status==='PUBLISHED'&&row.categoryActive&&(game==='category-board'||game==='out-of-the-loop'||game==='letter-network'?row.language===undefined||row.language==='ar':row.locale==='ar-SA');
}
export type AuditIssue={code:string;ids:string[]};
export function auditBank(game:ContentGame,rows:ContentRow[]){
 const eligible=rows.filter(r=>isContentEligible(game,r));const errors:AuditIssue[]=[],warnings:AuditIssue[]=[];
 const challenges=new Map<string,string>();const prompts=new Map<string,ContentRow>();const exact=new Map<string,ContentRow>();const categories:Record<string,number>={},letters:Record<string,number>={},difficulty:Record<string,number>={},languages:Record<string,number>={};
 let duplicates=0;const invalidIds=new Set<string>();
 for(const row of eligible){
  const parsed=contentPolicies[game].schema.safeParse(contentDto(game,row));
  if(!parsed.success){invalidIds.add(row.id);errors.push({code:'INVALID_STRUCTURE',ids:[row.id]});}
  if(parsed.success&&game==='ordering-challenge'){const issue=orderingCanonicalIssue(row as unknown as Parameters<typeof orderingCanonicalIssue>[0]);if(issue)errors.push({code:issue,ids:[row.id]});const items=row.items as {label:string;correctPosition:number}[];const signature=contentKey(String(row.instruction))+'|'+[...items].sort((a,b)=>a.correctPosition-b.correctPosition).map(i=>contentKey(i.label)).join('|');const priorChallenge=challenges.get(signature);if(priorChallenge){duplicates++;errors.push({code:'DUPLICATE_CHALLENGE',ids:[priorChallenge,row.id]});}challenges.set(signature,row.id);}
  const prompt=String(row.question??row.word??row.targetWord??row.title);const key=contentKey(prompt);const prior=prompts.get(key);
  if(prior){duplicates++;const answer=(r:ContentRow)=>contentKey(String(r.answer??r.correctAnswer??r.word??''));errors.push({code:answer(row)!==answer(prior)?'CONFLICTING_ANSWER':exact.has(prompt)?'EXACT_DUPLICATE':'NORMALIZED_DUPLICATE',ids:[prior.id,row.id]});}
  prompts.set(key,row);exact.set(prompt,row);categories[row.categoryId]=(categories[row.categoryId]??0)+1;const d=String(row.difficulty);difficulty[d]=(difficulty[d]??0)+1;const lang=String(row.language??row.locale??'ar');languages[lang]=(languages[lang]??0)+1;
  if(game==='letter-network')letters[String(row.letter)]=(letters[String(row.letter)]??0)+1;
 }
 if(eligible.length<contentPolicies[game].minimum)errors.push({code:'INSUFFICIENT_CONTENT',ids:[]});
 if(game==='category-board'){
  const validCategories=Object.keys(categories).filter(id=>[200,400,600].every(v=>eligible.some(r=>r.categoryId===id&&r.pointValue===v)));
  if(validCategories.length<6)errors.push({code:'BOARD_BUCKET_CAPACITY',ids:[]});
  for(const id of validCategories)if([200,400,600].some(v=>eligible.filter(r=>r.categoryId===id&&r.pointValue===v).length<2))warnings.push({code:'BOARD_REMATCH_REPETITION',ids:[id]});
 }
 if(game==='letter-network'){
  for(const [l,count] of Object.entries(letters))if(count<10)warnings.push({code:'LETTER_REPEATED_PLAY_COVERAGE',ids:[l]});
  // The unchanged generator uses only letters with available valid questions;
  // the board's 25 cells can repeat a letter, consuming distinct questions.
  const enabled=Object.entries(letters).filter(([l,n])=>n>=8&&(LETTER_WEIGHTS[l]??0)>0);if(enabled.length<5||enabled.reduce((n,[,count])=>n+count,0)<25)errors.push({code:'LETTER_BOARD_CAPACITY',ids:[]});
 }
 if(eligible.length<contentPolicies[game].minimum*2)warnings.push({code:'REMATCH_REPETITION_POSSIBLE',ids:[]});
 if(game==='ordering-challenge'&&eligible.filter(r=>String(r.instruction).includes('الهجائي')).length>eligible.length/3)warnings.push({code:'ALPHABETICAL_TEMPLATE_CONCENTRATION',ids:[]});
 return {game,total:rows.length,published:rows.filter(r=>r.status==='PUBLISHED').length,eligible:eligible.length,inactive:rows.filter(r=>r.status==='PUBLISHED'&&!r.categoryActive).length,archivedOrUnpublished:rows.filter(r=>r.status!=='PUBLISHED').length,blockingInvalid:invalidIds.size,duplicatesFound:duplicates,categories,languages,difficulty,letters,minimum:contentPolicies[game].minimum,capacity:errors.length?'FAIL':warnings.length?'WARN':'PASS',errors,warnings};
}
export function auditContent(banks:Banks){const games=(Object.keys(contentPolicies) as ContentGame[]).map(g=>auditBank(g,banks[g]));return {schemaVersion:1,nonMutating:true,games,blockingErrors:games.reduce((n,g)=>n+g.errors.length,0),warnings:games.reduce((n,g)=>n+g.warnings.length,0)};}

export function contentValidationExitCode(source:{blockingErrors:number},database:{blockingErrors:number}|null){return source.blockingErrors||(database?.blockingErrors??0)?1:0;}
