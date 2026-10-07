import 'dotenv/config';
import {writeFileSync} from 'node:fs';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../src/generated/prisma/client';
import {sourceBanks} from '../src/lib/content/source';
import {databaseBanks} from '../src/lib/content/database';
import {auditContent,contentValidationExitCode} from '../src/lib/content/audit';
async function main(){
 const source=auditContent(sourceBanks());let database:ReturnType<typeof auditContent>|null=null;
 if(!process.argv.includes('--source-only')){
  if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required; --source-only explicitly validates authored definitions only.');
  const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});try{database=auditContent(await databaseBanks(db));}finally{await db.$disconnect();}
 }
 const report={phase:'5.0G-1',source,database};const output=process.argv.indexOf('--output');if(output>=0){if(!process.argv[output+1])throw Error('Missing output path');writeFileSync(process.argv[output+1],JSON.stringify(report,null,2)+'\n');}
 for(const [origin,audit] of [['source',source],['database',database]] as const)if(audit){console.log(origin,JSON.stringify({errors:audit.blockingErrors,warnings:audit.warnings}));for(const g of audit.games)console.log(g.game,g.total,g.eligible,g.capacity,JSON.stringify(g.errors));}
 process.exitCode=contentValidationExitCode(source,database);
}
main().catch(()=>{console.error('Content validation could not complete. No data was modified. Check configuration/database access.');process.exitCode=1;});
