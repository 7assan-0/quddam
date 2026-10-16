import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { sourceBanks } from '../src/lib/content/source';
import { databaseBanks } from '../src/lib/content/database';
import { auditLightningBeta, lightningBetaDecision } from '../src/lib/content/lightning-beta';

/** Explicit, read-only Lightning Beta proof. Never uses production credentials. */
async function main() {
 const source = auditLightningBeta(sourceBanks());
 let database: ReturnType<typeof auditLightningBeta> | null = null;
 const sourceOnly = process.argv.includes('--source-only');
 if (!sourceOnly) {
  if (process.env.LIGHTNING_BETA_TEST_DATABASE !== '1') {
   throw new Error('LIGHTNING_BETA_TEST_DATABASE=1 required: verify an isolated, synthetic database before running this read-only gate.');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing for isolated Lightning Beta content verification.');
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
   const banks = await databaseBanks(client);
   database = auditLightningBeta(banks);
  } finally { await client.$disconnect(); }
 }
 const verdict = lightningBetaDecision(source, database);
 const report = { schemaVersion: 1, scope: 'LIGHTNING_BETA_V1', nonMutating: true, source, database, verdict };
 const index = process.argv.indexOf('--output');
 if (index >= 0) {
  const path = process.argv[index + 1];
  if (!path || path.startsWith('--')) throw new Error('Missing output path');
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
 }
 console.log(JSON.stringify({
  scope: report.scope, source: { authored: source.authored, eligible: source.eligible, structurallyValidEligible: source.structurallyValidEligible, categoriesWithAtLeast40: source.categoriesWithAtLeast40, errors: source.errors },
  database: database === null ? 'NOT_RUN' : { authored: database.authored, eligible: database.eligible, structurallyValidEligible: database.structurallyValidEligible, categoriesWithAtLeast40: database.categoriesWithAtLeast40, errors: database.errors },
  verdict,
 }));
 process.exitCode = verdict === 'PASS' ? 0 : verdict === 'FAIL' ? 1 : 2;
}
main().catch((error: unknown) => {
 console.error(error instanceof Error ? error.message : 'Lightning beta content validation could not complete.');
 process.exitCode = 2;
});
