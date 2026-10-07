import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { UserManager } from "@/components/user-manager";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const admin = await requireUser(); if (admin.role !== "ADMIN") notFound();
  const params = await searchParams;
  const page = Math.min(10000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const q = (params.q ?? "").trim().slice(0, 80);
  const where = q ? { email: { contains: q, mode: "insensitive" as const } } : {};
  const [users, count] = await Promise.all([
    db().user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 30, take: 30,
      select: { id: true, name: true, email: true, role: true, suspendedAt: true, createdAt: true, wallet: { select: { balance: true } }, _count: { select: { hostedGames: true } } } }),
    db().user.count({ where }),
  ]);
  return <div className="shell"><div className="page-title"><span className="eyebrow">إدارة الحسابات</span><h1>المستخدمون</h1><p>ابحث بالبريد الإلكتروني، وأدر الصلاحيات والإيقاف. يصبح الإيقاف نافذًا على الجلسات الموجودة فورًا.</p></div><div className="utility-links"><Link className="btn btn-secondary" href="/admin">لوحة الإدارة</Link></div>
    <form className="form-row admin-search" action="/admin/users"><input className="input" name="q" type="search" aria-label="ابحث بالبريد" placeholder="البحث بالبريد الإلكتروني" defaultValue={q} maxLength={80} /><button className="btn btn-primary">بحث</button></form>
    <UserManager users={users.map(({ createdAt, suspendedAt, ...user }) => ({ ...user, createdAt: createdAt.toISOString(), suspended: Boolean(suspendedAt), balance: user.wallet?.balance ?? 0, games: user._count.hostedGames }))} ownId={admin.id} />
    <div className="utility-links"><span className="muted">{count} حساب · صفحة {page}</span>{page > 1 && <Link className="btn btn-secondary btn-small" href={`/admin/users?page=${page - 1}&q=${encodeURIComponent(q)}`}>السابق</Link>}{page * 30 < count && <Link className="btn btn-secondary btn-small" href={`/admin/users?page=${page + 1}&q=${encodeURIComponent(q)}`}>التالي</Link>}</div>
  </div>;
}
