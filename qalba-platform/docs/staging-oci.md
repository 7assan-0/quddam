# Oracle Cloud Infrastructure (OCI) — private Staging plan

**Status:** the owner selected OCI as the hosting provider. This is a reviewable preparation plan, **not an infrastructure deployment or commercial launch**. The owner-reported console inspection identifies the tenancy Home Region as **Saudi Arabia Central (Riyadh), `me-riyadh-1`**, with zero A1 use and zero block-storage use at that inspection; this is an operator report, **not an independent GitHub CI or OCI API attestation**. Compartment, DNS ownership, actual A1 host capacity, instance allocation and spending remain unverified. No OCI API calls, purchase, production or live merchant access are authorized by this PR.

## Owner choices required before provisioning

1. Reconfirm the owner-reported OCI Home Region **Riyadh (`me-riyadh-1`)** in console at execution; approve compartment, access method and maximum acceptable spend. Do not infer Home Region from the URL alone.
2. Inspect **Limits, Quotas and Usage** in the real account, then verify Always Free eligibility **for every individual selected resource** (shape, OCPUs, RAM, boot/block storage, load balancer, backups, egress). Oracle may report out-of-host capacity; do not silently switch to a paid shape/region or upgrade the account.
3. Enable OCI cost budget/alerts on the staging compartment. These are **soft notifications, not a hard spending cutoff**. Require separate owner approval before creating billable resources. Inventory/record any resource that could outlive the test.
4. Choose either a private-network/VPN staging gateway or an authenticated HTTPS ingress for invited testers. OCI Bastion provides controlled administrator access to private instances; it does **not** by itself implement browser/tester authentication.
5. Approve the actual DNS/TLS approach; keep all generated certs, credentials, keys, OCIDs and ingress evidence out of repository, CI output and chat.

## Proposed smallest safe topology

- A **dedicated staging compartment** and VCN with explicit Network Security Groups (NSGs) and reviewed default Security Lists. Prefer a private subnet for the app/DB, or permit only tightly scoped authenticated HTTPS gateway access. Ensure IPv4 and IPv6 paths are covered.
- Candidate Compute: **VM.Standard.A1.Flex (ARM64/Ampere)** if it is available and confirmed eligible in the account/home region; otherwise stop for a new owner decision, rather than assuming paid fallback. Verify Node 24, Prisma engine/adapter, Postgres and native dependencies on the actual aarch64 image and architecture. The reported regional service ceiling of 16 OCPU / 96 GB is **not** the Always Free entitlement. Candidate for limited staging is 2 OCPU / 12 GB with an initial 50 GB boot volume, provided the account's entitlement is verified. No assumed free-tier quantity, capacity or throughput guarantee.
- One supervised Next.js application process; application listener on loopback or private-only interface behind a trusted HTTPS proxy, not public TCP 3000. The proxy must strip user-supplied `x-quddam-client-ip` and unconditionally replace it with an actual validated peer IP before `AUTH_TRUST_PROXY=true` is considered. Do not use arbitrary forwarded chains. Record tests showing direct bypass attempts fail.
- An isolated staging PostgreSQL database/user, potentially on the same dedicated staging-only VM for initial low-cost testing, bound to loopback or private-only address; **never expose TCP 5432 publicly**. The new `docker-compose.staging.yml` is a **distinct opt-in profile** (never combine with the development `docker-compose.yml`): requires separate operator-supplied staging database name/user/password; binds only `127.0.0.1:5432:5432`; creating this file does not run containers or provision OCI. The Staging database must never connect to Production or share credentials/backups with it. Coordinate one migration operator; no destructive reset.
- Restrict administrative SSH through OCI Bastion or another explicitly approved method with minimal IAM, temporary sessions and reviewed NSG/OS firewall rules. Avoid unrestricted 22/3000/5432 in any Security List/NSG or IPv6 rule. OCI NSG **and OS firewall** and actual listening sockets must all be checked.
- Enforce no live billing keys, outbound mail credentials, reconciliation or analytics cron, demo welcome credits, or default/bootstrap secrets on a deployed staging instance. Generate staging-only secrets in a manager and provide them only to the instance. Synthetic content/test accounts only.
- Backups are protected independently from the app disk (a restricted storage destination, if owner-approved); restore to a *different* disposable staging database and measure outcomes. A snapshot label alone is not a recovery test.
- Collect sanitized application and OS logs, per-process memory/CPU, DB pool/lock and 429 rates. OCI Monitoring/Notifications/Logging can be evaluated after cost/limits review; no claim they have been enabled.

