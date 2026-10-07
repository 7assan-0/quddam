# PHASE 5.0J-2-RG03 — GitHub Actions runner preparation

**Outcome: CI PREPARED AND LOCALLY VALIDATED — GITHUB ACTIONS NOT EXECUTED.**

This is a continuation of release verification, not a product phase. No repository/run authorization was supplied. The workflow and helper files are prepared for the repository owner; no GitHub Actions run, product PASS, RG03 freeze or Release Candidate is fabricated.

## Input integrity and source freeze

Both supplied archives passed ZIP CRC validation and exact SHA256 verification:

| Supplied archive | SHA256 |
| --- | --- |
| RG02 frozen checkpoint | `55f544c7b8a3b2276adeaab00f7f64d79f8aec34ca29be68287542778333af34` |
| RG03 original evidence | `9d5e6aca903f092ab1d9e4eec3e9f6c38be015fb00a7800e9c8cd9cb0fa42017` |

All **670 authored application files are byte-identical** to the application members of the supplied RG02 checkpoint. Exact application/product/canonical assertion/timeout/schema/migration/dependency diff: **EMPTY**.

| Fingerprint | Value |
| --- | --- |
| Application, 670 files | `bbb44ee4250b85a9baeba7d441676d2fdfe10e38b32e8d55ee301d4598db72df` |
| Authorized RG03 external harness, 22 files | `47704bed3bc1d25e1ce50f14d2a5b1eaad74c67d0598119d8d9ad73009a7ff52` |
| Application + authorized harness, 692 files | `9d64d4c08e8df1af80eff4bb4eb5feed3a7946eeb20e025de9be8e93c068f510` |
| package-lock.json | `c3fcb1733f2281008ef45ace458ce5659de2a51c5aa9350688a01b212aa5602c` |
| Prisma schema | `908f851226554d0a451ebd3bbca9e9d3a185643bd91d97cce5c9ceda64e4a23c` |
| New CI code/config, 14 files | `6b198eb60247398cae3189d5e4f7bfa032a5af4515f8b759659536ca8e877b71` |
| CI code/config + its source manifest, 15 files | `e214ecca8a7e2e6d389b5dd60cba76534c940c9f4c7df56eea4c439bef4371e5` |
| Deterministic CI orchestration copies, 6 files | `694d8164d3e0706d8adae939f8679fc7e3383543bc7e686420f84b2a389691fa` |
| Combined executable verification source, 713 files | `4e8f95ad4d07d247def3ea6a1d6c2ec60357583e09ef3209b9c0e4cc55de6d7b` |

Fingerprint algorithm: SHA256 of sorted `path + NUL + file SHA256 + LF`. Every one of the 24 SQL migration files and the migration lock file was checked, unchanged; individual hashes are in `Migration-Integrity.json` and the source-integrity receipt. No migration was introduced.

The RG03 MIME correction is restored **exactly** from the provided evidence. Its two files remain unchanged: `verification-tools/consolidated-runner.mjs` and `verification-tools/mail-mime.py`. The SMTP/MIME function remains byte-identical even in the derived CI runner. The accepted M05 diagnosis and previous environment diagnosis were not repeated. No prior PASS result was counted as execution here.

## Prepared CI environment

