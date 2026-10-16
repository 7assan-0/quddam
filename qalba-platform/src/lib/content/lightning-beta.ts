import { auditBank, contentDto, isContentEligible, lightningBoardOverlaps, lightningBoardSemanticOverlaps, contentPolicies, type Banks, type AuditIssue } from './audit';

/**
 * Strict *game* candidate gate. The generic catalogue deliberately permits
 * a small playable Lightning bank; Beta v1 requires 600 eligible and valid
 * authored questions, distributed as >=40 questions across >=15 categories.
 *
 * This is a read-only audit; it never edits source/DB rows or game snapshots.
 * A source-only result is diagnostic, not a substitute for database proof.
 */
export function auditLightningBeta(banks: Pick<Banks, 'category-board' | 'lightning-quiz'>) {
 const rows = banks['lightning-quiz'];
 const eligible = rows.filter(r => isContentEligible('lightning-quiz', r));
 const bank = auditBank('lightning-quiz', rows);
 const counts = new Map<string, number>();
 const errors: AuditIssue[] = [...bank.errors,
  ...lightningBoardOverlaps(banks),
  ...lightningBoardSemanticOverlaps(banks)];
 let valid = 0;
 for (const row of eligible) {
  const parsed = contentPolicies['lightning-quiz'].schema.safeParse(contentDto('lightning-quiz', row));
  if (!parsed.success) continue;
  valid++;
  counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
 }
 if (valid < 600) errors.push({ code: 'LIGHTNING_BETA_VALID_600_REQUIRED', ids: [] });
 const adequate = [...counts.values()].filter(n => n >= 40).length;
 if (adequate < 15) errors.push({ code: 'LIGHTNING_BETA_15_CATEGORIES_40_EACH_REQUIRED', ids: [] });
 return {
  scope: 'LIGHTNING_BETA_V1',
  nonMutating: true as const,
  authored: rows.length,
  published: bank.published,
  eligible: eligible.length,
  structurallyValidEligible: valid,
  categoriesWithAtLeast40: adequate,
  categories: Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b))),
  errors,
  warnings: bank.warnings,
  verdict: errors.length ? 'FAIL' as const : 'PASS' as const,
 };
}

export function lightningBetaDecision(source: ReturnType<typeof auditLightningBeta>, database: ReturnType<typeof auditLightningBeta> | null) {
 if (source.verdict === 'FAIL' || database?.verdict === 'FAIL') return 'FAIL' as const;
 return database ? 'PASS' as const : 'NOT_RUN_DATABASE' as const;
}
