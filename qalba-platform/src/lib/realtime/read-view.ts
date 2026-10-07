import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';

export class ViewDeadlineDue extends Error {}

/** A consistent, read-only snapshot; only an observed due deadline enters the existing locked path. */
export async function readDeadlineView<T>(id: string, lock: (tx: Prisma.TransactionClient, id: string) => Promise<unknown>, read: (tx: Prisma.TransactionClient, resolveDue: boolean) => Promise<T>): Promise<T> {
  try {
    return await db().$transaction(tx => read(tx, false), { isolationLevel: 'RepeatableRead', timeout: 20_000 });
  } catch (error) {
    if (!(error instanceof ViewDeadlineDue)) throw error;
  }
  // Start a fresh READ COMMITTED transaction and re-read after acquiring the
  // original lock. A command/pause/other reader may already have resolved it.
  return db().$transaction(async tx => { await lock(tx, id); return read(tx, true); }, { timeout: 20_000 });
}
