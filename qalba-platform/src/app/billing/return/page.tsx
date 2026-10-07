import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PurchaseStatus } from "@/components/purchase-status";
export default async function ReturnPage({ searchParams }: { searchParams: Promise<{ purchase?: string }> }) {
  const user = await requireUser(), { purchase: id } = await searchParams;
  const record = id ? await db().purchase.findUnique({ where: { id } }) : null;
  if (!record || record.userId !== user.id) notFound();
  return <div className="shell section"><div className="page-title"><h1>نتيجة الدفع</h1><p>قد يستغرق تأكيد المزود لحظات.</p></div><PurchaseStatus id={record.id} initial={record.status} /></div>;
}
