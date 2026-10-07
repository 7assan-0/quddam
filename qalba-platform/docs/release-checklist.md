# Quddam production release checklist

This checklist is an operator procedure, not deployment authorization. A release requires the explicit Phase 5.0J-1 evidence-backed verdict. Keep the I-1 CSP in Report-Only mode.

## Before deploy

- Verify the release source fingerprint, package-lock, schema and all migration checksums against the final report.
- Identify the target database and migration owner. Take a protected backup/snapshot and verify restoration into a separate database; agree recovery-point limits.
- Configure restricted production secrets and HTTPS ingress; run `npm run ops:validate`. Verify trusted client headers are overwritten and direct ingress is blocked if proxy trust is enabled.
- Verify provider account, callback and reconciliation configuration without an unintended real charge. Keep disabled integrations disabled.
- Plan explicit first-admin bootstrap only if needed; no default password and no existing credential overwrite.
- Review the complete forward migration chain and app/job compatibility. **NEVER run `prisma migrate reset` against production.**

## Deploy

- Coordinate/drain incompatible workers; run `npm run db:migrate` (`prisma migrate deploy`) and `npm run db:generate`.
- If required, run `npm run ops:bootstrap-admin` with protected explicit input; remove bootstrap credentials afterward.
- Bootstrap missing content only with `NODE_ENV=production npm run db:seed:content`. Do not destructively reseed populated data.
- Run `npm run content:validate`; require zero blocking errors and review documented warnings.
- Build with `npm run build`; start the same verified source with `npm run start`.
- Enable protected, bounded reconciliation/analytics/retention jobs only after readiness; follow the retention dry-run rollout.

## Smoke

- Login/logout, secure cookies, profile, admin authorization and unrelated-user denial.
- Safe/fake-provider purchase verification, callback/reconciliation authorization and status display; no unintended charge.
- One canary game: create, START exactly once, meaningful command and correct wallet/history.
- TV/display access, phone deadline, SSE update/reconnect and supported historical result.
- Assets/fonts/icons and candidate CSP Report-Only headers; no unexplained browser policy/runtime errors.

## After deploy

- Inspect sanitized logs, durable metrics, pool/lock/job failures and refund support remainder.
- Inspect CSP Report-Only violations using the [security-header procedure](security-headers.md); do not switch to enforcement automatically.
- Inspect pending/unknown invoice recovery and reconciliation fairness/backoff.
- Run retention dry-run, inspect aggregate counts, process one small real batch and verify history/auth before scheduling daily bounded cleanup.

## Rollback / incident

Follow [M13 database lifecycle and recovery](database-lifecycle.md) and the [production runbook](production-runbook.md). No down migration or destructive reset is a rollback. Restore into a separate database first; account for later financial/gameplay writes and credential revocations. Code rollback cannot recover already-redacted private data.
