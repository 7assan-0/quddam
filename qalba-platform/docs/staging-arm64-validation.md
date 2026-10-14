# Native ARM64 + PostgreSQL 17 verification — gated GitHub CI only

**Status: prepared, NOT executed.** This is the next verification stage after the read-only OCI preparation and private-runtime templates. It does not deploy to OCI or establish that `VM.Standard.A1.Flex` has host capacity in Riyadh. It uses an ephemeral GitHub-hosted native ARM64 runner and a disposable PostgreSQL 17 service; **private-repository Actions minutes count towards your allotment and may incur charges after free minutes run out**. Never add the approval label before the owner independently checks Actions billing/usage and explicitly authorizes this run.

Workflow: `.github/workflows/staging-arm64-pg17.yml`. It has NO automatic push/synchronize/schedule/manual-dispatch trigger. A maintainer intentionally applies the label `arm64-ci-approved` to **PR #5** after explicit owner approval; only that *label-added event* can start the job. Merely preparing this workflow, running the existing x64 synthetic contract job, or opening the PR will **not** start an ARM64 job. Do not place secrets or production tokens in the runner.

## Planned evidence (requires completed hosted run)

1. Checkout the exact PR head SHA, assert `aarch64` / Node `arm64`, use Node **24.19.0**, and install locked *build-time* dependencies with `npm ci --include=dev` even when `NODE_ENV=production`.
2. Run Prisma 7.10 generate, lint and typecheck on a **native** ARM64 host.
3. Deploy the **24 unchanged migrations** to a brand-new synthetic local PostgreSQL 17 database named `quddam_arm64_ci`; inspect `_prisma_migrations` and `prisma migrate status`. The probe rejects any other hostname, port, DB, username, architecture or non-CI execution.
4. Run `next build` natively. Insert a disabled synthetic `FeatureFlag` marker, roll back another marker in a test transaction and prove it did not persist.
5. Dump the CI original using `pg_dump -Fc`, create the distinct disposable `quddam_arm64_ci_restore` database in the **same ephemeral PG service**, and restore via `pg_restore --exit-on-error --no-owner --no-privileges`. Independently compare completed migration inventory, public-table names, PG major version and synthetic marker between original and restored clone.
6. Re-run migration deploy/status on the original as a no-op, then do a production-only npm install and a read-only production environment validator without starting a server or contacting external systems.
7. Retain logs that show the GitHub run ID, exact SHA, platform and anonymized pass/fail statements. Neither database contents nor a backup artifact is uploaded; all runner data is disposable.

## Not established by a green run

- OCI account/resource eligibility, A1 allocation, cost, actual VM image and exact deployment target.
- A genuine Oracle ARM64 host's performance/memory/disk throughput; GitHub's standard private ARM64 runner is **2 CPU / 8 GB**, not the proposed OCI 2 OCPU / 12 GB, and a passing build is not a load/capacity result.
- An independently protected **off-host** backup, production restoration, RTO/RPO, a populated historical major upgrade, completed database-lifecycle game/finance fixtures or representative concurrent SSE load. Only a **fresh-schema synthetic PG17 dump/clone** is tested here.
- Actual systemd/Nginx installation, valid DNS/TLS/VPN, NSG/host firewall, client-IP ingress rewriting, service persistence, payments or public/commercial readiness.

**After a green run**, a separate owner approval is needed for OCI resources, access strategy, networking, storage, monitoring/backup and maximum spending. Once a dedicated isolated instance exists, rerun native acceptance, realistic fixture migrations/recovery and bounded load/SSE tests before assigning staging GO. Failed CI is a BLOCKED/NEEDS VERIFICATION outcome, not a reason to alter original migration SQL or skip a test.