## ARM64 / PostgreSQL 17 execution blockers (not proven by static CI)

- The current TypeScript production launcher invokes `tsx`; it has been promoted to a production dependency and an x86 GitHub CI smoke test runs `npm ci --omit=dev` plus an import. This does **not** prove a complete production build or ARM64 run; perform fresh `npm ci` / Prisma generation / `next build` on the selected ARM64 image, and verify production-only runtime installation as a separate step using a preserved build output. Do not delete generated Prisma or Next build artifacts when pruning.
- Target an owner-approved supported Ubuntu LTS ARM64 image and Node 24.19.0 initially; do not assume base image or packages exist until inspected on OCI. There is no application Dockerfile or actual deployment. Review-only `ops/staging/quddam-staging.service.template`, `ops/staging/nginx-private-https.conf.template`, and `scripts/start-staging.mjs` now provide a proposed private-network runtime; see [`ops/staging/README.md`](../ops/staging/README.md). The opt-in wrapper loads the effective Next environment **before** its staging preflight, refuses non-private ingress and `AUTH_TRUST_PROXY` other than `false`, and pins Next to `127.0.0.1:3000`. Its success does not prove actual NSG/OS firewall isolation, VPN, TLS or runtime writes. Verify real listener and cache behavior independently; no public 3000.
- PostgreSQL 17 image platform manifest eligibility is not a migrations proof. On an **independently verified fresh staging DB**, apply the full migration inventory once and run integration/transaction/restore drills. The existing test evidence references PostgreSQL 16.15 and some older scripts assume x86 paths; rewrite those probes or explicitly report them unavailable on ARM64. Never run destructive reset on populated data.
- With a single 2 OCPU / 12 GB / 50 GB VM, app and DB share a failure domain; keep disk headroom, set log/WAL retention, monitor DB pool and 250 ms SSE polling, and avoid building during concurrent load. Verify backups in independent restricted storage only after cost and access approval.
- GitHub's preparation CI uses synthetic test credentials and Docker Compose config validation **without starting PostgreSQL**. It is not a real ingress test, proof of capacity or permission to provision resources.

## Ingress acceptance checklist (must be demonstrated on the real OCI resources)

| Layer | Required negative/positive evidence |
| --- | --- |
| OCI VCN and Security Lists/NSGs | Only owner-approved gateway origins reach ingress; external TCP 22, 3000 and 5432 denied; test both IPv4 and IPv6 |
| Compute OS | Listening sockets, host firewall and restart supervisor inspected; no direct Next or DB connection from untrusted client |
| TLS and identity | Valid owned HTTPS hostname, browser access gated to invited testers, denied anonymous direct access |
| Proxy headers | Forged X-Forwarded-For and x-quddam-client-ip ignored/rewritten, no multi-IP/port acceptance, truthful peer identity or conservative unknown bucket |
| Product routes | Board aliases; two distinct real Court CUID rooms; Social/Bluff UUIDs; all four 429 boundaries and NAT clients |
| Data safety | Exact separate DB identity/user and privileges before migrations; backup/restoration to different target |
| Operations | Node ARM64 build, auth/logout, START exactly once, TV/phone SSE reconnect and persistence, incident escalation and rollback drill |
| Finance | Checkout/callback/reconciliation disabled, separate audit of PENDING holds and monitoring still blocked until explicitly approved |

The `node scripts/staging-preflight.mjs` and `npm run ops:validate` checks (plus the launcher's pre-start validation) only inspect configuration and **do not establish the above acceptance**. Source-bound CI on a PR is not Staging deployment authorization. No cloud creation or Terraform apply is part of this PR.

## Oracle reference docs (verify date and account eligibility at execution)

- Always Free resources and capacity: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- OCI Compute ARM/Ampere: https://docs.oracle.com/en-us/iaas/Content/Compute/References/arm.htm
- Security Rules and NSGs: https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securityrules.htm
- OCI Bastion: https://docs.oracle.com/en-us/iaas/Content/Bastion/Concepts/bastionoverview.htm
- OCI Budgets (soft spend alerts): https://docs.oracle.com/en-us/iaas/Content/Billing/Concepts/budgetsoverview.htm
