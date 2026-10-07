import 'dotenv/config';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../src/generated/prisma/client';
import {remediateContent} from '../src/lib/content/remediate';
async function main(){if(!process.env.DATABASE_URL)throw Error('Missing database');const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});try{console.log(JSON.stringify(await remediateContent(db,process.argv.includes('--apply'))));}finally{await db.$disconnect();}}
main().catch(()=>{console.error('Reviewed content remediation did not complete. Retry safely after checking database access.');process.exitCode=1;});