The manual-only workflow uses Ubuntu **24.04**, Node **24.19.0** (satisfies the frozen project's engines), `npm ci`, and locked Playwright **1.56.1**. Official project CLI installation requests Chromium **141.0.7390.37**, revision **1194**, with its official system dependencies. No project dependency upgrade, `npm install`, lockfile rewrite, unofficial mirror, TLS disablement or production secret is configured.

Each job uses the official **postgres:16** service with an isolated test database, explicit test-only credentials, localhost access and a health check. Readiness proves `SELECT version()` and major version 16, Prisma generation and the existing 24-migration chain.

M13/native tooling was inspected. It requires real `postgres`, `initdb`, `pg_ctl`, `pg_dump`, `pg_restore` and direct application/database lifecycle control. The workflow additionally uses Ubuntu's native PostgreSQL 16 client/server tooling under the non-root runner user. Its isolated capability smoke initializes/starts/connects, proves independent locking, dumps data, performs an immediate stop and same-data-directory restart, restores into a new database, and shuts down cleanly. The service container does not substitute for any native lifecycle assertion.

Actual browser launch, native cluster smoke and GitHub runner readiness are **NOT EXECUTED in this preparation session**. They are mandatory runtime gates in the prepared workflow and must succeed there before any release identity begins.

## Exact allowed infrastructure diff

New files are confined to `.github/`, `ci/`, root verification ignore/hash metadata and owner/preparation documentation. The 14-file code/config inventory is recorded in `CI-Source-Manifest.json`; the exact new-file diff is `Exact-GHA-Infrastructure.diff`.

Original application and authorized harness files are not edited. Six derived CI-only orchestration copies provide:

- Native PostgreSQL binary paths without the old managed-workspace UID/preload shim.
- Separate targeted evidence directories and explicit identity selection for unchanged M05 / related cases.
- Browser `--max-failures=1 --retries=0` for every required browser group.
- Single-worker, bail-1, retry-0 unit execution with machine-readable results.
- Security reporter worker metadata to distinguish identities not started after first failure.

`receipts/Exact-CI-Adapter.diff` records every derived-runner change. None changes canonical assertions, their timeouts, test bodies, fixtures, product behavior or the MIME implementation. Read-only stack/source parsing attributes native failures without editing or instrumenting canonical test code.

The obsolete original final-gate path binding is preserved unchanged but is not invoked. CI orchestration executes the same authoritative native/canonical/M13/content/launch/security groups with faithful paths and fresh full quality gates. It never resumes case 149 or inherits PASS counts.

## Execution sequence and failure policy

Jobs are serially dependent: runtime readiness → targeted M05/related/freeze → fresh complete final gate.

M05 is the first mandatory browser identity. All original registration, bounded-recovery, PasswordReset row, reset-mail URL, password-change, one-use, existing-session invalidation, recovery-aging and subsequent-login assertions stay in the unchanged source. It retains the existing 60-second canonical test timeout and unchanged expectation limits.

The related targeted gate contains ten unchanged identities: five other public-ingress M05 cases and five H01 Host-session revocation cases, including password-reset stream revocation. Only actual 1/1 M05 and 10/10 related PASS with zero skips/retries permit an RG03 freeze.

The final gate runs fresh full unit/integration/content/operations/lint/typecheck/build, then native identity 001 (`A/B concurrent paid`) and canonical identity 001 (`Arabic landing and account entry points render on desktop and mobile`), followed by required M13 and supplemental groups. Counts must independently prove 223 canonical, 38 supplemental, 186 native and 1185 unit/integration PASS. Targeted results are excluded from these final counts.

First failure stops mandatory execution. Only evidence processing/upload continues. Cause is not guessed; unresolved failures remain D until evidence establishes A product, B harness or C environment. Failed workflow attempts cannot be automatically rerun to replace evidence. No automatic product/test fix is present.

Only successful targeted M05/related verification can create the RG03 checkpoint. Only the fully successful fresh final gate can create the Release-Candidate/report/evidence/manifest/checklist. A failed job instead preserves a blocked report, first-failure evidence and latest safe checkpoint.

## What was actually validated locally

**12/12 CI infrastructure preparation checks PASS**, zero failures/errors/skips. These are new CI preparation checks, not a repeat of the historical 12 MIME checks and not Quddam release tests.

Validated: archive/source/harness integrity; YAML parsing/job dependencies/manual trigger/read permissions; signed PG/official browser provisioning commands; Python/Node/bash syntax; exact bounded CI adapter diffs; unchanged 60-second browser configuration and assertions; complete authoritative inventory; targeted identity selection; refusal to freeze without actual runtime/targeted proof; refusal to create a candidate with an unexecuted gate; safe redaction with preserved required fingerprints; genuine native M13 operations; read-only native source/stack attribution.

Playwright's actual installed CLI was used for **list/discovery only**: 261 unique browser/API identities matched their frozen source hashes (223 canonical + 38 supplemental). No browser was launched and no scenario assertion executed by discovery. All 186 native identities and source hashes also match the authoritative manifest.

Actionlint is not installed in this environment. YAML/Node/bash/Python validation is complete, but actual GitHub workflow-engine acceptance, action downloads, hosted image provisioning and runtime performance remain for the owner-run readiness job. No local PostgreSQL/Chromium recovery or old diagnoses were repeated.

## Fresh mandatory execution counts

| Required verification | PASS | FAILED | NOT_EXECUTED |
| --- | ---: | ---: | ---: |
| Targeted canonical M05 | 0 | 0 | 1 |
| Targeted related auth/reset | 0 | 0 | 10 |
| Final canonical browser/API | 0 | 0 | 223 |
| Final supplemental browser/API | 0 | 0 | 38 |
| Final native PostgreSQL | 0 | 0 | 186 |
| Final unit/integration | 0 | 0 | 1185 |

Fresh content validation, operations validation, lint, typecheck and production build: **NOT_EXECUTED**. All-ten-games, billing/refund, auth/security/privacy, M13 lifecycle/recovery, responsive/mobile and CSP compatibility release results: **NOT_EXECUTED**. Zero execution does not prove zero unresolved flaky or release readiness.

GitHub Actions run identity: **NONE**. No RG03 frozen checkpoint or Release-Candidate ZIP was created. Latest safe checkpoint remains the exact supplied RG02 archive, included unchanged under `inputs/`.

## Artifacts, privacy and remaining execution boundary

The workflow uploads allowlisted receipts, fresh results/manifest, sanitized original logs and diagnostic first-failure trace events, exact source/CI diffs, and safe deliverables even on failure. Retention: **14 days**. Raw traces, cookies, credentials, request bodies, DOM snapshots/screenshots/QR resources, synthetic private fixtures, SMTP payloads, DB dumps, TLS keys and generated secrets are excluded. The shared diagnostic trace is not a raw replayable Playwright archive. Frozen authored synthetic test constants remain part of the unchanged source.

Known preparation limitations: GitHub was not executed; no owner-authorized repository was identified. Ubuntu image/package patch versions and the official PostgreSQL 16 image patch tag can advance; the actual image digest and runtime versions are recorded by readiness, while Node/Playwright/application/CI source are pinned and verified. The hosted six-hour job limit can produce an environment-blocked incomplete run, never an inherited/resumed PASS. Only Chromium is required by this authoritative manifest; Firefox/WebKit are not newly claimed as tested.

Delivered preparation package, report, safe preparation evidence and exact repository-owner instructions. The owner must place the unchanged package on an authorized verification repository's default branch and manually start the workflow. No repository mutation or dispatch was performed here.

**Hard stop honored:** no deployment, production database, real payment, CSP enforcement, product feature/redesign/refactor, commit, push, automatic mandatory retry or next phase. CSP remains `Content-Security-Policy-Report-Only` in the frozen source.
