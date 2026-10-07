import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { CategoryManager } from "@/components/category-manager";

export default async function AdminCategories() {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();
  const categories = await db().category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { questions: true } } } });
  return <div className="shell"><div className="page-title"><span className="eyebrow">إدارة المحتوى</span><h1>الفئات</h1><p>أضف موضوعات جديدة أو أخفِ فئة من الاختيار.</p></div><div className="utility-links"><Link className="btn btn-secondary" href="/admin">لوحة الإدارة</Link><Link className="btn btn-secondary" href="/admin/questions">الأسئلة</Link></div><CategoryManager initial={categories.map((category) => ({ id: category.id, slug: category.slug, title: category.title, description: category.description, active: category.active, questions: category._count.questions }))} /></div>;
}
