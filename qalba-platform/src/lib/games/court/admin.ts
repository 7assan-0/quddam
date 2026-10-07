import type { z } from 'zod';
import { db } from '@/lib/db';
import { caseSchema } from './validation';
import { CourtError, normalize, validateCase } from './module';
export async function saveCourtCase(input: z.infer<typeof caseSchema>, id?: string) {
  return db().$transaction(async tx => { await tx.$queryRawUnsafe('SELECT "id" FROM "Category" WHERE "id"=$1 FOR SHARE', input.categoryId); const category = await tx.category.findUnique({ where: { id: input.categoryId } }); if (!category || input.status === 'PUBLISHED' && !category.active) throw new CourtError('اختر فئة موجودة وفعالة للنشر', 400); validateCase({ ...input, category: category.title });
    const { facts, ...rest } = input; const data = { ...rest, normalizedTitle: normalize(input.title) }, nested = facts.map((text, position) => ({ text, position }));
    if (!id) return tx.courtCase.create({ data: { ...data, facts: { create: nested } }, include: { facts: { orderBy: { position: 'asc' } } } });
    await tx.$queryRawUnsafe('SELECT "id" FROM "CourtCase" WHERE "id"=$1 FOR UPDATE', id); await tx.courtCaseFact.deleteMany({ where: { caseId: id } }); return tx.courtCase.update({ where: { id }, data: { ...data, facts: { create: nested } }, include: { facts: { orderBy: { position: 'asc' } } } });
  });
}
