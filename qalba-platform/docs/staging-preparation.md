# Quddam private Staging — preparation only

**Status:** planning and static safety checks only. No staging host, domain, public route, customer data, database, secrets, monitoring subscription, merchant integration or deployment is created by this PR. This is not a release pass.

## Roles and approval boundary

- Owner chooses the hosting provider, private-access method, domain and budget; owns accounts and secure secret manager. Do not send secrets to chat, repository or Actions logs.
- Codex prepares infrastructure-as-code only after the owner approves a target topology; a separate PR and review precede any deployment.
- Reviewer verifies the exact combined source SHA, data isolation, evidence from a real ingress and the release checks; no predecessor verification inherited.
- No public access, live merchant activation or automated billing jobs while financial review workflow and merchant approval are incomplete.

## Proposed provider-neutral topology

A supervised Next.js instance in production runtime behind HTTPS and private network or authenticated gateway; a dedicated PostgreSQL instance/database/user not shared with production; isolated secrets, logs and backup store; explicit operator-controlled migrations and retention. The app listener must not be publicly reachable except through the gateway. This is a proposal, not a deployed architecture. The application requireSameOrigin depends on canonical APP_URL and forwarded host/TLS behavior.

Follow existing docs/production-runbook.md and docs/database-lifecycle.md: check exact source inventory and fresh database identity, do a separate restore drill, apply immutable forward migrations once with an assigned operator, generate Prisma, run content:validate, ops:validate, build then start. Do not reset migrations, silently reseed populated data, use production credentials, invoke merchant endpoints, schedule reconciliation, or roll back financial code to versions unaware of durable holds.

## Read-only configuration preflight

Run: node scripts/staging-preflight.mjs in the isolated staging operator environment. This performs no network or database calls, no writes, and outputs setting names/error codes only. It refuses payment/mail/analytics cron configuration, public ingress intent and mismatched source targets. STAGING_ISOLATION_OWNER_APPROVED=true is an operator declaration, not proof.

Required values (do not commit populated values):

| Name | Purpose |
| --- | --- |
| STAGING_CONTEXT=isolated-preparation | Explicit environment purpose |
| NODE_ENV=production | Production runtime |
| APP_URL and STAGING_EXPECTED_ORIGIN | Matching canonical private HTTPS origin |
| STAGING_ACCESS_MODE=private-network or authenticated-ingress | Private-access intent, verify externally |
| DATABASE_URL and STAGING_EXPECTED_DATABASE | Exact dedicated DB target, verified by a separate operator |
| STAGING_ISOLATION_OWNER_APPROVED=true | Owner attests separately verified isolated DB |
| AUTH_RATE_LIMIT_SECRET | Staging-only secret of at least 32 non-placeholder characters |
| PUBLIC_WELCOME_CREDITS_ENABLED=false | Avoid free grants from test users |
| AUTH_TRUST_PROXY=false | Conservative unknown-client default until ingress is verified |

Remote database URLs must explicitly specify sslmode=require or verify-full; independently verify actual TLS, networking and backups. Keep all MOYASAR_* and BILLING_CRON_SECRET, SMTP_*, ANALYTICS_CRON_SECRET, SEED_* and BOOTSTRAP_ADMIN_* absent for the preflight. It deliberately does not enable billing, mail, cleanup or first-admin creation. If an isolated synthetic admin is needed, use the existing explicit bootstrap procedure only after DB identity inspection.

To later test trusted proxy mode, set AUTH_TRUST_PROXY=true only after an ingress unconditionally strips incoming x-quddam-client-ip and overwrites it with one validated peer IP, and direct access to the Next server is denied. Use AUTH_CLIENT_IP_HEADER=x-quddam-client-ip and reference independent evidence by STAGING_PROXY_EVIDENCE_ID and STAGING_DIRECT_INGRESS_EVIDENCE_ID. The preflight checks presence, not the evidence's genuineness. A real operator must inspect it.

The preflight complements, not replaces, npm run ops:validate, independent DB inspection, gateway tests and recovery exercises.

## Private staging acceptance plan — execute only after infrastructure approval

1. Confirm HTTPS, controlled access, direct app-port isolation, secrets ownership and absence of production DB/merchant/mail credentials; inspect actual DNS/TLS/proxy configuration.
2. Through the gateway attempt forged X-Forwarded-For and x-quddam-client-ip values, comma chains, malformed IPs, mapped IPv4 and IPv6 /64. Verify ingress overwrites the header from the trusted peer. Check unknown fallback without exposing raw IPs in evidence.
3. Test Board aliases, distinct real Court CUID room quotas, Social/Bluff UUID rooms and all four 429 denial boundaries. Check separate clients, shared NATs, database counter contention/pool, and gateway request-size/time/concurrency bounds.
4. Test login/logout, cross-user denial, game creation and exactly-once START with synthetic credits, TV/phone SSE reconnect and supervised restart persistence. No live payment flows.
5. Back up to a restricted separate target and restore to a different disposable DB. Never overwrite the only database.
6. Inspect redacted logs and configure alerts for errors, pool contention, 429s and the separate financial review queue. Audited PENDING-hold resolution, implemented alerting, merchant verification and complete successor gates still block commercial launch.
7. Record operator identity, exact candidate SHA, config-name checklist, anonymized outcomes and GO/NO-GO; never log tokens, secrets, cookies, raw IPs or synthetic personal credentials.

## Verification boundary

The staging-preparation GitHub workflow runs built-in Node contract tests using synthetic values only. It does not deploy or reach a real gateway. A green CI result means the preflight tool passed, not that Staging is live.
