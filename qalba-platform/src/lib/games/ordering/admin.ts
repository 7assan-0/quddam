import type { z } from 'zod';
import { db } from '@/lib/db';
import { questionSchema } from './validation';
import { OrderingError, normalize } from './module';
export async function saveOrderingQuestion(input: z.infer<typeof questionSchema>, id?: string) {
 return db().$transaction(async tx => { await tx.$queryRawUnsafe('SELECT "id" FROM "Category" WHERE "id"=$1 FOR SHARE', input.categoryId); const category = await tx.category.findUnique({ where: { id: input.categoryId } }); if (!category || input.status === 'PUBLISHED' && !category.active) throw new OrderingError('اختر فئة موجودة وفعالة للنشر', 400);
 const { items, sourceDate, ...rest } = input; const data = { ...rest, sourceDate: sourceDate ? new Date(sourceDate) : null, normalizedTitle: normalize(input.title) };
 if (!id) return tx.orderingQuestion.create({ data: { ...data, items: { create: items } }, include: { items: { orderBy: { correctPosition: 'asc' } } } });
 await tx.$queryRawUnsafe('SELECT "id" FROM "OrderingQuestion" WHERE "id"=$1 FOR UPDATE', id); await tx.orderingItem.deleteMany({ where: { questionId: id } }); return tx.orderingQuestion.update({ where: { id }, data: { ...data, items: { create: items } }, include: { items: { orderBy: { correctPosition: 'asc' } } } });
 });
}
