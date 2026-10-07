import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/admin/csv";
import { errorResponse, forbidden } from "@/lib/http";

const datasetSchema = z.enum(["users", "categories", "games", "purchases", "reports"]);
const LIMIT = 10_000;
export async function GET(request: NextRequest) {
  try {
    if ((await currentUser())?.role !== "ADMIN") return forbidden();
    const dataset = datasetSchema.parse(request.nextUrl.searchParams.get("dataset"));
    let rows: Array<Array<string | number | null | undefined>>;
    let count: number;
    if (dataset === "users") {
      count = await db().user.count();
      if (count > LIMIT) return tooLarge();
      const users = await db().user.findMany({ select: { id: true, email: true, name: true, role: true, suspendedAt: true, createdAt: true, wallet: { select: { balance: true } } }, orderBy: { createdAt: "asc" } });
      rows = [["id", "email", "name", "role", "suspendedAt", "createdAt", "credits"], ...users.map(item => [item.id, item.email, item.name, item.role, item.suspendedAt?.toISOString(), item.createdAt.toISOString(), item.wallet?.balance ?? 0])];
    } else if (dataset === "categories") {
      count = await db().category.count(); if (count > LIMIT) return tooLarge();
      const categories = await db().category.findMany({ orderBy: { sortOrder: "asc" } });
      rows = [["id", "slug", "title", "description", "active", "sortOrder"], ...categories.map(item => [item.id, item.slug, item.title, item.description, String(item.active), item.sortOrder])];
    } else if (dataset === "games") {
      count = await db().gameSession.count(); if (count > LIMIT) return tooLarge();
      const games = await db().gameSession.findMany({ include: { host: { select: { email: true } }, gameType: { select: { slug: true } }, teams: { select: { name: true, score: true } } }, orderBy: { createdAt: "asc" } });
      rows = [["id", "gameSlug", "hostEmail", "status", "createdAt", "startedAt", "endedAt", "scores"], ...games.map(item => [item.id, item.gameType.slug, item.host.email, item.status, item.createdAt.toISOString(), item.startedAt?.toISOString(), item.endedAt?.toISOString(), item.teams.map(team => `${team.name}: ${team.score}`).join(" | ")])];
    } else if (dataset === "purchases") {
      count = await db().purchase.count(); if (count > LIMIT) return tooLarge();
      const purchases = await db().purchase.findMany({ include: { user: { select: { email: true } }, product: { select: { slug: true } } }, orderBy: { createdAt: "asc" } });
      rows = [["id", "email", "productSlug", "status", "amountHalalas", "createdAt", "paidAt"], ...purchases.map(item => [item.id, item.user.email, item.product.slug, item.status, item.amountHalalas, item.createdAt.toISOString(), item.paidAt?.toISOString()])];
    } else {
      count = await db().questionReport.count(); if (count > LIMIT) return tooLarge();
      const reports = await db().questionReport.findMany({ include: { user: { select: { email: true } }, question: { select: { question: true } } }, orderBy: { createdAt: "asc" } });
      rows = [["id", "email", "question", "reason", "details", "status", "createdAt", "resolvedAt"], ...reports.map(item => [item.id, item.user.email, item.question.question, item.reason, item.details, item.status, item.createdAt.toISOString(), item.resolvedAt?.toISOString()])];
    }
    return new NextResponse(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename=qalba-${dataset}.csv`, "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
function tooLarge() { return NextResponse.json({ error: "تجاوزت البيانات ١٠٬٠٠٠ سجل. يلزم تصدير مجزأ" }, { status: 413 }); }
