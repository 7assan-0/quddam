import { archivedLightningSeedIds } from "./lightning-editorial-exclusions";
import {duplicateOrderingIds} from "./content-remediations";
import {sourceBanks} from "../src/lib/content/source";
import {auditContent} from "../src/lib/content/audit";
import {boardSamples as samples, socialWords} from "./core-content";
import { courtCategories, courtSamples } from "./court-cases";
import { normalize as courtNormalize, validateCase } from "../src/lib/games/court/module";
import "dotenv/config";
import {orderingCategories, orderingSamples} from "./ordering-questions";
import {normalize as orderingNormalize, validateQuestion as validateOrderingQuestion} from "../src/lib/games/ordering/module";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/crypto";
import { partySamples } from "../src/lib/games/party/content";
import { letterSamples } from "./letter-questions";
import { surveyCategories,surveySamples } from "./survey-questions";
import {lightningCategories,lightningSamples} from "./lightning-questions";
import {normalize as lightningNormalize,validateQuestion as validateLightningQuestion} from "../src/lib/games/lightning/module";
import {rankedCategories,rankedSamples} from "./ranked-lists";
import {normalize as rankedNormalize,validateList as validateRankedList} from "../src/lib/games/ranked/module";
import {bluffCategories,bluffSamples} from "./bluff-questions";
import {normalizeArabic,validateQuestion} from "../src/lib/games/bluff/module";
import { forbiddenCategories,forbiddenSamples } from "./forbidden-word-cards";
import type { Prisma } from "../src/generated/prisma/client";
import { isLaunchGameSlug } from "../src/lib/games/launch-policy";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const categoryNames = [
  "معلومات عامة", "السعودية", "كرة القدم", "رياضة", "تاريخ", "جغرافيا", "علوم", "تقنية",
  "أمن سيبراني", "أفلام", "مسلسلات", "أنمي", "ألعاب", "سيارات", "شعارات", "مشاهير",
  "لغة عربية", "ألغاز", "من أنا؟", "صور", "ثقافة", "طعام", "سفر",
  "أماكن", "حيوانات", "وظائف", "أشياء",
];
const slugs = [
  "general", "saudi", "football", "sports", "history", "geography", "science", "technology",
  "cybersecurity", "movies", "series", "anime", "games", "cars", "logos", "people",
  "arabic", "riddles", "who-am-i", "images", "culture", "food", "travel",
  "places", "animals", "jobs", "objects",
];

const games = [
  ["category-board", "لوحة التحدي", "أسئلة بفئات وقيم مختلفة"],
  ["letter-battle", "حرب الحروف", "كوّن مسارًا من الإجابات"],
  ["bluff", "صدّقني", "إجابات مموّهة وحقيقة واحدة · اكتب، صوّت، واكسب بالمعرفة والتمويه"],
  ["fastest-mind", "خاطف", "أجب قبل نفاد الوقت"],
  ["top-list", "توب 100", "قوائم مرتبة، اكتشافات ونقاط · فريقان · خمس جولات"],
  ["secret-word", "الكلمة الممنوعة", "صف الكلمة دون قول المحظور"],
  ["survey-show", "قالوا الناس", "توقعوا الإجابات، اكشفوا اللوحة واقتنصوا وعاء الجولة · فريقان · ٢٠–٣٥ دقيقة"],
  ["party-court", "محكمة الطاولة", "مرافعات خفيفة وتصويت"],
  ["out-of-the-loop", "خارج الجو", "اكتشفوا من لا يعرف الكلمة قبل أن يخمنها"],
  ["letter-network", "شبكة الحروف", "فريقان يتنافسان لربط مسار من الحروف · ٢٠ إلى ٣٥ دقيقة"],
  ["lightning-quiz", "البرق", "سؤال، جرس، سباق! · فريقان · ١٥ سؤالًا · الصحيح +٢ والسرقة +١"],
  ["ordering-challenge", "رتّبها", "رتّبوا العناصر سرًا ثم قارنوا النتيجة · فريقان · ٧ جولات · جوال لكل فريق"],
  ["the-court", "المحكمة", "قضايا خيالية، مرافعات مرحة وتصويت خاص · فريقان · ٣–١٢ محلفًا · خمس جولات"],
] as const;


