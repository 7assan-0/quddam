# Quddam production bootstrap and operations

Explicit operator procedure; startup does not migrate, seed, create accounts or clean data. Preserve the [M13 database lifecycle/recovery procedure](database-lifecycle.md), [retention](data-retention.md), [content quality](content-quality.md), [ingress/signup](PUBLIC_INGRESS_SIGNUP.md) and [refund policy](PAYMENT_REFUNDS.md).

**NEVER run `prisma migrate reset` against production.** Never drop the schema, delete history, edit an old migration or restore over the only database to make an upgrade pass. This release has24 forward migrations; H-1 adds none.

## Configuration

Provide secrets through a secret manager/restricted environment, not command arguments, source control or logs. `.env.example` is local configuration, not production credentials. `npm run ops:validate` reports names/reasons only. `npm run start` loads Next environment files and runs the same validation before production Next starts. Validation cannot prove actual ingress isolation, SMTP delivery, merchant ownership or database TLS; operators must verify those.

| Setting | Requirement |
|---|---|
| DATABASE_URL | PostgreSQL URL naming the intended database; restricted role and verified TLS/network protection. Never use the sample Docker password. Confirm identity before migration. |
| DATABASE_POOL_MAX | Integer1–20, default10 per process. Budget all replicas, jobs, migrations and support together. |
| APP_URL | Canonical HTTPS origin with no credentials/path/query/fragment. Verify TLS/proxy configuration and existing Secure/HttpOnly cookies. |
| AUTH_RATE_LIMIT_SECRET | Non-placeholder random32+ character secret for abuse-key pseudonymization. Sessions use existing opaque random credentials; no new signing secret is invented. |
| AUTH_TRUST_PROXY / AUTH_CLIENT_IP_HEADER | Default false. Enable only with ingress that overwrites a single-IP header and blocks direct access. Unknown clients share the existing conservative budget. |
| PUBLIC_WELCOME_CREDITS_ENABLED | Explicit true/false; keep false pending public-signup eligibility approval. Existing configured grant count still applies; no price/credit-policy change. |
| MOYASAR_SECRET_KEY / MOYASAR_CALLBACK_TOKEN | Both required to enable checkout; callback secret random32+ characters. Neither means disabled; partial configuration fails. |
| BILLING_CRON_SECRET | Random32+ characters when payments enabled; protect reconciliation invocation. |
| ANALYTICS_CRON_SECRET | Random32+ characters for HTTP prune; otherwise use internal CLI retention and leave HTTP cron disabled. |
| SMTP_HOST / SMTP_PORT / SMTP_FROM | Needed for password recovery; valid port and paired credentials if authenticated. Without SMTP, reset remains explicitly unavailable. |
| BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD | Explicit first-admin input, password12–200 characters. Clear after bootstrap; never ship a default. |
| NODE_ENV | Production for build/start/content bootstrap; start wrapper enforces production mode. |
| CSP_IMAGE_ORIGINS | Optional exact approved HTTPS origins for authored external images; empty by default. See [security headers](security-headers.md). Build/start reject malformed or broad origins. |

## Safe deployment sequence

1. Verify source fingerprint, SQL checksums, target DB identity and maintenance owner. Capture protected backup/snapshot and prove restoration into a separate DB. Record recovery-point expectations and read M13 limitations.
2. `npm ci`; configure restricted production environment; `npm run ops:validate`. Stop on errors and inspect warnings. Read-only inspect nonnegative wallet/coupon invariants and migration state.
3. Drain incompatible app/job workers and coordinate one migration operator. Run `npm run db:migrate` (Prisma migrate deploy), then `npm run db:generate`. Repeated deployment is a no-op. On failure inspect actual DDL and `_prisma_migrations`; do not reset/edit SQL.
4. First deployment only: provide bootstrap inputs and `npm run ops:bootstrap-admin`. Returns ADMIN_CREATED or ADMIN_ALREADY_EXISTS. Existing ADMIN causes no-op without requiring/replacing credentials. Existing non-admin email is rejected, not promoted. Concurrent operators serialize with a transaction-scoped PostgreSQL advisory lock. New admin wallet starts at zero. Remove bootstrap secrets afterward.
5. If content is absent, `NODE_ENV=production npm run db:seed:content`. Existing idempotent seed runs without demo accounts and preserves content edits/archive flags/settings/users/passwords/finance/snapshots. Do not routinely reseed upgrades. Production ordinary seed without content-only fails before writes. Seed is not an editorial overwrite tool.
6. `npm run content:validate`: read-only authored+populated validation; zero blocking errors required. Review capacity/warnings, including existing Ordering warning. Do not automatically archive/remediate during deployment.
7. Run release quality gates, `npm run build`, then `npm run start`. Wrapper validates environment before spawning Next; no implicit financial calls, migration or cleanup. Confirm supervised stop/start against same DB. Review the [report-only CSP rollout](security-headers.md), TLS/HSTS assumptions and sanitized violation monitoring; do not enable enforcement solely from a local smoke run.
8. Enable existing bounded jobs after readiness: protected POST `/api/billing/reconcile` every few minutes; daily analytics prune if configured; daily internal `scripts/data-retention.ts` following its dry-run/small-batch rollout. Keep Bearer secrets out of URLs/logs/shell history. No startup retention drain.
9. Smoke public/login/admin routes, secure cookies, logout revocation and unrelated-user denial.
10. Verify provider configuration in test environment without unintended real charge. Check disabled checkout when unconfigured and callback/cron authorization. Callback is a hint; only authoritative verification changes money. No live provider call is claimed by this phase.
11. Synthetic/canary game: create, START, first interaction, TV/phone reconnect and one START ledger entry. Verify saved history/wallet/support. Never recreate existing active games.
12. Monitor migration/job failures, pool saturation, lock waits, SSE transient/terminal counts, reconciliation backlog, cleanup aggregates and refund remainder. Counters use [explicit semantics](metrics-history.md).
13. Rollback follows M13 backup/restore/compatibility guidance. No down migration exists. Restore loses later writes unless reconciled; never revive revoked credentials or silently lose money. Code rollback cannot recreate redacted private material.

## Proof and limits

H-1's synthetic native harness runs production content-only seed twice on populated accounts/passwords/wallets/financial records/all ten active games/commands/snapshots/archive flags/catalogue, then no-op migration deploy and existing-admin bootstrap. Logical rows remain unchanged. Separate empty DB proves concurrent first-admin creation, no role promotion and stable retries. Real app restart preserves Board state/deadline.

This is operator safety proof, not deployment, capacity/legal certification or live-provider verification. Infrastructure TLS, backups, scheduler and monitoring still require deployment checks.
