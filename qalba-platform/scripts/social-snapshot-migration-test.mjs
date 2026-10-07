// Focused forward-upgrade test; PGlite PostgreSQL semantics, not a load test.
import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = await PGlite.create();
const name = '20261005190000_social_round_snapshot';
const evidence = [];
async function check(title, fn) { await fn(); evidence.push({ title, status: 'passed' }); }
try {
  for (const dir of (await readdir('prisma/migrations')).sort()) {
    if (dir === name) break;
    if (dir === 'migration_lock.toml') continue;
    await db.exec(await readFile(`prisma/migrations/${dir}/migration.sql`, 'utf8'));
  }
  await db.exec(`INSERT INTO "User" ("id","email","name","updatedAt") VALUES ('u','migration@example.test','مضيف',now());
    INSERT INTO "GameType" ("id","slug","title","description") VALUES ('g','out-of-the-loop','اجتماع','تجربة');
    INSERT INTO "Category" ("id","slug","title","updatedAt") VALUES ('c','migration','فئة',now());
    INSERT INTO "SecretWord" ("id","word","categoryId","alternativeAnswers","updatedAt") VALUES ('w','القيمة المتاحة وقت الترحيل','c',ARRAY['بديل قديم'],now());
    INSERT INTO "GameSession" ("id","gameTypeId","hostId","updatedAt") VALUES ('s','g','u',now());
    INSERT INTO "SocialParticipant" ("id","sessionId","tokenHash","name","position") VALUES ('p','s',repeat('a',64),'مشارك',0);
    INSERT INTO "SocialRound" ("id","sessionId","number","secretWordId","outsiderId","winner","guess","endedAt") VALUES ('r','s',1,'w','p','PLAYERS','تخمين محفوظ',now());`);
  await db.exec(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
  const legacy = (await db.query('SELECT * FROM "SocialRound" WHERE "id"=\'r\'')).rows[0];
  await check('legacy captured explicitly; result unchanged', async () => {
    assert.equal(legacy.wordSnapshot,'القيمة المتاحة وقت الترحيل'); assert.deepEqual(legacy.alternativesSnapshot,['بديل قديم']); assert.equal(legacy.snapshotOrigin,'LEGACY_BANK_CAPTURE'); assert.equal(legacy.winner,'PLAYERS'); assert.equal(legacy.guess,'تخمين محفوظ');
  });
  await check('legacy stays frozen after bank edit', async () => {
    await db.exec(`UPDATE "SecretWord" SET "word"='محتوى جديد',"alternativeAnswers"=ARRAY['بديل جديد'] WHERE "id"='w';`);
    const r=(await db.query('SELECT * FROM "SocialRound" WHERE "id"=\'r\'')).rows[0]; assert.equal(r.wordSnapshot,legacy.wordSnapshot); assert.deepEqual(r.alternativesSnapshot,legacy.alternativesSnapshot);
  });
  await check('new rounds require word snapshot',async()=>{await assert.rejects(db.exec(`INSERT INTO "SocialRound" ("id","sessionId","number","secretWordId","outsiderId","alternativesSnapshot") VALUES ('bad','s',2,'w','p',ARRAY[]::text[]);`),/null value/);});
  await check('new rounds require aliases snapshot',async()=>{await assert.rejects(db.exec(`INSERT INTO "SocialRound" ("id","sessionId","number","secretWordId","outsiderId","wordSnapshot") VALUES ('bad','s',2,'w','p','كلمة');`),/null value/);});
  await check('new complete snapshot has creation provenance',async()=>{await db.exec(`INSERT INTO "SocialRound" ("id","sessionId","number","secretWordId","outsiderId","wordSnapshot","alternativesSnapshot") VALUES ('new','s',2,'w','p','كلمة',ARRAY[]::text[]);`);assert.equal((await db.query('SELECT "snapshotOrigin" FROM "SocialRound" WHERE "id"=\'new\'')).rows[0].snapshotOrigin,'ROUND_CREATION');});
  for (const [field,value] of [['wordSnapshot',"'تغيير'"],['alternativesSnapshot',"ARRAY['تغيير']"],['snapshotOrigin',"'LEGACY_BANK_CAPTURE'"]]) {
    await check(`immutable ${field}`,async()=>{await assert.rejects(db.exec(`UPDATE "SocialRound" SET "${field}"=${value} WHERE "id"='new';`),/snapshot is immutable/);});
  }
  await check('normal result updates still permitted',async()=>{await db.exec(`UPDATE "SocialRound" SET "winner"='OUTSIDER',"guess"='كلمة',"endedAt"=now() WHERE "id"='new';`);assert.equal((await db.query('SELECT "winner" FROM "SocialRound" WHERE "id"=\'new\'')).rows[0].winner,'OUTSIDER');});
  const report={status:'passed',engine:'PGlite PostgreSQL',legacy,evidence,passed:evidence.length};
  await writeFile(process.env.SOCIAL_MIGRATION_REPORT || 'social-migration-results.json',JSON.stringify(report,null,2)); console.log(JSON.stringify({passed:evidence.length,status:'passed'}));
} finally { await db.close(); }