async function seedAccount(email: string | undefined, password: string | undefined, name: string, role: "ADMIN" | "USER") {
  if (!email || !password || password.length < 12) throw new Error(`Set SEED_${role}_EMAIL and SEED_${role}_PASSWORD (12+ characters)`);
  const normalized = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { email: normalized },
    create: { email: normalized, name, role, passwordHash, wallet: { create: { balance: 0 } } },
    update: {}, // Reseeding content must not reset existing account credentials or roles.
  });
}

async function main() {
  const contentOnly = process.argv.includes("--content-only");
  if (process.env.NODE_ENV === "production" && !contentOnly) throw new Error("Production content bootstrap requires --content-only; use ops:bootstrap-admin for explicit first-admin creation");
  if(auditContent(sourceBanks()).blockingErrors)throw Error("Launch content validation failed before seeding");
  await prisma.featureFlag.upsert({ where: { key: "welcome-credits" },
    create: { key: "welcome-credits", enabled: true, config: { count: 3 } }, update: {} });
  if (!contentOnly) {
    await seedAccount(process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD, "مدير تجريبي", "ADMIN");
    await seedAccount(process.env.SEED_USER_EMAIL, process.env.SEED_USER_PASSWORD, "لاعب تجريبي", "USER");
  }
  for (let i = 0; i < categoryNames.length; i++) {
    await prisma.category.upsert({ where: { slug: slugs[i] }, update: { title: categoryNames[i] }, create: { slug: slugs[i], title: categoryNames[i], sortOrder: i } });
  }
  for (const [slug, title, description] of games) {
    const launchEnabled = isLaunchGameSlug(slug);
    await prisma.gameType.upsert({ where: { slug }, update: { title, description, ...(!launchEnabled ? { enabled: false } : {}) }, create: { slug, title, description, enabled: launchEnabled } });
  }
  for (const [slug,title] of orderingCategories) {
    const category=await prisma.category.upsert({where:{slug:"ordering-"+slug},update:{},create:{slug:"ordering-"+slug,title,sortOrder:160}});
    for (const sample of orderingSamples.filter(q=>q.categorySlug===slug)) {
      validateOrderingQuestion({...sample,category:title});
      const {id,categorySlug: _categorySlug,items,...data}=sample; void _categorySlug;
      await prisma.orderingQuestion.upsert({where:{id},update:{},create:{...data,id,sourceDate:data.sourceDate?new Date(data.sourceDate):null,normalizedTitle:orderingNormalize(data.title),categoryId:category.id,status:duplicateOrderingIds.has(id)?"ARCHIVED":"PUBLISHED",items:{create:items.map(({id:_itemId,...item})=>{void _itemId;return item;})}}});
    }
  }
  for (const [slug,title] of lightningCategories) {
    const category=await prisma.category.upsert({where:{slug:"lightning-"+slug},update:{},create:{slug:"lightning-"+slug,title,sortOrder:150}});
    for (const sample of lightningSamples.filter(q=>q.category===slug)) {
      validateLightningQuestion(sample);
      const {category:unused,...question}=sample;void unused;
      await prisma.lightningQuestion.upsert({where:{id:sample.id},update:{},create:{...question,normalizedQuestion:lightningNormalize(sample.question),categoryId:category.id,status:archivedLightningSeedIds.has(sample.id)?"ARCHIVED":"PUBLISHED",locale:"ar-SA"}});
    }
  }
  for (const [slug,title] of rankedCategories) {
    const category=await prisma.category.upsert({where:{slug:"ranked-"+slug},update:{},create:{slug:"ranked-"+slug,title,sortOrder:130}});
    for(const sample of rankedSamples.filter(q=>q.category===slug)) {
      validateRankedList(sample);
      const {id,category:unused,difficulty,entries,...snapshot}=sample;void unused;
      await prisma.rankedListQuestion.upsert({where:{id},update:{},create:{id,...snapshot,normalizedTitle:rankedNormalize(sample.title),difficulty,categoryId:category.id,status:"PUBLISHED",locale:"ar-SA",entries:{create:entries}}});
    }
  }
  for (const [slug,title] of bluffCategories) {
    const category=await prisma.category.upsert({where:{slug:"bluff-"+slug},create:{slug:"bluff-"+slug,title,sortOrder:110},update:{}});
    for(const sample of bluffSamples.filter(q=>q.category===slug)) {
      validateQuestion(sample);
      await prisma.bluffQuestion.upsert({where:{id:sample.id},update:{},create:{id:sample.id,question:sample.question,normalizedQuestion:normalizeArabic(sample.question),correctAnswer:sample.correctAnswer,alternativeCorrectAnswers:sample.alternativeCorrectAnswers,difficulty:sample.difficulty,explanation:sample.explanation,categoryId:category.id,status:"PUBLISHED",locale:"ar-SA"}});
    }
  }
  await prisma.featureFlag.upsert({where:{key:"bluff-moderation"},create:{key:"bluff-moderation",enabled:true,config:{blockedTerms:[]}},update:{}});
  for (const [slug,title] of forbiddenCategories) {
    const category=await prisma.category.upsert({where:{slug:"forbidden-"+slug},create:{slug:"forbidden-"+slug,title,sortOrder:90},update:{}});
    for (const card of forbiddenSamples.filter(c=>c.category===slug)) {
      await prisma.forbiddenWordCard.upsert({where:{id:card.id},update:{},create:{id:card.id,targetWord:card.targetWord,forbiddenWords:card.forbiddenWords,categoryId:category.id,difficulty:card.difficulty,status:"PUBLISHED",locale:"ar-SA"}});
    }
  }
  const type = await prisma.gameType.findUniqueOrThrow({ where: { slug: "category-board" } });
  const categories = await prisma.category.findMany();
  const categoryIds = new Map(categories.map((category) => [category.slug, category.id]));
  for (let i = 0; i < samples.length; i++) {
    const [slug, question, answer, difficulty, pointValue] = samples[i];
    await prisma.question.upsert({
      where: { id: `seed-category-${i + 1}` },
      update: {},
      create: {
        id: `seed-category-${i + 1}`,
        gameTypeId: type.id,
        categoryId: categoryIds.get(slug)!,
        question,
        answer,
        alternativeAnswers: [],
        difficulty,
        pointValue,
        type: i === 18 ? "MULTIPLE_CHOICE" : "TEXT",
        options: i === 18 ? ["10", "12", "14", "16"] : undefined,
        status: "PUBLISHED",
        language: "ar",
        country: slug === "saudi" ? "SA" : null,
        source: "إعداد تحريري لقدّام",
      },
    });
  }
  for (let i = 0; i < partySamples.length; i++) {
    const sample = partySamples[i];
    const game = await prisma.gameType.findUniqueOrThrow({ where: { slug: sample.slug }, select: { id: true } });
    await prisma.question.upsert({ where: { id: `seed-party-${sample.slug}-${i}` }, update: {}, create: {
      id: `seed-party-${sample.slug}-${i}`, gameTypeId: game.id, categoryId: categoryIds.get(sample.category)!, question: sample.question,
      answer: sample.answer, alternativeAnswers: [], difficulty: "EASY", pointValue: sample.value ?? 100, type: sample.type,
      options: sample.options as Prisma.InputJsonValue | undefined, status: "PUBLISHED", language: "ar", source: "محتوى تجريبي أصلي",
    } });
  }

  for (const [slug, words] of Object.entries(socialWords)) for (let index = 0; index < words.length; index++) {
    await prisma.secretWord.upsert({ where: { id: `social-seed-${slug}-${index}` }, update: {}, create: {
      id: `social-seed-${slug}-${index}`, word: words[index], categoryId: categoryIds.get(slug)!,
      difficulty: index < 2 ? "EASY" : "MEDIUM", alternativeAnswers: [], status: "PUBLISHED",
    } });
  }
  // The first extra question demonstrates an actual multiple-choice power-up.
  for (let i = 0; i < letterSamples.length; i++) {
    const item = letterSamples[i];
    await prisma.letterQuestion.upsert({ where: { id: `letter-seed-${i+1}` }, update: {}, create: {
      id: `letter-seed-${i+1}`, letter: item.letter, question: item.question, answer: item.answer,
      alternativeAnswers: [], categoryId: categoryIds.get(item.category)!, difficulty: i%3===0 ? "MEDIUM" : "EASY", status: "PUBLISHED",
    } });
  }
  // The first extra question demonstrates an actual multiple-choice power-up.
  const powerUps = [
    ["double", "ضاعف", { initialCount: 1 }],
    ["shield", "درع", { initialCount: 1 }],
    ["remove-two", "احذف اثنين", { initialCount: 1 }],
    ["extra-time", "وقت إضافي", { initialCount: 1, seconds: 15 }],
    ["challenge", "اعتراض", { initialCount: 1 }],
  ] as const;
  for (const [slug, title, config] of powerUps) {
    await prisma.powerUp.upsert({ where: { gameTypeId_slug: { gameTypeId: type.id, slug } }, create: { gameTypeId: type.id, slug, title, config }, update: { title } });
  }
  for(const [slug,title] of surveyCategories){
    const category=await prisma.category.upsert({where:{slug:"survey-"+slug},update:{},create:{slug:"survey-"+slug,title,sortOrder:100+surveyCategories.findIndex(c=>c[0]===slug)}});
    for(const [i,sample] of surveySamples.entries())if(sample.category===slug)await prisma.surveyQuestion.upsert({where:{id:`survey-seed-${i+1}`},update:{},create:{id:`survey-seed-${i+1}`,question:sample.question,categoryId:category.id,difficulty:"EASY",status:"PUBLISHED",locale:"ar-SA",sourceType:"CURATED",answers:{create:sample.answers}}});
  }
  for (const [slug,title] of courtCategories) {
    const category = await prisma.category.upsert({where:{slug:"court-"+slug},update:{},create:{slug:"court-"+slug,title,sortOrder:700+courtCategories.findIndex(c=>c[0]===slug)}});
    for (const [i,c] of courtSamples.entries()) if(c.category===slug) { validateCase({...c,category:title}); const {facts,category: ignored,...data}=c; void ignored; await prisma.courtCase.upsert({where:{id:`court-seed-${i+1}`},update:{},create:{id:`court-seed-${i+1}`,...data,normalizedTitle:courtNormalize(c.title),categoryId:category.id,status:"PUBLISHED",facts:{create:facts.map((text,position)=>({text,position}))}}}); }
  }
  console.log(`Court: ${courtSamples.length} original fictional cases.`);
  console.log(`Forbidden Word: ${forbiddenSamples.length} original cards across ${forbiddenCategories.length} categories.`);
  console.log(`Survey Battle: ${surveySamples.length} original curated surveys, ${surveySamples.reduce((n,q)=>n+q.answers.length,0)} answers; weights are not polling data.`);
  console.log(`Seeded ${categoryNames.length} categories, ${games.length} game types and ${samples.length + partySamples.length + letterSamples.length} original questions.`);
}

main().finally(async () => { await prisma.$disconnect(); }).catch((error) => { console.error(error); process.exitCode = 1; });
