# Dependency remediation execution specification

This is an executable review specification, not a claim that packages were installed or vulnerabilities fixed. Based on the source-bound audit in `docs/beta-security-gates.md`.

## Minimal proposed changes

- Upgrade `next`, `@next/env`, `eslint-config-next` together from 16.3.6 to 16.4.2.
- Resolve transitive `source-map-js` from 1.2.1 to at least 1.2.2 without introducing an unnecessary top-level production dependency or blanket override.
- Upgrade `vitest` from 4.0.4 to 4.1.12, preserving compatible `@vitest/*` family resolution.
- Inspect remaining dev advisories individually; do not force a Tailwind/ESLint major change.

## Commands on a clean checkout of PR #16

```sh
cd qalba-platform
npm ci --no-audit --no-fund
npm audit --omit=dev --json
npm audit --json
npm install --save-exact next@16.4.2 @next/env@16.4.2
npm install --save-dev --save-exact eslint-config-next@16.4.2 vitest@4.1.12
npm update source-map-js
npm ls next @next/env eslint-config-next source-map-js vitest @vitest/mocker
npm audit --omit=dev --json
npm audit --json
npm ci --no-audit --no-fund
npm run db:generate
npm run test -- --maxWorkers=1 --retry=0
npm run typecheck
npm run lint
npm run build
```

Capture all exit codes independently; nonzero audit exits are findings, not success. Check the lockfile diff for unexpected transitive or major upgrades before committing. Re-run native PostgreSQL 17 and Chrome Beta suites from the Beta report on the final exact SHA, plus restart and flag tests. Keep raw logs private and attach only sanitized evidence. No force fixes, bypassed checks, main merge, deployment or live database operations.
