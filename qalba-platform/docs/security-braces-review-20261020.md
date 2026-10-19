# braces security remediation review — 20 October 2026

**Verdict: SECURITY_NO_GO.** A compatible released fix was not found. Full dependency audit still fails. No audit exception, severity change, dependency downgrade, workflow change, merge, deployment, or production database operation was made.

This is an AI technical review and evidence record, not a human security approval or risk acceptance. Checks were performed at approximately **02:16–02:19 Asia/Riyadh on 20 October 2026** against commit `15f9254af2deb36daa91d09b4c1b3af9500cc50f` and the package hashes recorded in [audit context](evidence/security-20261020/audit-context.json). Later unrelated working-tree content edits do not change this dependency snapshot.

## Fresh audit evidence

| Command / scope | Exit | Result |
| --- | --- | --- |
| `npm audit --json` — full dependency graph | 1 | **7 high**, 0 critical/moderate/low |
| `npm audit --omit=dev --json` — production dependency scope only | 0 | 0 reported advisories in this scope |
| Isolated Tailwind 4.3.3 candidate, `npm audit --json` | 1 | **5 high** remain through the Next ESLint chain |

The seven high entries are affected dependency packages associated with **one reported root advisory**, not seven independent root vulnerabilities. Full and production results must remain separate: a clean production-scoped audit does not pass the full audit or prove every bundled code path unreachable.

The locked `braces@3.0.3` node is marked as a development dependency. Its paths include:

```text
eslint-config-next@16.4.2
  -> @next/eslint-plugin-next@16.4.2
     -> fast-glob@3.3.1 -> micromatch@4.0.8 -> braces@3.0.3

tailwindcss@3.4.18
  -> micromatch@4.0.8 -> braces@3.0.3
  -> fast-glob@3.3.3 -> micromatch@4.0.8 -> braces@3.0.3
  -> chokidar@3.6.0 -> braces@3.0.3
```

See the [full audit](evidence/security-20261020/audit-full.json), [production audit](evidence/security-20261020/audit-production.json), [installed dependency tree](evidence/security-20261020/dependency-tree.json), and lockfile nodes in the audit context. The full audit's seven package entries are `braces`, `micromatch`, `fast-glob`, `chokidar`, `tailwindcss`, `@next/eslint-plugin-next`, and `eslint-config-next`.

## Upstream status and bounded reproduction

The reviewed [GitHub advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) / CVE-2026-93687 lists `braces <=3.0.3` as affected and no first patched version. The live [official braces registry](https://registry.npmjs.org/braces) still lists **3.0.3** as latest. [Upstream PR #72](https://github.com/micromatch/braces/pull/72) is closed **without merging**, as confirmed by the GitHub API. An unmerged proposal or an unofficial fork is not an adopted release remediation.

A bounded local child-process check on Node **24.21.0** with installed `braces@3.0.3` reproduced `RangeError: Maximum call stack size exceeded` in `braces.expand()` at **4,500 nested braces / 9,001 characters**, below the documented 10,000-character ceiling. At the same depth the default compile call returned; depths 100, 3,500 and 4,000 returned for both methods. These are observations on this runtime, not universal thresholds or a claim that application users can reach this API remotely. The small test strings never left the local process. [Reproduction results](evidence/security-20261020/bounded-reproduction.json)

Upstream disagreement does not change the current advisory/audit outcome. This review does not remove the full-audit failure.

## Evaluated remediation options

| Option | Evidence / compatibility finding | Decision |
| --- | --- | --- |
| Update `braces`, `micromatch`, or `fast-glob` within supported released versions | Latest versions are 3.0.3, 4.0.8, and 3.3.3 respectively; both parent packages still lead to affected braces. | No released fix available through this route. |
| Update the Next ESLint packages | Current stable is already 16.4.2. Even plugin 16.5.0-canary.18 still declares fast-glob 3.3.1. | No applicable upstream fix identified; canary not installed. |
| Accept npm's suggested `eslint-config-next@14.2.35` downgrade | An isolated lockfile-only install fails **ERESOLVE** because it requires ESLint 7/8 while the project uses 9.38.0. Published plugin source contains 21 rules versus 22 in 16.4.2: `no-location-assign-relative-destination` is absent. Its Core Web Vitals/TypeScript exports use legacy objects, whereas the current config spreads flat-config arrays. | Rejected: incompatible and does not preserve lint rule parity. No `--force` or `--legacy-peer-deps` used. |
| Update Tailwind within v3 LTS | Latest 3.4.19 retains chokidar 3, fast-glob and micromatch. | Does not remove the root dependency. |
| Migrate Tailwind to 4.3.3 | An isolated lockfile-only candidate still reports 5 high entries through Next ESLint. The [official v4 migration guide](https://tailwindcss.com/docs/upgrade-guide) also requires a new PostCSS integration and CSS migration; this project still uses `tailwindcss` directly in `postcss.config.js` and v3 `@tailwind` directives. | Not applied as a complete security fix. A separate tested CSS migration could remove only the Tailwind paths. |
| Maintain a pinned internal fork/patch or replace glob usage | Requires source review, provenance/integrity controls, compatibility tests for all consuming APIs, preserved ESLint coverage, and a maintained patch lifecycle. Merely renaming an affected package to escape audit detection is not remediation. | No fork/patch adopted or risk waiver assumed in this review. |

The [registry snapshot](evidence/security-20261020/registry-metadata.json), [upstream API snapshot](evidence/security-20261020/upstream-status.json), [compatibility inspection](evidence/security-20261020/compatibility-review.json), and [isolated experiment results](evidence/security-20261020/isolated-experiments.json) support these decisions. Experiments ran outside the Git checkout and did not alter the shared manifest, lockfile or installed dependency tree. The installed Next.js ESLint guide was read before inspection.

## Remaining work and acceptance

Keep the full audit gate failing until a maintained fix is available and adopted, or a properly reviewed replacement removes every affected path while preserving behavior. A future candidate must pass a fresh **full** audit, installation without peer-dependency bypasses, effective ESLint rule/severity parity, lint, typecheck, tests and build. Any Tailwind migration additionally needs visual checks of the real application.

No result here grants permission to waive the gate. Human content review and player difficulty pilots are separate outstanding requirements and receive no completion credit from security checks.

Only this report and its JSON evidence were added for the security task. Evidence JSON was parsed and scanned for local absolute paths and common token markers before delivery. No code-test/build pass is claimed for a dependency change: none was applied.
