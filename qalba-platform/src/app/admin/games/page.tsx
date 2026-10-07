import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { GameManager } from "@/components/game-manager";

export default async function AdminGames() {
  const admin = await requireUser(); if (admin.role !== "ADMIN") notFound();
  const games = await db().gameType.findMany({ include: { powerUps: { orderBy: { slug: "asc" } }, _count: { select: { sessions: true, questions: true } } }, orderBy: { createdAt: "asc" } });
  return <div className="shell"><div className="page-title"><span className="eyebrow">إدارة اللعب</span><h1>الألعاب والقدرات</h1><p>أوقف استقبال مباريات جديدة لأي لعبة أو أعد تفعيلها. المباريات القائمة تظل قابلة للإكمال.</p></div><div className="utility-links"><Link className="btn btn-secondary" href="/admin">لوحة الإدارة</Link></div>
    <GameManager games={games.map(game => ({ id: game.id, slug: game.slug, title: game.title, enabled: game.enabled, sessions: game._count.sessions, questions: game._count.questions,
      powers: game.powerUps.map(power => { const config = power.config as { initialCount?: number; seconds?: number }; return { id: power.id, slug: power.slug, title: power.title, enabled: power.enabled, initialCount: config.initialCount ?? 1, seconds: config.seconds ?? 15 }; }) }))} />
  </div>;
}
