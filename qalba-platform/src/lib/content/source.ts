import { archivedLightningSeedIds } from '../../../prisma/lightning-editorial-exclusions';
import {duplicateOrderingIds} from '../../../prisma/content-remediations';
import {boardSamples,socialWords} from '../../../prisma/core-content';
import {letterSamples} from '../../../prisma/letter-questions';
import {surveySamples} from '../../../prisma/survey-questions';
import {forbiddenSamples} from '../../../prisma/forbidden-word-cards';
import {bluffSamples} from '../../../prisma/bluff-questions';
import {rankedSamples} from '../../../prisma/ranked-lists';
import {lightningSamples} from '../../../prisma/lightning-questions';
import {orderingSamples} from '../../../prisma/ordering-questions';
import {courtSamples} from '../../../prisma/court-cases';
import type {Banks,ContentRow} from './audit';
const row=(id:string,categoryId:string,data:Record<string,unknown>):ContentRow=>({id,categoryId,categoryActive:true,status:'PUBLISHED',difficulty:'EASY',locale:'ar-SA',...data});
export function sourceBanks():Banks{return {
 'category-board':boardSamples.map(([c,question,answer,difficulty,pointValue],i)=>row(`seed-category-${i+1}`,c,{question,answer,difficulty,pointValue,gameTypeId:'category-board',type:i===18?'MULTIPLE_CHOICE':'TEXT',options:i===18?['10','12','14','16']:null,language:'ar',alternativeAnswers:[],source:'إعداد تحريري لقدّام'})),
 'out-of-the-loop':Object.entries(socialWords).flatMap(([c,words])=>words.map((word,i)=>row(`social-seed-${c}-${i}`,c,{word,alternativeAnswers:[]}))),
 'letter-network':letterSamples.map((q,i)=>row(`letter-seed-${i+1}`,q.category,{...q,alternativeAnswers:[]})),
 'survey-show':surveySamples.map((q,i)=>row(`survey-seed-${i+1}`,q.category,{...q,sourceType:'CURATED'})),
 'secret-word':forbiddenSamples.map(q=>row(q.id,q.category,{...q})),
 'bluff':bluffSamples.map(q=>row(q.id,q.category,{...q})),
 'top-list':rankedSamples.map(q=>row(q.id,q.category,{...q})),
 'lightning-quiz':lightningSamples.map(q=>row(q.id,q.category,{...q,status:archivedLightningSeedIds.has(q.id)?'ARCHIVED':'PUBLISHED'})),
 'ordering-challenge':orderingSamples.map(q=>row(q.id,q.categorySlug,{...q,status:duplicateOrderingIds.has(q.id)?'ARCHIVED':'PUBLISHED'})),
 'the-court':courtSamples.map((q,i)=>row(`court-seed-${i+1}`,q.category,{...q})),
};}
