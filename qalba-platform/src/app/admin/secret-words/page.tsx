import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { SecretWordManager } from "@/components/secret-word-manager";
export default async function SecretWordsPage() {
  const user = await requireUser(); if (user.role !== "ADMIN") notFound();
  const [words, categories] = await Promise.all([db().secretWord.findMany({ include: { category: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
    db().category.findMany({ where: { active: true }, select: { id: true, title: true }, orderBy: { sortOrder: "asc" } })]);
  return <div className="shell"><div className="page-title"><span className="eyebrow">إدارة المحتوى</span><h1>كلمات خارج الجو</h1><p>أضف كلمات أصلية وحدد الفئة والصعوبة، أو أرشف كلمة غير مناسبة.</p></div>
    <SecretWordManager initial={words.map(({ id, word, categoryId, difficulty, status, alternativeAnswers, category }) => ({ id, word, categoryId, difficulty, status, alternativeAnswers, category: category.title }))} categories={categories} /></div>;
}
