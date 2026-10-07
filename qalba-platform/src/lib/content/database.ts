import type {PrismaClient} from '../../generated/prisma/client';
import type {Banks,ContentRow} from './audit';
function rows(input:({id:string;categoryId:string;status:string;category:{active:boolean}}&Record<string,unknown>)[]):ContentRow[]{return input.map(({category,...r})=>({...r,categoryActive:category.active}));}
/** Authored banks only. No User, token, session, vote, wallet or payment query. */
export async function databaseBanks(db:PrismaClient):Promise<Banks>{
 const [board,social,letter,survey,forbidden,bluff,ranked,lightning,ordering,court]=await Promise.all([
  db.question.findMany({where:{gameType:{slug:'category-board'}},include:{category:true},orderBy:{id:'asc'}}),
  db.secretWord.findMany({include:{category:true},orderBy:{id:'asc'}}),db.letterQuestion.findMany({include:{category:true},orderBy:{id:'asc'}}),
  db.surveyQuestion.findMany({include:{category:true,answers:{orderBy:{position:'asc'}}},orderBy:{id:'asc'}}),
  db.forbiddenWordCard.findMany({include:{category:true},orderBy:{id:'asc'}}),db.bluffQuestion.findMany({include:{category:true},orderBy:{id:'asc'}}),
  db.rankedListQuestion.findMany({include:{category:true,entries:{orderBy:{rank:'asc'}}},orderBy:{id:'asc'}}),
  db.lightningQuestion.findMany({include:{category:true},orderBy:{id:'asc'}}),db.orderingQuestion.findMany({include:{category:true,items:{orderBy:{correctPosition:'asc'}}},orderBy:{id:'asc'}}),
  db.courtCase.findMany({include:{category:true,facts:{orderBy:{position:'asc'}}},orderBy:{id:'asc'}}),
 ]);
 return {'category-board':rows(board),'out-of-the-loop':rows(social),'letter-network':rows(letter),'survey-show':rows(survey),'secret-word':rows(forbidden),'bluff':rows(bluff),'top-list':rows(ranked),'lightning-quiz':rows(lightning),'ordering-challenge':rows(ordering),'the-court':rows(court)};
}
