# Oracle Cloud Infrastructure (OCI) — private Staging plan

**Status:** the owner selected OCI as the hosting provider. This is a reviewable preparation plan, **not an infrastructure deployment or commercial launch**. Neither region, tenancy, compartment, DNS ownership, instance allocation nor spending was verified. No OCI API calls, purchase, production or live merchant access are authorized by this PR.

## Owner choices required before provisioning

1. Confirm the OCI tenancy/home region, target region, compartment, access method and monthly maximum acceptable spend. Do not assume the user's current location is the tenancy's home region.
2. Inspect **Limits, Quotas and Usage** in the real account, then verify Always Free eligibility **for every individual selected resource** (shape, OCPUs, RAM, boot/block storage, load balancer, backups, egress). Oracle may report out-of-host capacity; do not silently switch to a paid shape/region or upgrade the account.
3. Enable OCI cost budget/alerts on the staging compartment. These are **soft notifications, not a hard spending cutoff**. Require separate owner approval before creating billable resources. Inventory/record any resource that could outlive the test.
4. Choose either a private-network/VPN staging gateway or an authenticated HTTPS ingress for invited testers. OCI Bastion provides controlled administrator access to private instances; it does **not** by itself implement browser/tester authentication.
5. Approve the actual DNS/TLS approach; keep all generated certs, credentials, keys, OCIDs and ingress evidence out of repository, CI output and chat.

## Proposed smallest safe topology

- A **dedicated staging compartment** and VCN with explicit Network Security Groups (NSGs) and reviewed default Security Lists. Prefer a private subnet for the app/DB, or permit only tightly scoped authenticated HTTPS gateway access. Ensure IPv4 and IPv6 paths are covered.
- Candidate Compute: **VM.Standard.A1.Flex (ARM64/Ampere)** if it is available and confirmed eligible in the account/home region; otherwise stop for a new owner decision, rather than assuming paid fallback. Verify Node 24, Prisma engine/adapter, Postgres and native dependencies on the actual aarch64 image and architecture. No assumed free-tier quantity, capacity or throughput guarantee.
- One supervised Next.js application process; application listener on loopback or private-only interface behind a trusted HTTPS proxy, not public TCP 3000. The proxy must strip user-supplied `x-quddam-client-ip` and unconditionally replace it with an actual validated peer IP before `AUTH_TRUST_PROXY=true` is considered. Do not use arbitrary forwarded chains. Record tests showing direct bypass attempts fail.
- An isolated staging PostgreSQL database/user, potentially on the same dedicated staging-only VM for initial low-cost testing, bound to loopback or private-only address; **never expose TCP 5432 publicly**. The Staging database must never connect to Production or share credentials/backups with it. Coordinate one migration operator; no destructive reset.
- Restrict administrative SSH through OCI Bastion or another explicitly approved method with minimal IAM, temporary sessions and reviewed NSG/OS firewall rules. Avoid unrestricted 22/3000/5432 in any Security List/NSG or IPv6 rule. OCI NSG **and OS firewall** and actual listening sockets must all be checked.
- Enforce no live billing keys, outbound mail credentials, reconciliation or analytics cron, demo welcome credits, or default/bootstrap secrets on a deployed staging instance. Generate staging-only secrets in a manager and provide them only to the instance. Synthetic content/test accounts only.
- Backups are protected independently from the app disk (a restricted storage destination, if owner-approved); restore to a *different* disposable staging database and measure outcomes. A snapshot label alone is not a recovery test.
- Collect sanitized application and OS logs, per-process memory/CPU, DB pool/lock and 429 rates. OCI Monitoring/Notifications/Logging can be evaluated after cost/limits review; no claim they have been enabled.

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

The existing `node scripts/staging-preflight.mjs` and `npm run ops:validate` are read-only configuration checks and **do not establish the above acceptance**. Source-bound CI on a PR is not Staging deployment authorization. No cloud creation or Terraform apply is part of this PR.

## Oracle reference docs (verify date and account eligibility at execution)

- Always Free resources and capacity: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- OCI Compute ARM/Ampere: https://docs.oracle.com/en-us/iaas/Content/Compute/References/arm.htm
- Security Rules and NSGs: https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securityrules.htm
- OCI Bastion: https://docs.oracle.com/en-us/iaas/Content/Bastion/Concepts/bastionoverview.htm
- OCI Budgets (soft spend alerts): https://docs.oracle.com/en-us/iaas/Content/Billing/Concepts/budgetsoverview.htm
