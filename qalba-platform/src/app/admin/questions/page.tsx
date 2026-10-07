import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { QuestionManager } from "@/components/question-manager";
import { QuestionImport } from "@/components/question-import";

export default async function AdminQuestions({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();
  const requested = Number((await searchParams).page ?? 1);
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, 100000) : 1;
  const [categories, gameTypes, count, questions] = await Promise.all([
    db().category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, title: true } }),
    db().gameType.findMany({ select: { id: true, title: true } }),
    db().question.count(),
    db().question.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 20, take: 20, include: { category: { select: { title: true } } } }),
  ]);
  return <div className="shell"><div className="page-title"><span className="eyebrow">إدارة المحتوى</span><h1>بنك الأسئلة</h1><p>اكتب أسئلة أصلية، راجعها، ثم انشرها. لا تظهر المسودات في اللعب.</p></div><div className="utility-links"><Link className="btn btn-secondary" href="/admin">لوحة الإدارة</Link><Link className="btn btn-secondary" href="/admin/categories">الفئات</Link></div>
    <QuestionImport />
    <QuestionManager categories={categories} gameTypes={gameTypes} initial={questions.map((q) => ({ id: q.id, gameTypeId: q.gameTypeId, categoryId: q.categoryId, categoryTitle: q.category.title, question: q.question, answer: q.answer, alternativeAnswers: q.alternativeAnswers, explanation: q.explanation, difficulty: q.difficulty, pointValue: q.pointValue, type: q.type, options: Array.isArray(q.options) ? q.options.filter((v): v is string => typeof v === "string") : [], source: q.source, status: q.status, subcategory: q.subcategory, imageUrl: q.imageUrl, language: q.language, country: q.country }))} />
    <div className="utility-links"><span className="muted">صفحة {page} · {count} سؤال</span>{page > 1 && <Link className="btn btn-secondary btn-small" href={`/admin/questions?page=${page - 1}`}>السابق</Link>}{page * 20 < count && <Link className="btn btn-secondary btn-small" href={`/admin/questions?page=${page + 1}`}>التالي</Link>}</div>
  </div>;
}
