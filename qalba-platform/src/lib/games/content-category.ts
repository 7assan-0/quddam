import { Prisma } from "@/generated/prisma/client";

/** New selection only. SHARE conflicts with category deactivation and is held
 * until the caller's existing snapshot/START transaction commits or rolls back.
 * Re-read active after waiting; never apply this policy to existing snapshots. */
export async function lockActiveCategories(tx: Prisma.TransactionClient, categoryIds: string[]) {
  const ids = [...new Set(categoryIds)].sort();
  if (!ids.length) return [];
  const rows = await tx.$queryRaw<{ id: string; active: boolean }[]>(Prisma.sql`
    SELECT "id", "active" FROM "Category" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR SHARE`);
  return rows.filter(row => row.active).map(row => row.id);
}
